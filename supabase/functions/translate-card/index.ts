import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_BODY_BYTES = 8 * 1024;
const MAX_TEXT_CHARACTERS = 1000;
const DEFAULT_MONTHLY_CHARACTER_LIMIT = 450_000;
const DEFAULT_DAILY_REQUEST_LIMIT = 30;

type JsonRecord = Record<string, unknown>;

function response(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
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

function positiveInteger(
  value: string | undefined,
  fallback: number,
  maximum: number,
): number | null {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : null;
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, code: string) => {
    const normalized = code.toLowerCase();
    if (normalized === 'amp') return '&';
    if (normalized === 'lt') return '<';
    if (normalized === 'gt') return '>';
    if (normalized === 'quot') return '"';
    if (normalized === 'apos') return "'";

    const codePoint = normalized.startsWith('#x')
      ? Number.parseInt(normalized.slice(2), 16)
      : Number.parseInt(normalized.slice(1), 10);
    return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : entity;
  });
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

  if (Deno.env.get('GOOGLE_TRANSLATION_ENABLED') !== 'true') {
    return response({ error: 'translation_not_configured' }, 503);
  }

  const apiKey = Deno.env.get('GOOGLE_TRANSLATION_API_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const monthlyCharacterLimit = positiveInteger(
    Deno.env.get('TRANSLATION_MONTHLY_CHARACTER_LIMIT'),
    DEFAULT_MONTHLY_CHARACTER_LIMIT,
    500_000,
  );
  const dailyRequestLimit = positiveInteger(
    Deno.env.get('TRANSLATION_DAILY_REQUEST_LIMIT'),
    DEFAULT_DAILY_REQUEST_LIMIT,
    100,
  );
  if (!apiKey || !serviceRoleKey || !monthlyCharacterLimit || !dailyRequestLimit) {
    return response({ error: 'translation_not_configured' }, 503);
  }

  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return response({ error: 'invalid_request' }, 413);
  }
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  ) {
    return response({ error: 'unsupported_content_type' }, 415);
  }

  const bytes = await readBoundedBody(request, MAX_BODY_BYTES);
  if (!bytes) {
    return response({ error: 'invalid_request' }, 413);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return response({ error: 'invalid_request' }, 400);
  }

  const text =
    isRecord(payload) && typeof payload['text'] === 'string' ? payload['text'].trim() : '';
  const characterCount = Array.from(text).length;
  if (!text || characterCount > MAX_TEXT_CHARACTERS) {
    return response({ error: 'invalid_text' }, 400);
  }

  const usageClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: reservation, error: reservationError } = await usageClient
    .rpc('reserve_card_translation_usage', {
      p_user_id: userData.user.id,
      p_characters: characterCount,
      p_monthly_limit: monthlyCharacterLimit,
      p_daily_request_limit: dailyRequestLimit,
    })
    .single();

  if (reservationError || !isRecord(reservation)) {
    return response({ error: 'translation_usage_unavailable' }, 503);
  }

  if (reservation['allowed'] !== true) {
    return response({ error: 'translation_limit_reached' }, 429);
  }

  let googleResponse: Response;
  try {
    googleResponse = await fetch('https://translation.googleapis.com/language/translate/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify({
        q: text,
        source: 'en',
        target: 'pt-BR',
        format: 'text',
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return response({ error: 'translation_service_unavailable' }, 502);
  }

  if (!googleResponse.ok) {
    return response({ error: 'translation_service_unavailable' }, 502);
  }

  let googlePayload: unknown;
  try {
    googlePayload = await googleResponse.json();
  } catch {
    return response({ error: 'translation_service_unavailable' }, 502);
  }

  const data =
    isRecord(googlePayload) && isRecord(googlePayload['data']) ? googlePayload['data'] : null;
  const translations = data && Array.isArray(data['translations']) ? data['translations'] : [];
  const translation =
    translations.length > 0 &&
    isRecord(translations[0]) &&
    typeof translations[0]['translatedText'] === 'string'
      ? decodeHtmlEntities(translations[0]['translatedText'])
      : '';
  if (!translation) {
    return response({ error: 'translation_service_unavailable' }, 502);
  }

  const charactersUsed = reservation['characters_used'];
  const monthlyLimit = reservation['monthly_limit'];
  if (typeof charactersUsed !== 'number' || typeof monthlyLimit !== 'number') {
    return response({ error: 'translation_usage_unavailable' }, 503);
  }

  return response({
    translation,
    usage: {
      charactersUsed,
      monthlyLimit,
      nearLimit: charactersUsed >= monthlyLimit * 0.8,
    },
  });
});
