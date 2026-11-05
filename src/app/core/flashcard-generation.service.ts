import { Injectable } from '@angular/core';

import { getSupabaseClient } from './supabase';

export type FlashcardSuggestionType = 'vocabulary' | 'sentence' | 'cloze';

export interface GeneratedFlashcard {
  front: string;
  back: string;
  focus: string;
  type: FlashcardSuggestionType;
  source: string;
}

export interface FlashcardGenerationResult {
  needsMoreContext: boolean;
  message: string;
  cards: GeneratedFlashcard[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSuggestionType(value: unknown): value is FlashcardSuggestionType {
  return value === 'vocabulary' || value === 'sentence' || value === 'cloze';
}

@Injectable({ providedIn: 'root' })
export class FlashcardGenerationService {
  async generate(
    summary: string,
    level: string,
    source: string,
  ): Promise<FlashcardGenerationResult> {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('A configuração do Supabase não está disponível.');
    }

    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError || !sessionData.session) {
      throw new Error('Sua sessão expirou. Entre novamente para gerar sugestões.');
    }

    const { data, error } = await client.functions.invoke('generate-flashcards', {
      body: { summary, level },
    });

    if (error) {
      if (error instanceof Error && 'context' in error && error.context instanceof Response) {
        if (error.context.status === 401) {
          throw new Error('Sua sessão expirou. Entre novamente para gerar sugestões.');
        }
        if (error.context.status === 413 || error.context.status === 400) {
          throw new Error('O resumo está vazio ou passou do limite de 5.000 caracteres.');
        }
        if (error.context.status === 429) {
          throw new Error(
            'O limite gratuito do Gemini pode ter sido atingido. Tente novamente mais tarde; nenhuma cobrança ou modelo pago será usado.',
          );
        }
        if (error.context.status === 503) {
          throw new Error(
            'A geração está indisponível ou não foi configurada. Você ainda pode concluir a lição e cadastrar cartões manualmente.',
          );
        }
      }

      throw new Error(
        'Não foi possível gerar sugestões agora. Tente novamente mais tarde ou cadastre cartões manualmente.',
      );
    }

    if (
      !isRecord(data) ||
      typeof data['needsMoreContext'] !== 'boolean' ||
      typeof data['message'] !== 'string' ||
      !Array.isArray(data['cards'])
    ) {
      throw new Error('O serviço retornou sugestões em formato inválido. Nenhum cartão foi salvo.');
    }

    if (data['needsMoreContext']) {
      if (data['cards'].length !== 0 || !data['message'].trim()) {
        throw new Error(
          'O serviço retornou sugestões em formato inválido. Nenhum cartão foi salvo.',
        );
      }

      return {
        needsMoreContext: true,
        message: data['message'].trim(),
        cards: [],
      };
    }

    if (data['cards'].length < 3 || data['cards'].length > 5) {
      throw new Error('O serviço retornou uma quantidade inválida de sugestões. Tente novamente.');
    }

    const cards: GeneratedFlashcard[] = data['cards'].map((card: unknown) => {
      if (
        !isRecord(card) ||
        typeof card['front'] !== 'string' ||
        typeof card['back'] !== 'string' ||
        typeof card['focus'] !== 'string' ||
        !isSuggestionType(card['type'])
      ) {
        throw new Error('O serviço retornou sugestões incompletas. Nenhum cartão foi salvo.');
      }

      const front = card['front'].trim();
      const back = card['back'].trim();
      const focus = card['focus'].trim();
      if (
        !front ||
        front.length > 500 ||
        !back ||
        back.length > 500 ||
        !focus ||
        focus.length > 120
      ) {
        throw new Error('O serviço retornou sugestões incompletas. Nenhum cartão foi salvo.');
      }

      return { front, back, focus, type: card['type'], source };
    });

    return {
      needsMoreContext: false,
      message: '',
      cards,
    };
  }
}
