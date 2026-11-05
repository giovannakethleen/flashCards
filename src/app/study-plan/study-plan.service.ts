import { Injectable } from '@angular/core';

import { AuthService } from '../core/auth.service';
import { getSupabaseClient } from '../core/supabase';

export type StudyActivityType =
  'study_lesson' | 'flashcard_review' | 'watch_video' | 'write_english' | 'conversation_class';

export type StudyActivityStatus = 'planned' | 'completed';

export interface StudyActivity {
  id: string;
  title: string;
  activity_type: StudyActivityType;
  starts_on: string;
  start_time: string | null;
  duration_minutes: number | null;
  lesson_reference: string | null;
  status: StudyActivityStatus;
}

export type StudyActivityInput = Omit<StudyActivity, 'id'>;

export interface ScheduledReview {
  id: string;
  english_text: string;
  next_review_at: string;
}

@Injectable({ providedIn: 'root' })
export class StudyPlanService {
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
      throw new Error('Você precisa estar autenticado para acessar seu plano de estudos.');
    }

    return user;
  }

  async listActivities(startDate: string, endDate: string): Promise<StudyActivity[]> {
    const client = this.getClient();
    const user = this.getCurrentUser();
    const { data, error } = await client
      .from('study_plan_activities')
      .select(
        'id, title, activity_type, starts_on, start_time, duration_minutes, lesson_reference, status',
      )
      .eq('user_id', user.id)
      .gte('starts_on', startDate)
      .lte('starts_on', endDate)
      .order('starts_on')
      .order('start_time', { nullsFirst: true });

    if (error) {
      throw new Error(error.message || 'Não foi possível carregar as atividades do plano.');
    }

    return (data ?? []) as StudyActivity[];
  }

  async listScheduledReviews(startDate: Date, endDateExclusive: Date): Promise<ScheduledReview[]> {
    const client = this.getClient();
    const user = this.getCurrentUser();
    const { data, error } = await client
      .from('flashcards')
      .select('id, english_text, next_review_at')
      .eq('user_id', user.id)
      .gte('next_review_at', startDate.toISOString())
      .lt('next_review_at', endDateExclusive.toISOString())
      .order('next_review_at');

    if (error) {
      throw new Error(error.message || 'Não foi possível carregar as revisões previstas.');
    }

    return (data ?? []) as ScheduledReview[];
  }

  async saveActivity(input: StudyActivityInput, activityId?: string): Promise<void> {
    const client = this.getClient();
    const user = this.getCurrentUser();
    const payload = { ...input, user_id: user.id, updated_at: new Date().toISOString() };

    const query = activityId
      ? client
          .from('study_plan_activities')
          .update(payload)
          .eq('id', activityId)
          .eq('user_id', user.id)
      : client.from('study_plan_activities').insert(payload);
    const { error } = await query;

    if (error) {
      throw new Error(error.message || 'Não foi possível salvar a atividade.');
    }
  }

  async updateStatus(activityId: string, status: StudyActivityStatus): Promise<void> {
    const client = this.getClient();
    const user = this.getCurrentUser();
    const { error } = await client
      .from('study_plan_activities')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', activityId)
      .eq('user_id', user.id);

    if (error) {
      throw new Error(error.message || 'Não foi possível atualizar o status da atividade.');
    }
  }
}
