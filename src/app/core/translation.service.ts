import { Injectable } from '@angular/core';

import { getSupabaseClient, isTranslationEnabled } from './supabase';

export interface TranslationUsage {
  charactersUsed: number;
  monthlyLimit: number;
  nearLimit: boolean;
}

export interface CardTranslation {
  text: string;
  usage: TranslationUsage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

@Injectable({ providedIn: 'root' })
export class TranslationService {
  get enabled(): boolean {
    return isTranslationEnabled();
  }

  async translateToPortuguese(text: string): Promise<CardTranslation> {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('A configuração do Supabase não está disponível.');
    }

    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError || !sessionData.session) {
      throw new Error('Sua sessão expirou. Entre novamente para traduzir.');
    }

    const { data, error } = await client.functions.invoke('translate-card', {
      body: { text },
    });

    if (error) {
      if (error instanceof Error && 'context' in error && error.context instanceof Response) {
        if (error.context.status === 401) {
          throw new Error('Sua sessão expirou. Entre novamente para traduzir.');
        }
        if (error.context.status === 429) {
          throw new Error(
            'O limite de traduções foi atingido. Tente novamente mais tarde ou confira a configuração de uso.',
          );
        }
        if (error.context.status === 503) {
          throw new Error(
            'A tradução automática está indisponível ou não foi configurada. Você ainda pode escrever a tradução manualmente.',
          );
        }
      }
      throw new Error('Não foi possível traduzir a frase. Tente novamente mais tarde.');
    }

    if (
      !isRecord(data) ||
      typeof data['translation'] !== 'string' ||
      !isRecord(data['usage']) ||
      typeof data['usage']['charactersUsed'] !== 'number' ||
      typeof data['usage']['monthlyLimit'] !== 'number' ||
      typeof data['usage']['nearLimit'] !== 'boolean'
    ) {
      throw new Error('O serviço retornou uma tradução em formato inválido.');
    }

    return {
      text: data['translation'],
      usage: {
        charactersUsed: data['usage']['charactersUsed'],
        monthlyLimit: data['usage']['monthlyLimit'],
        nearLimit: data['usage']['nearLimit'],
      },
    };
  }
}
