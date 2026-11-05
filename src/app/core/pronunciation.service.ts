import { Injectable } from '@angular/core';

import { getSupabaseClient } from './supabase';
import type { EnglishLocale } from './speech.service';

export interface PronunciationResult {
  accuracy: number | null;
  fluency: number | null;
  completeness: number | null;
  pronunciation: number | null;
  words: Array<{
    word: string;
    accuracy: number | null;
    errorType: string | null;
    phonemes: Array<{
      phoneme: string;
      accuracy: number | null;
      errorType: string | null;
    }>;
  }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function score(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseResult(value: unknown): PronunciationResult {
  if (!isRecord(value) || !isRecord(value['scores']) || !Array.isArray(value['words'])) {
    throw new Error('O serviço retornou uma avaliação em formato inválido.');
  }

  const scores = value['scores'];
  const words = value['words'].flatMap((item) => {
    if (!isRecord(item) || typeof item['word'] !== 'string') {
      return [];
    }

    const phonemeItems = item['phonemes'];
    const phonemes = Array.isArray(phonemeItems)
      ? phonemeItems.flatMap((phoneme) => {
          if (!isRecord(phoneme) || typeof phoneme['phoneme'] !== 'string') {
            return [];
          }

          return [
            {
              phoneme: phoneme['phoneme'],
              accuracy: score(phoneme['accuracy']),
              errorType: typeof phoneme['errorType'] === 'string' ? phoneme['errorType'] : null,
            },
          ];
        })
      : [];

    return [
      {
        word: item['word'],
        accuracy: score(item['accuracy']),
        errorType: typeof item['errorType'] === 'string' ? item['errorType'] : null,
        phonemes,
      },
    ];
  });

  return {
    accuracy: score(scores['accuracy']),
    fluency: score(scores['fluency']),
    completeness: score(scores['completeness']),
    pronunciation: score(scores['pronunciation']),
    words,
  };
}

@Injectable({ providedIn: 'root' })
export class PronunciationService {
  async assess(
    audio: Blob,
    referenceText: string,
    locale: EnglishLocale,
  ): Promise<PronunciationResult> {
    const client = getSupabaseClient();

    if (!client) {
      throw new Error('A configuração do Supabase não está disponível.');
    }

    const { data: sessionData, error: sessionError } = await client.auth.getSession();

    if (sessionError || !sessionData.session) {
      throw new Error('Sua sessão expirou. Entre novamente para avaliar a pronúncia.');
    }

    const { data, error } = await client.functions.invoke('pronunciation-assessment', {
      body: audio,
      headers: {
        'Content-Type': 'audio/wav',
        'x-reference-text': referenceText,
        'x-pronunciation-locale': locale,
      },
    });

    if (error) {
      if (error instanceof Error && 'context' in error && error.context instanceof Response) {
        if (error.context.status === 503) {
          throw new Error(
            'A avaliação automática não está configurada ou está indisponível. Você pode continuar gravando e ouvindo sem enviar o áudio.',
          );
        }
        if (error.context.status === 401) {
          throw new Error('Sua sessão expirou. Entre novamente para avaliar a pronúncia.');
        }
      }
      throw new Error('Não foi possível avaliar a pronúncia. Tente novamente mais tarde.');
    }

    return parseResult(data);
  }
}
