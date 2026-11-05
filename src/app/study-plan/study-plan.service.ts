import { Injectable } from '@angular/core';

import { AuthService } from '../core/auth.service';
import { getSupabaseClient } from '../core/supabase';

export type StudyActivityType =
  'study_lesson' | 'flashcard_review' | 'watch_video' | 'write_english' | 'conversation_class';

export type StudyActivityStatus = 'planned' | 'completed' | 'postponed' | 'skipped' | 'unrecorded';

export interface StudyActivity {
  id: string;
  title: string;
  activity_type: StudyActivityType;
  starts_on: string;
  start_time: string | null;
  duration_minutes: number | null;
  actual_duration_minutes: number | null;
  lesson_reference: string | null;
  plan_name: string | null;
  status: StudyActivityStatus;
}

export type StudyActivityInput = Omit<StudyActivity, 'id'>;

export interface ScheduledReview {
  id: string;
  english_text: string;
  next_review_at: string;
}

export interface StudyNote {
  id: string;
  title: string;
  content: string;
  updated_at: string;
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
        'id, title, activity_type, starts_on, start_time, duration_minutes, actual_duration_minutes, lesson_reference, plan_name, status',
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

  async getDayNote(date: string): Promise<string> {
    const client = this.getClient();
    const user = this.getCurrentUser();
    const { data, error } = await client
      .from('study_day_notes')
      .select('content')
      .eq('user_id', user.id)
      .eq('note_date', date)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || 'Não foi possível carregar a anotação do dia.');
    }

    return data?.content ?? '';
  }

  async saveDayNote(date: string, content: string): Promise<void> {
    const client = this.getClient();
    const user = this.getCurrentUser();
    const { error } = await client.from('study_day_notes').upsert(
      {
        user_id: user.id,
        note_date: date,
        content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,note_date' },
    );

    if (error) {
      throw new Error(error.message || 'Não foi possível salvar a anotação do dia.');
    }
  }

  async listNotes(): Promise<StudyNote[]> {
    const client = this.getClient();
    const user = this.getCurrentUser();
    const { data, error } = await client
      .from('study_notes')
      .select('id, title, content, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(error.message || 'Não foi possível carregar suas notas.');
    }

    return (data ?? []) as StudyNote[];
  }

  async createNote(title: string, content = ''): Promise<StudyNote> {
    const client = this.getClient();
    const user = this.getCurrentUser();
    const { data, error } = await client
      .from('study_notes')
      .insert({
        user_id: user.id,
        title: title.trim(),
        content,
      })
      .select('id, title, content, updated_at')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Não foi possível criar a nota.');
    }

    return data as StudyNote;
  }

  async updateNote(noteId: string, title: string, content: string): Promise<void> {
    const client = this.getClient();
    const user = this.getCurrentUser();
    const { error } = await client
      .from('study_notes')
      .update({ title: title.trim(), content, updated_at: new Date().toISOString() })
      .eq('id', noteId)
      .eq('user_id', user.id);

    if (error) {
      throw new Error(error.message || 'Não foi possível salvar a nota.');
    }
  }

  async deleteNote(noteId: string): Promise<void> {
    const client = this.getClient();
    const user = this.getCurrentUser();
    const { error } = await client
      .from('study_notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', user.id);

    if (error) {
      throw new Error(error.message || 'Não foi possível excluir a nota.');
    }
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

  async createMonthlyPlan(
    planName: string,
    startDate: string,
    endDate: string,
    activities: StudyActivityInput[],
  ): Promise<boolean> {
    const client = this.getClient();
    const user = this.getCurrentUser();
    const { data: existing, error: existingError } = await client
      .from('study_plan_activities')
      .select('id')
      .eq('user_id', user.id)
      .eq('plan_name', planName)
      .gte('starts_on', startDate)
      .lte('starts_on', endDate)
      .limit(1);

    if (existingError) {
      throw new Error(existingError.message || 'Não foi possível verificar o plano existente.');
    }
    if (existing?.length) {
      return false;
    }

    const { error } = await client.from('study_plan_activities').insert(
      activities.map((activity) => ({
        ...activity,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      })),
    );
    if (error) {
      throw new Error(error.message || 'Não foi possível criar o plano mensal.');
    }

    return true;
  }

  async deleteMonthlyPlan(planName: string, startDate: string, endDate: string): Promise<number> {
    const client = this.getClient();
    const user = this.getCurrentUser();
    const { count, error } = await client
      .from('study_plan_activities')
      .delete({ count: 'exact' })
      .eq('user_id', user.id)
      .eq('plan_name', planName)
      .gte('starts_on', startDate)
      .lte('starts_on', endDate);

    if (error) {
      throw new Error(error.message || 'Não foi possível excluir o plano mensal.');
    }

    return count ?? 0;
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

  async deleteActivity(activityId: string): Promise<void> {
    const client = this.getClient();
    const user = this.getCurrentUser();
    const { error } = await client
      .from('study_plan_activities')
      .delete()
      .eq('id', activityId)
      .eq('user_id', user.id);

    if (error) {
      throw new Error(error.message || 'Não foi possível excluir a atividade.');
    }
  }
}
