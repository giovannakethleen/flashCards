import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-reference-text, x-pronunciation-locale',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_AUDIO_BYTES = 512 * 1024;
const MAX_AUDIO_SECONDS = 15;
const MIN_AUDIO_SECONDS = 0.5;
const SAMPLE_RATE = 16_000;

type JsonRecord = Record<string, unknown>;

function response(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function readWavDuration(bytes: Uint8Array): number | null {
  if (bytes.length < 44 || bytes.length > MAX_AUDIO_BYTES) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number, length: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + length));

  if (
    text(0, 4) !== 'RIFF' ||
    text(8, 4) !== 'WAVE' ||
    view.getUint32(4, true) + 8 !== bytes.length
  ) {
    return null;
  }

  let offset = 12;
  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let byteRate = 0;
  let blockAlign = 0;
  let bitsPerSample = 0;
  let dataLength = 0;

  while (offset + 8 <= bytes.length) {
    const chunkName = text(offset, 4);
    const chunkLength = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;

    if (chunkEnd > bytes.length) {
      return null;
    }

    if (chunkName === 'fmt ' && chunkLength >= 16) {
      audioFormat = view.getUint16(chunkStart, true);
      channels = view.getUint16(chunkStart + 2, true);
      sampleRate = view.getUint32(chunkStart + 4, true);
      byteRate = view.getUint32(chunkStart + 8, true);
      blockAlign = view.getUint16(chunkStart + 12, true);
      bitsPerSample = view.getUint16(chunkStart + 14, true);
    } else if (chunkName === 'data') {
      dataLength = chunkLength;
    }

    offset = chunkEnd + (chunkLength % 2);
  }

  if (
    audioFormat !== 1 ||
    channels !== 1 ||
    sampleRate !== SAMPLE_RATE ||
    byteRate !== SAMPLE_RATE * 2 ||
    blockAlign !== 2 ||
    bitsPerSample !== 16 ||
    dataLength % 2 !== 0
  ) {
    return null;
  }

  const duration = dataLength / (SAMPLE_RATE * channels * (bitsPerSample / 8));
  return duration >= MIN_AUDIO_SECONDS && duration <= MAX_AUDIO_SECONDS ? duration : null;
}

async function readBoundedBody(request: Request, maximumBytes: number): Promise<Uint8Array | null> {
  if (!request.body) {
    return null;
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function numericValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function extractAssessment(payload: unknown): JsonRecord | null {
  if (!isRecord(payload) || !Array.isArray(payload.NBest) || !isRecord(payload.NBest[0])) {
    return null;
  }

  const best = payload.NBest[0];
  const overall = isRecord(best.PronunciationAssessment) ? best.PronunciationAssessment : {};
  const words = Array.isArray(best.Words)
    ? best.Words.flatMap((item) => {
        if (!isRecord(item) || typeof item.Word !== 'string') {
          return [];
        }

        const assessment = isRecord(item.PronunciationAssessment)
          ? item.PronunciationAssessment
          : {};
        const phonemes = Array.isArray(item.Phonemes)
          ? item.Phonemes.flatMap((phoneme) => {
              if (!isRecord(phoneme) || typeof phoneme.Phoneme !== 'string') {
                return [];
              }
              const details = isRecord(phoneme.PronunciationAssessment)
                ? phoneme.PronunciationAssessment
                : {};
              return [
                {
                  phoneme: phoneme.Phoneme,
                  accuracy: numericValue(details.AccuracyScore),
                  errorType: typeof details.ErrorType === 'string' ? details.ErrorType : null,
                },
              ];
            })
          : [];

        return [
          {
            word: item.Word,
            accuracy: numericValue(assessment.AccuracyScore),
            errorType: typeof assessment.ErrorType === 'string' ? assessment.ErrorType : null,
            phonemes,
          },
        ];
      })
    : [];

  return {
    scores: {
      accuracy: numericValue(overall.AccuracyScore),
      fluency: numericValue(overall.FluencyScore),
      completeness: numericValue(overall.CompletenessScore),
      pronunciation: numericValue(overall.PronScore),
    },
    words,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return response({ error: 'method_not_allowed' }, 405);
  }

  const authorization = request.headers.get('Authorization') ?? '';
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch) {
    return response({ error: 'authentication_required' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  if (!supabaseUrl || !supabaseKey) {
    return response({ error: 'authentication_service_unavailable' }, 503);
  }

  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: authError } = await authClient.auth.getUser(bearerMatch[1]);
  if (authError || !userData.user) {
    return response({ error: 'authentication_required' }, 401);
  }

  if (Deno.env.get('PRONUNCIATION_ASSESSMENT_ENABLED') !== 'true') {
    return response({ error: 'assessment_not_configured' }, 503);
  }

  const azureKey = Deno.env.get('AZURE_SPEECH_KEY');
  const azureRegion = Deno.env.get('AZURE_SPEECH_REGION');
  if (!azureKey || !azureRegion) {
    return response({ error: 'assessment_not_configured' }, 503);
  }
  if (!/^[a-z0-9-]+$/i.test(azureRegion)) {
    return response({ error: 'assessment_not_configured' }, 503);
  }

  const referenceText = request.headers.get('x-reference-text')?.trim() ?? '';
  const locale = request.headers.get('x-pronunciation-locale');
  if (!referenceText || referenceText.length > 400 || !['en-US', 'en-GB'].includes(locale ?? '')) {
    return response({ error: 'invalid_assessment_options' }, 400);
  }

  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'audio/wav') {
    return response({ error: 'unsupported_audio_format' }, 415);
  }

  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_AUDIO_BYTES) {
    return response({ error: 'audio_too_large' }, 413);
  }

  const bytes = await readBoundedBody(request, MAX_AUDIO_BYTES);
  if (!bytes) {
    return response({ error: 'audio_too_large' }, 413);
  }
  if (!readWavDuration(bytes)) {
    return response({ error: 'invalid_audio' }, 400);
  }

  const endpoint = new URL(
    `https://${azureRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`,
  );
  endpoint.searchParams.set('language', locale ?? 'en-US');
  endpoint.searchParams.set('format', 'detailed');
  const assessmentHeader = encodeBase64(
    JSON.stringify({
      ReferenceText: referenceText,
      GradingSystem: 'HundredMark',
      Granularity: 'Phoneme',
      Dimension: 'Basic',
      EnableMiscue: true,
    }),
  );
  const audioBody = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(audioBody).set(bytes);

  let azureResponse: Response;
  try {
    azureResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
        'Ocp-Apim-Subscription-Key': azureKey,
        'Pronunciation-Assessment': assessmentHeader,
      },
      body: audioBody,
    });
  } catch {
    return response({ error: 'assessment_service_unavailable' }, 502);
  }

  if (!azureResponse.ok) {
    return response({ error: 'assessment_failed' }, 502);
  }

  let assessment: JsonRecord | null;
  try {
    assessment = extractAssessment(await azureResponse.json());
  } catch {
    assessment = null;
  }

  if (!assessment) {
    return response({ error: 'assessment_unavailable' }, 502);
  }

  return response(assessment);
});
