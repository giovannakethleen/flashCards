import { Injectable } from '@angular/core';

import { AuthService } from '../core/auth.service';
import { getSupabaseClient } from '../core/supabase';

export interface FlashcardInput {
  english_text: string;
  portuguese_text: string;
  focus_word?: string | null;
  category?: string | null;
  source?: string | null;
  audio_info?: string | null;
  level?: string | null;
  next_review_at?: string;
  review_count?: number;
  mistake_count?: number;
  last_reviewed_at?: string | null;
}

export interface FlashcardRecord extends FlashcardInput {
  id: string;
  user_id: string;
  next_review_at: string;
  created_at?: string;
  updated_at?: string;
}

export interface DailyActivity {
  date: string;
  cardsAdded: number;
  cardsStudied: number;
  reviews: number;
}

export interface DifficultCard {
  id: string;
  english_text: string;
  portuguese_text: string;
  mistake_count: number;
  review_count: number;
}

export interface WeeklyLearningProgress {
  weekStart: string;
  label: string;
  reviews: number;
  accuracy: number | null;
}

export interface LearningInsights {
  accuracy: number | null;
  reviewCount: number;
  difficultCards: DifficultCard[];
  weeklyProgress: WeeklyLearningProgress[];
}

interface DailyActivityRow {
  activity_date: string;
  cards_added: number;
  cards_studied: number;
  reviews: number;
}

interface ReviewActivityRow {
  occurred_at: string;
  review_result: 'miss' | 'hard' | 'remembered' | 'easy';
}

interface LearningCardRow {
  id: string;
  english_text: string;
  portuguese_text: string;
  mistake_count: number | null;
  review_count: number | null;
}

@Injectable({ providedIn: 'root' })
export class CardService {
  constructor(private readonly auth: AuthService) {}

  private getClient() {
    const client = getSupabaseClient();

    if (!client) {
      throw new Error(
        'Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no arquivo .env ou no ambiente de build.',
      );
    }

    return client;
  }

  private getCurrentUser() {
    const user = this.auth.currentUser();

    if (!user) {
      throw new Error('Você precisa estar autenticado para cadastrar cartões.');
    }

    return user;
  }

  async createCard(input: FlashcardInput) {
    const client = this.getClient();
    const user = this.getCurrentUser();

    const payload = {
      user_id: user.id,
      english_text: input.english_text.trim(),
      portuguese_text: input.portuguese_text.trim(),
      focus_word: input.focus_word?.trim() || null,
      category: this.normalizeCategory(input.category),
      source: input.source?.trim() || null,
      audio_info: input.audio_info?.trim() || null,
      level: input.level?.trim() || null,
      next_review_at: input.next_review_at ?? new Date().toISOString(),
      review_count: input.review_count ?? 0,
      mistake_count: input.mistake_count ?? 0,
      last_reviewed_at: input.last_reviewed_at ?? null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await client.from('flashcards').insert([payload]).select().single();

    if (error) {
      throw new Error(error.message || 'Não foi possível salvar o cartão.');
    }

    return data;
  }

  async createCards(inputs: FlashcardInput[]): Promise<void> {
    if (!inputs.length) {
      throw new Error('Selecione pelo menos um cartão para salvar.');
    }

    const client = this.getClient();
    const user = this.getCurrentUser();
    const createdAt = new Date().toISOString();
    const payload = inputs.map((input) => ({
      user_id: user.id,
      english_text: input.english_text.trim(),
      portuguese_text: input.portuguese_text.trim(),
      focus_word: input.focus_word?.trim() || null,
      category: this.normalizeCategory(input.category),
      source: input.source?.trim() || null,
      audio_info: input.audio_info?.trim() || null,
      level: input.level?.trim() || null,
      next_review_at: input.next_review_at ?? createdAt,
      review_count: input.review_count ?? 0,
      mistake_count: input.mistake_count ?? 0,
      last_reviewed_at: input.last_reviewed_at ?? null,
      created_at: createdAt,
    }));

    const { error } = await client.from('flashcards').insert(payload);
    if (error) {
      throw new Error(error.message || 'Não foi possível salvar os cartões selecionados.');
    }
  }

  async getDueCards(): Promise<FlashcardRecord[]> {
    const client = this.getClient();
    const user = this.getCurrentUser();

    const now = new Date().toISOString();

    const { data, error } = await client
      .from('flashcards')
      .select('*')
      .eq('user_id', user.id)
      .lte('next_review_at', now)
      .order('next_review_at', { ascending: true });

    if (error) {
      throw new Error(error.message || 'Não foi possível carregar os cartões para revisão.');
    }

    return (data ?? []) as FlashcardRecord[];
  }

  async getAllCards(): Promise<FlashcardRecord[]> {
    const client = this.getClient();
    const user = this.getCurrentUser();

    const { data, error } = await client
      .from('flashcards')
      .select('*')
      .eq('user_id', user.id)
      .order('next_review_at', { ascending: true })
      .limit(100);

    if (error) {
      throw new Error(
        error.message || 'Não foi possível carregar os cartões para uma nova revisão.',
      );
    }

    return (data ?? []) as FlashcardRecord[];
  }

  async getDifficultCards(limit = 5): Promise<FlashcardRecord[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error('A quantidade de cartões difíceis deve estar entre 1 e 100.');
    }

    const client = this.getClient();
    const user = this.getCurrentUser();
    const { data, error } = await client
      .from('flashcards')
      .select('*')
      .eq('user_id', user.id)
      .gt('mistake_count', 0)
      .order('mistake_count', { ascending: false })
      .order('review_count', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(error.message || 'Não foi possível carregar os cartões mais difíceis.');
    }

    return (data ?? []) as FlashcardRecord[];
  }

  async getDashboardStats() {
    const client = this.getClient();
    const user = this.getCurrentUser();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const nowIso = now.toISOString();

    const [total, dueToday, reviewedToday] = await Promise.all([
      client.from('flashcards').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      client
        .from('flashcards')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .lte('next_review_at', nowIso),
      client
        .from('flashcards')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('last_reviewed_at', startOfToday),
    ]);

    const error = total.error ?? dueToday.error ?? reviewedToday.error;

    if (error) {
      throw new Error(error.message || 'Não foi possível carregar o resumo de estudos.');
    }

    return {
      totalCards: total.count ?? 0,
      dueToday: dueToday.count ?? 0,
      reviewedToday: reviewedToday.count ?? 0,
    };
  }

  async getLearningInsights(): Promise<LearningInsights> {
    const client = this.getClient();
    const user = this.getCurrentUser();
    const today = new Date();
    const currentWeekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    currentWeekStart.setDate(currentWeekStart.getDate() - ((currentWeekStart.getDay() + 6) % 7));
    const firstWeekStart = new Date(currentWeekStart);
    firstWeekStart.setDate(firstWeekStart.getDate() - 49);

    const pageSize = 1000;
    const loadCards = async () => {
      const cards: LearningCardRow[] = [];
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await client
          .from('flashcards')
          .select('id, english_text, portuguese_text, mistake_count, review_count')
          .eq('user_id', user.id)
          .order('id', { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error) {
          throw new Error(error.message || 'Não foi possível carregar suas estatísticas de estudo.');
        }
        const page = (data ?? []) as LearningCardRow[];
        cards.push(...page);
        if (page.length < pageSize) {
          return cards;
        }
      }
    };
    const loadRecentReviews = async () => {
      const reviews: ReviewActivityRow[] = [];
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await client
          .from('flashcard_activity')
          .select('occurred_at, review_result')
          .eq('user_id', user.id)
          .eq('activity_type', 'card_reviewed')
          .gte('occurred_at', firstWeekStart.toISOString())
          .order('occurred_at', { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error) {
          throw new Error(error.message || 'Não foi possível carregar suas estatísticas de estudo.');
        }
        const page = (data ?? []) as ReviewActivityRow[];
        reviews.push(...page);
        if (page.length < pageSize) {
          return reviews;
        }
      }
    };
    const [cards, reviews] = await Promise.all([loadCards(), loadRecentReviews()]);
    const reviewCount = cards.reduce((total, card) => total + Number(card.review_count ?? 0), 0);
    const mistakeCount = cards.reduce(
      (total, card) => total + Number(card.mistake_count ?? 0),
      0,
    );
    const weeklyCounts = Array.from({ length: 8 }, (_, index) => {
      const start = new Date(firstWeekStart);
      start.setDate(start.getDate() + index * 7);
      return { weekStart: this.formatDate(start), reviews: 0, correct: 0 };
    });
    const weekIndexByStart = new Map(
      weeklyCounts.map((week, index) => [week.weekStart, index]),
    );

    for (const review of reviews) {
      const occurredAt = new Date(review.occurred_at);
      const reviewWeekStart = new Date(
        occurredAt.getFullYear(),
        occurredAt.getMonth(),
        occurredAt.getDate(),
      );
      reviewWeekStart.setDate(
        reviewWeekStart.getDate() - ((reviewWeekStart.getDay() + 6) % 7),
      );
      const weekIndex = weekIndexByStart.get(this.formatDate(reviewWeekStart));

      if (weekIndex !== undefined) {
        weeklyCounts[weekIndex].reviews += 1;
        if (review.review_result === 'remembered' || review.review_result === 'easy') {
          weeklyCounts[weekIndex].correct += 1;
        }
      }
    }

    return {
      accuracy:
        reviewCount > 0
          ? Math.round((Math.max(0, reviewCount - mistakeCount) / reviewCount) * 100)
          : null,
      reviewCount,
      difficultCards: cards
        .filter((card) => Number(card.mistake_count ?? 0) > 0)
        .slice(0, 5)
        .map((card) => ({
          id: card.id,
          english_text: card.english_text,
          portuguese_text: card.portuguese_text,
          mistake_count: Number(card.mistake_count ?? 0),
          review_count: Number(card.review_count ?? 0),
        })),
      weeklyProgress: weeklyCounts.map(({ weekStart, reviews, correct }) => ({
        weekStart,
        label: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(
          new Date(
            Number(weekStart.slice(0, 4)),
            Number(weekStart.slice(5, 7)) - 1,
            Number(weekStart.slice(8, 10)),
          ),
        ),
        reviews,
        accuracy: reviews ? Math.round((correct / reviews) * 100) : null,
      })),
    };
  }

  async getActivityCalendar(
    startDate: string,
    endDate: string,
    timeZone: string,
  ): Promise<DailyActivity[]> {
    const client = this.getClient();
    this.getCurrentUser();

    const { data, error } = await client.rpc('get_flashcard_activity', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_timezone: timeZone,
    });

    if (error) {
      throw new Error(error.message || 'Não foi possível carregar o calendário de atividade.');
    }

    return (data ?? []).map((row: DailyActivityRow) => ({
      date: row.activity_date,
      cardsAdded: Number(row.cards_added),
      cardsStudied: Number(row.cards_studied),
      reviews: Number(row.reviews),
    }));
  }

  private formatDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async listCards(filters?: { search?: string; category?: string }): Promise<FlashcardRecord[]> {
    const client = this.getClient();
    const user = this.getCurrentUser();

    let query = client
      .from('flashcards')
      .select('*')
      .eq('user_id', user.id)
      .order('next_review_at', { ascending: true });

    if (filters?.search) {
      const term = filters.search.trim();
      query = query.or(`english_text.ilike.%${term}%,portuguese_text.ilike.%${term}%`);
    }

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message || 'Não foi possível carregar a coleção.');
    }

    return (data ?? []) as FlashcardRecord[];
  }

  async deleteCard(cardId: string) {
    const client = this.getClient();
    const user = this.getCurrentUser();

    const { error } = await client
      .from('flashcards')
      .delete()
      .eq('id', cardId)
      .eq('user_id', user.id);

    if (error) {
      throw new Error(error.message || 'Não foi possível excluir o cartão.');
    }
  }

  async updateCard(cardId: string, input: Partial<FlashcardInput>) {
    const client = this.getClient();
    const user = this.getCurrentUser();

    const payload: Partial<FlashcardInput> = {
      ...input,
      english_text: input.english_text?.trim() ?? undefined,
      portuguese_text: input.portuguese_text?.trim() ?? undefined,
      focus_word: input.focus_word?.trim() || null,
      category: this.normalizeCategory(input.category),
      source: input.source?.trim() || null,
      audio_info: input.audio_info?.trim() || null,
      level: input.level?.trim() || null,
    };

    const { error } = await client
      .from('flashcards')
      .update(payload)
      .eq('id', cardId)
      .eq('user_id', user.id);

    if (error) {
      throw new Error(error.message || 'Não foi possível atualizar o cartão.');
    }
  }

  async exportJson(): Promise<string> {
    const client = this.getClient();
    const user = this.getCurrentUser();

    const { data, error } = await client.from('flashcards').select('*').eq('user_id', user.id);

    if (error) {
      throw new Error(error.message || 'Não foi possível exportar os cartões.');
    }

    return JSON.stringify(
      (data ?? []).map((item) => ({
        english_text: item.english_text,
        portuguese_text: item.portuguese_text,
        focus_word: item.focus_word ?? '',
        category: item.category ?? '',
        source: item.source ?? '',
        audio_info: item.audio_info ?? '',
        level: item.level ?? '',
        next_review_at: item.next_review_at,
        review_count: item.review_count ?? 0,
        mistake_count: item.mistake_count ?? 0,
        last_reviewed_at: item.last_reviewed_at ?? null,
      })),
      null,
      2,
    );
  }

  async importJson(file: File, mode: 'merge' | 'replace') {
    const client = this.getClient();
    const user = this.getCurrentUser();

    const text = await file.text();
    const parsed = JSON.parse(text);

    if (!Array.isArray(parsed)) {
      throw new Error('Arquivo JSON inválido: a estrutura precisa ser uma lista de cartões.');
    }

    const validCards = parsed.map((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new Error(`Item ${index + 1} inválido.`);
      }

      const englishText = typeof item.english_text === 'string' ? item.english_text.trim() : '';
      const portugueseText =
        typeof item.portuguese_text === 'string' ? item.portuguese_text.trim() : '';
      const level = typeof item.level === 'string' ? item.level.trim() : null;

      if (!englishText || !portugueseText) {
        throw new Error(`Cartão ${index + 1} está sem frase ou tradução válidas.`);
      }
      if (level && !['beginner', 'intermediate', 'advanced'].includes(level)) {
        throw new Error(`Cartão ${index + 1} tem um nível de inglês inválido.`);
      }

      return {
        user_id: user.id,
        english_text: englishText,
        portuguese_text: portugueseText,
        focus_word: typeof item.focus_word === 'string' ? item.focus_word.trim() : null,
        category: typeof item.category === 'string' ? item.category.trim() : null,
        source: typeof item.source === 'string' ? item.source.trim() : null,
        audio_info: typeof item.audio_info === 'string' ? item.audio_info.trim() : null,
        level,
        next_review_at:
          typeof item.next_review_at === 'string' ? item.next_review_at : new Date().toISOString(),
        review_count: Number(item.review_count ?? 0),
        mistake_count: Number(item.mistake_count ?? 0),
        last_reviewed_at: typeof item.last_reviewed_at === 'string' ? item.last_reviewed_at : null,
      };
    });

    if (mode === 'replace') {
      const { error: deleteError } = await client
        .from('flashcards')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        throw new Error(
          deleteError.message || 'Não foi possível limpar os cartões antes de importar.',
        );
      }
    }

    const { error } = await client.from('flashcards').insert(validCards);

    if (error) {
      throw new Error(error.message || 'Não foi possível importar os cartões.');
    }

    return validCards.length;
  }

  async updateReview(cardId: string, result: 'miss' | 'hard' | 'remembered' | 'easy') {
    const client = this.getClient();
    this.getCurrentUser();

    const { error } = await client.rpc('record_flashcard_review', {
      p_card_id: cardId,
      p_result: result,
    });

    if (error) {
      throw new Error(error.message || 'Não foi possível atualizar o progresso do cartão.');
    }
  }

  private normalizeCategory(category?: string | null) {
    return category?.trim().toLocaleLowerCase() || null;
  }
}
