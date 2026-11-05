import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import {
  StudyPlanService,
  type ScheduledReview,
  type StudyActivity,
  type StudyActivityInput,
  type StudyActivityStatus,
  type StudyActivityType,
} from './study-plan.service';
import { CardService } from '../cards/card.service';
import {
  FlashcardGenerationService,
  type GeneratedFlashcard,
} from '../core/flashcard-generation.service';

type CalendarView = 'month' | 'week' | 'day';

interface CalendarDay {
  date: string;
  dayNumber: number;
  isToday: boolean;
  isSelected: boolean;
}

interface ActivityForm {
  title: string;
  activity_type: StudyActivityType;
  starts_on: string;
  start_time: string;
  duration_minutes: number | null;
  lesson_reference: string;
}

@Component({
  selector: 'app-study-plan',
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="plan-page">
      <header class="page-heading">
        <div>
          <p class="eyebrow">ORGANIZE SEU APRENDIZADO</p>
          <h1>Meu plano de estudos</h1>
          <p class="intro">Planeje suas sessões e acompanhe as revisões que estão chegando.</p>
        </div>
        <button type="button" class="primary-button add-top" (click)="openNewActivity()">
          <span aria-hidden="true">＋</span> Nova atividade
        </button>
      </header>

      @if (errorMessage) {
        <div class="notice error" role="alert">
          <span>{{ errorMessage }}</span>
          <button type="button" (click)="loadCalendar()">Tentar novamente</button>
        </div>
      }

      <section class="calendar-panel" aria-label="Calendário do plano de estudos">
        <div class="calendar-toolbar">
          <div class="calendar-navigation">
            <button
              type="button"
              class="icon-button"
              (click)="movePeriod(-1)"
              aria-label="Anterior"
            >
              ‹
            </button>
            <button type="button" class="today-button" (click)="goToToday()">Hoje</button>
            <button type="button" class="icon-button" (click)="movePeriod(1)" aria-label="Próximo">
              ›
            </button>
            <h2>{{ periodLabel }}</h2>
          </div>
          <div class="view-switch" role="group" aria-label="Visualização do calendário">
            <button
              type="button"
              [class.active]="view === 'day'"
              [attr.aria-pressed]="view === 'day'"
              (click)="setView('day')"
            >
              Dia
            </button>
            <button
              type="button"
              [class.active]="view === 'week'"
              [attr.aria-pressed]="view === 'week'"
              (click)="setView('week')"
            >
              Semana
            </button>
            <button
              type="button"
              [class.active]="view === 'month'"
              [attr.aria-pressed]="view === 'month'"
              (click)="setView('month')"
            >
              Mês
            </button>
          </div>
        </div>

        @if (loading) {
          <div class="loading" role="status">Carregando seu calendário...</div>
        } @else if (view === 'month') {
          <div class="month-grid">
            <div class="weekday-row" aria-hidden="true">
              @for (weekday of weekdayNames; track weekday) {
                <span>{{ weekday }}</span>
              }
            </div>
            <div class="month-days">
              @for (day of monthDays; track $index) {
                @if (day) {
                  <button
                    type="button"
                    class="month-day"
                    [class.today]="day.isToday"
                    [class.selected]="day.isSelected"
                    [attr.aria-pressed]="day.isSelected"
                    [attr.aria-label]="
                      formatDateLabel(day.date) +
                      ', ' +
                      activitiesOn(day.date).length +
                      ' atividades'
                    "
                    (click)="selectDate(day.date)"
                  >
                    <span class="day-number">{{ day.dayNumber }}</span>
                    <span class="day-items">
                      @for (activity of activitiesOn(day.date).slice(0, 2); track activity.id) {
                        <span
                          class="month-activity"
                          [class.completed]="activity.status === 'completed'"
                        >
                          {{ activity.title }}
                        </span>
                      }
                      @if (activitiesOn(day.date).length > 2) {
                        <span class="more-items"
                          >+{{ activitiesOn(day.date).length - 2 }} mais</span
                        >
                      }
                      @if (reviewsOn(day.date).length) {
                        <span class="review-marker">
                          ◷ {{ reviewsOn(day.date).length }} revisões
                        </span>
                      }
                    </span>
                  </button>
                } @else {
                  <div class="month-day outside-month" aria-hidden="true"></div>
                }
              }
            </div>
          </div>
        } @else if (view === 'week') {
          <div class="week-grid">
            @for (day of weekDays; track day.date) {
              <button
                type="button"
                class="week-day"
                [class.selected]="day.isSelected"
                [class.today]="day.isToday"
                [attr.aria-pressed]="day.isSelected"
                (click)="selectDate(day.date)"
              >
                <span class="week-day-name">{{ weekdayLong(day.date) }}</span>
                <strong>{{ day.dayNumber }}</strong>
                <span class="week-items">
                  @for (activity of activitiesOn(day.date).slice(0, 3); track activity.id) {
                    <span class="week-activity" [class.completed]="activity.status === 'completed'">
                      {{ activity.start_time ? activity.start_time.slice(0, 5) + ' · ' : ''
                      }}{{ activity.title }}
                    </span>
                  }
                  @if (reviewsOn(day.date).length) {
                    <span class="review-marker">◷ {{ reviewsOn(day.date).length }} revisões</span>
                  }
                </span>
              </button>
            }
          </div>
        } @else {
          <div class="day-overview">
            <span class="day-overview-name">{{ formatDateLabel(selectedDate) }}</span>
            <span>
              {{ activitiesOn(selectedDate).length }}
              {{ activitiesOn(selectedDate).length === 1 ? 'atividade' : 'atividades' }}
            </span>
          </div>
        }
      </section>

      <section class="day-panel" aria-labelledby="selected-day-heading">
        <div class="day-heading">
          <div>
            <p class="eyebrow">AGENDA DO DIA</p>
            <h2 id="selected-day-heading">{{ formatDateLabel(selectedDate) }}</h2>
          </div>
          <button type="button" class="primary-button" (click)="openNewActivity()">
            ＋ Adicionar
          </button>
        </div>

        @if (reviewsOn(selectedDate).length) {
          <article class="review-card">
            <div class="review-icon" aria-hidden="true">◷</div>
            <div class="review-copy">
              <strong>Revisões de flashcards previstas</strong>
              <span
                >{{ reviewsOn(selectedDate).length }}
                {{ reviewsOn(selectedDate).length === 1 ? 'cartão' : 'cartões' }} para revisar</span
              >
              <small>{{ reviewTitles(selectedDate) }}</small>
            </div>
            <button type="button" class="secondary-button" (click)="goToReview()">Revisar</button>
          </article>
        }

        @if (activitiesOn(selectedDate).length) {
          <div class="activity-list">
            @for (activity of activitiesOn(selectedDate); track activity.id) {
              <article class="activity-card" [class.completed]="activity.status === 'completed'">
                <span class="activity-type-icon" aria-hidden="true">{{
                  activityIcon(activity.activity_type)
                }}</span>
                <div class="activity-copy">
                  <div class="activity-title-row">
                    <strong>{{ activity.title }}</strong>
                    <span class="status-chip" [class.done]="activity.status === 'completed'">
                      {{ statusLabel(activity.status) }}
                    </span>
                  </div>
                  <p>
                    {{ activityTypeLabel(activity.activity_type) }}
                    @if (activity.start_time) {
                      <span> · {{ activity.start_time.slice(0, 5) }}</span>
                    }
                    @if (activity.duration_minutes) {
                      <span> · {{ activity.duration_minutes }} min</span>
                    }
                  </p>
                  @if (activity.lesson_reference) {
                    <small>Lição: {{ activity.lesson_reference }}</small>
                  }
                </div>
                <div class="activity-actions">
                  @if (activity.status === 'planned') {
                    <button
                      type="button"
                      class="complete-button"
                      (click)="completeActivity(activity)"
                      [disabled]="saving"
                    >
                      Concluir
                    </button>
                  }
                  <button type="button" class="text-button" (click)="editActivity(activity)">
                    Editar
                  </button>
                </div>
              </article>
            }
          </div>
        } @else if (!reviewsOn(selectedDate).length) {
          <div class="empty-state">
            <span aria-hidden="true">✦</span>
            <strong>Nenhuma atividade planejada</strong>
            <p>Adicione uma sessão para manter seu ritmo de estudos.</p>
          </div>
        }

        @if (formOpen) {
          <form class="activity-form" (ngSubmit)="saveActivity()" #activityForm="ngForm">
            <div class="form-heading">
              <h3>{{ editingId ? 'Editar atividade' : 'Nova atividade' }}</h3>
              <button type="button" class="text-button" (click)="closeForm()">Cancelar</button>
            </div>
            <label>
              Nome da atividade
              <input
                type="text"
                name="title"
                [(ngModel)]="form.title"
                required
                maxlength="120"
                placeholder="Ex.: Unidade 3 — vocabulário de viagens"
              />
            </label>
            <div class="form-row">
              <label>
                Tipo
                <select name="activity_type" [(ngModel)]="form.activity_type" required>
                  @for (type of activityTypes; track type.value) {
                    <option [value]="type.value">{{ type.label }}</option>
                  }
                </select>
              </label>
              <label>
                Data
                <input type="date" name="starts_on" [(ngModel)]="form.starts_on" required />
              </label>
            </div>
            <div class="form-row">
              <label>
                Horário <span class="optional">(opcional)</span>
                <input type="time" name="start_time" [(ngModel)]="form.start_time" />
              </label>
              <label>
                Duração em minutos <span class="optional">(opcional)</span>
                <input
                  type="number"
                  name="duration_minutes"
                  [(ngModel)]="form.duration_minutes"
                  min="1"
                  max="1440"
                  placeholder="Ex.: 30"
                />
              </label>
            </div>
            <label>
              Unidade ou lição <span class="optional">(opcional)</span>
              <input
                type="text"
                name="lesson_reference"
                [(ngModel)]="form.lesson_reference"
                maxlength="160"
                placeholder="Ex.: Unidade 3, lição 2"
              />
            </label>
            @if (formError) {
              <p class="form-error" role="alert">{{ formError }}</p>
            }
            <button
              type="submit"
              class="primary-button save-button"
              [disabled]="activityForm.invalid || saving"
            >
              {{ saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Salvar atividade' }}
            </button>
          </form>
        }
      </section>

      @if (completionActivity) {
        <div class="completion-backdrop">
          <section
            class="completion-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="completion-heading"
          >
            <div class="form-heading">
              <h2 id="completion-heading">Concluir lição</h2>
              <button
                type="button"
                class="text-button"
                (click)="closeCompletionDialog()"
                [disabled]="generatingCards || savingCards || saving"
                aria-label="Fechar"
              >
                Fechar
              </button>
            </div>
            <p class="completion-intro">
              {{ completionActivity.title }}
              @if (completionActivity.lesson_reference) {
                <span> · {{ completionActivity.lesson_reference }}</span>
              }
            </p>
            <label class="completion-label" for="lesson-summary">
              Escreva ou cole o resumo do que você estudou
            </label>
            <textarea
              id="lesson-summary"
              [(ngModel)]="lessonSummary"
              [ngModelOptions]="{ standalone: true }"
              maxlength="5000"
              rows="6"
              placeholder="Compartilhe apenas o conteúdo que você revisou e quer enviar."
              [disabled]="generatingCards || savingCards"
            ></textarea>
            <div class="summary-meta">
              <span>Nível de inglês</span>
              <select
                [(ngModel)]="learnerLevel"
                [ngModelOptions]="{ standalone: true }"
                [disabled]="generatingCards || savingCards"
              >
                <option value="beginner">Iniciante</option>
                <option value="intermediate">Intermediário</option>
                <option value="advanced">Avançado</option>
              </select>
              <span>{{ lessonSummary.length }}/5000</span>
            </div>
            <p class="privacy-notice">
              O resumo só será enviado ao Gemini se você tocar em “Gerar cards com Gemini”.
              Na camada gratuita, o Google pode usar o conteúdo para melhorar os produtos.
              Não envie dados pessoais nem conteúdo que não queira compartilhar. A geração é
              opcional; você pode concluir a lição e criar cartões manualmente.
            </p>
            @if (generationError) {
              <p class="completion-error" role="alert">{{ generationError }}</p>
            }
            @if (generationMessage) {
              <p class="completion-success" role="status">{{ generationMessage }}</p>
            }
            @if (needsMoreContext) {
              <p class="completion-hint" role="status">{{ needsMoreContext }}</p>
            }
            <button
              type="button"
              class="primary-button generate-button"
              (click)="generateFlashcards()"
              [disabled]="generatingCards || savingCards || !lessonSummary.trim()"
            >
              {{ generatingCards ? 'Gerando sugestões...' : 'Gerar cards com Gemini' }}
            </button>

            @if (drafts.length) {
              <div class="draft-list" aria-label="Rascunhos de flashcards">
                @for (draft of drafts; track draft.id) {
                  <article class="draft-card">
                    <label class="draft-select">
                      <input
                        type="checkbox"
                        [(ngModel)]="draft.selected"
                        [ngModelOptions]="{ standalone: true }"
                        [disabled]="savingCards"
                      />
                      Incluir este rascunho
                    </label>
                    <button
                      type="button"
                      class="text-button draft-delete"
                      (click)="removeDraft(draft.id)"
                      [disabled]="savingCards"
                      aria-label="Excluir sugestão"
                    >
                      Excluir
                    </button>
                    <label>
                      Frente em inglês
                      <textarea
                        [(ngModel)]="draft.front"
                        [ngModelOptions]="{ standalone: true }"
                        maxlength="500"
                        rows="2"
                        [disabled]="savingCards"
                      ></textarea>
                    </label>
                    <label>
                      Tradução ou resposta em português
                      <textarea
                        [(ngModel)]="draft.back"
                        [ngModelOptions]="{ standalone: true }"
                        maxlength="500"
                        rows="2"
                        [disabled]="savingCards"
                      ></textarea>
                    </label>
                    <div class="draft-fields">
                      <label>
                        Palavra ou expressão em foco
                        <input
                          [(ngModel)]="draft.focus"
                          [ngModelOptions]="{ standalone: true }"
                          maxlength="120"
                          [disabled]="savingCards"
                        />
                      </label>
                      <label>
                        Tipo
                        <select
                          [(ngModel)]="draft.type"
                          [ngModelOptions]="{ standalone: true }"
                          [disabled]="savingCards"
                        >
                          <option value="vocabulary">Vocabulário</option>
                          <option value="sentence">Frase</option>
                          <option value="cloze">Lacuna</option>
                        </select>
                      </label>
                    </div>
                    <small>Origem: {{ draft.source }}</small>
                  </article>
                }
              </div>
              <button
                type="button"
                class="primary-button save-drafts-button"
                (click)="saveSelectedDrafts()"
                [disabled]="savingCards || !selectedDraftsValid"
              >
                {{ savingCards ? 'Salvando...' : 'Salvar ' + selectedDraftCount + ' cards selecionados' }}
              </button>
            }

            <div class="completion-actions">
              <button
                type="button"
                class="secondary-button"
                (click)="markActivityCompleted(completionActivity)"
                [disabled]="generatingCards || savingCards || saving"
              >
                {{ saving ? 'Concluindo...' : 'Concluir atividade' }}
              </button>
            </div>
          </section>
        </div>
      }
    </main>
  `,
})
export class StudyPlanComponent implements OnInit {
  readonly weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  readonly activityTypes: Array<{ value: StudyActivityType; label: string }> = [
    { value: 'study_lesson', label: 'Estudar unidade ou lição' },
    { value: 'flashcard_review', label: 'Revisar flashcards' },
    { value: 'watch_video', label: 'Assistir a vídeos' },
    { value: 'write_english', label: 'Escrever em inglês' },
    { value: 'conversation_class', label: 'Aula de conversação' },
  ];

  view: CalendarView = 'month';
  displayedDate = this.startOfDay(new Date());
  selectedDate = this.formatDate(new Date());
  activities: StudyActivity[] = [];
  scheduledReviews: ScheduledReview[] = [];
  loading = true;
  saving = false;
  errorMessage = '';
  formError = '';
  formOpen = false;
  editingId = '';
  periodLabel = '';
  monthDays: Array<CalendarDay | null> = [];
  weekDays: CalendarDay[] = [];
  form: ActivityForm = this.emptyForm();
  completionActivity: StudyActivity | null = null;
  lessonSummary = '';
  learnerLevel = 'beginner';
  drafts: Array<GeneratedFlashcard & { id: number; selected: boolean }> = [];
  generatingCards = false;
  savingCards = false;
  generationError = '';
  generationMessage = '';
  needsMoreContext = '';

  constructor(
    private readonly service: StudyPlanService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
    private readonly cardService: CardService,
    private readonly flashcardGeneration: FlashcardGenerationService,
  ) {}

  ngOnInit() {
    void this.loadCalendar();
  }

  async loadCalendar() {
    this.loading = true;
    this.errorMessage = '';
    this.updateCalendarDays();

    try {
      const { start, endExclusive } = this.visibleRange();
      const startDate = this.formatDate(start);
      const endDate = this.formatDate(new Date(endExclusive.getTime() - 86400000));
      const [activities, reviews] = await Promise.all([
        this.service.listActivities(startDate, endDate),
        this.service.listScheduledReviews(start, endExclusive),
      ]);
      this.activities = activities;
      this.scheduledReviews = reviews;
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Não foi possível carregar seu plano de estudos.';
    } finally {
      this.loading = false;
      this.changeDetector.markForCheck();
    }
  }

  setView(view: CalendarView) {
    this.view = view;
    void this.loadCalendar();
  }

  movePeriod(offset: -1 | 1) {
    if (this.view === 'month') {
      this.displayedDate = new Date(
        this.displayedDate.getFullYear(),
        this.displayedDate.getMonth() + offset,
        1,
      );
    } else if (this.view === 'week') {
      this.displayedDate = this.addDays(this.displayedDate, offset * 7);
    } else {
      this.displayedDate = this.addDays(this.displayedDate, offset);
    }
    this.selectedDate = this.formatDate(this.displayedDate);
    this.closeForm();
    void this.loadCalendar();
  }

  goToToday() {
    this.displayedDate = this.startOfDay(new Date());
    this.selectedDate = this.formatDate(this.displayedDate);
    this.closeForm();
    void this.loadCalendar();
  }

  selectDate(date: string) {
    this.selectedDate = date;
    this.displayedDate = this.parseDate(date);
    this.closeForm();
    this.updateCalendarDays();
  }

  openNewActivity() {
    this.editingId = '';
    this.formError = '';
    this.form = { ...this.emptyForm(), starts_on: this.selectedDate };
    this.formOpen = true;
  }

  editActivity(activity: StudyActivity) {
    this.editingId = activity.id;
    this.formError = '';
    this.form = {
      title: activity.title,
      activity_type: activity.activity_type,
      starts_on: activity.starts_on,
      start_time: activity.start_time?.slice(0, 5) ?? '',
      duration_minutes: activity.duration_minutes,
      lesson_reference: activity.lesson_reference ?? '',
    };
    this.formOpen = true;
  }

  closeForm() {
    this.formOpen = false;
    this.formError = '';
    this.editingId = '';
  }

  async saveActivity() {
    if (!this.form.title.trim() || !this.form.starts_on) {
      this.formError = 'Informe o nome e a data da atividade.';
      return;
    }
    if (
      this.form.duration_minutes !== null &&
      (!Number.isInteger(Number(this.form.duration_minutes)) ||
        Number(this.form.duration_minutes) < 1 ||
        Number(this.form.duration_minutes) > 1440)
    ) {
      this.formError = 'A duração deve ser um número entre 1 e 1440 minutos.';
      return;
    }

    const existing = this.activities.find((activity) => activity.id === this.editingId);
    const input: StudyActivityInput = {
      title: this.form.title.trim(),
      activity_type: this.form.activity_type,
      starts_on: this.form.starts_on,
      start_time: this.form.start_time || null,
      duration_minutes: this.form.duration_minutes ? Number(this.form.duration_minutes) : null,
      lesson_reference: this.form.lesson_reference.trim() || null,
      status: existing?.status ?? 'planned',
    };

    this.saving = true;
    this.formError = '';
    try {
      await this.service.saveActivity(input, this.editingId || undefined);
      this.selectedDate = input.starts_on;
      this.displayedDate = this.parseDate(input.starts_on);
      this.closeForm();
      await this.loadCalendar();
    } catch (error) {
      this.formError =
        error instanceof Error ? error.message : 'Não foi possível salvar a atividade.';
    } finally {
      this.saving = false;
      this.changeDetector.markForCheck();
    }
  }

  async completeActivity(activity: StudyActivity) {
    if (activity.activity_type === 'study_lesson') {
      this.completionActivity = activity;
      this.lessonSummary = '';
      this.learnerLevel = 'beginner';
      this.drafts = [];
      this.generationError = '';
      this.generationMessage = '';
      this.needsMoreContext = '';
      return;
    }

    await this.markActivityCompleted(activity);
  }

  async markActivityCompleted(activity: StudyActivity) {
    this.saving = true;
    this.errorMessage = '';
    try {
      await this.service.updateStatus(activity.id, 'completed');
      this.closeCompletionDialog();
      await this.loadCalendar();
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Não foi possível concluir a atividade.';
    } finally {
      this.saving = false;
      this.changeDetector.markForCheck();
    }
  }

  async generateFlashcards() {
    const summary = this.lessonSummary.trim();
    const characterCount = Array.from(summary).length;
    if (!summary || characterCount > 5000) {
      this.generationError = 'Informe um resumo com até 5.000 caracteres.';
      return;
    }
    if (!this.completionActivity) {
      return;
    }

    const activity = this.completionActivity;
    const source = activity.lesson_reference
      ? `${activity.lesson_reference} — ${activity.title}`
      : activity.title;
    this.generatingCards = true;
    this.generationError = '';
    this.generationMessage = '';
    this.needsMoreContext = '';
    this.drafts = [];

    try {
      const result = await this.flashcardGeneration.generate(summary, this.learnerLevel, source);
      if (result.needsMoreContext) {
        this.needsMoreContext = result.message;
      } else {
        this.drafts = result.cards.map((card, id) => ({ ...card, id, selected: true }));
      }
    } catch (error) {
      this.generationError =
        error instanceof Error
          ? error.message
          : 'Não foi possível gerar sugestões. Tente novamente mais tarde.';
    } finally {
      this.generatingCards = false;
      this.changeDetector.markForCheck();
    }
  }

  async saveSelectedDrafts() {
    const selected = this.drafts.filter((draft) => draft.selected);
    if (!selected.length || !this.selectedDraftsValid) {
      this.generationError = 'Selecione e complete pelo menos um rascunho antes de salvar.';
      return;
    }

    this.savingCards = true;
    this.generationError = '';
    this.generationMessage = '';
    try {
      await this.cardService.createCards(
        selected.map((draft) => ({
          english_text: draft.front,
          portuguese_text: draft.back,
          focus_word: draft.focus,
          category: draft.type,
          source: draft.source,
        })),
      );
      this.drafts = [];
      this.generationMessage = `${selected.length} ${selected.length === 1 ? 'card salvo' : 'cards salvos'} na sua coleção.`;
    } catch (error) {
      this.generationError =
        error instanceof Error ? error.message : 'Não foi possível salvar os cartões selecionados.';
    } finally {
      this.savingCards = false;
      this.changeDetector.markForCheck();
    }
  }

  removeDraft(id: number) {
    this.drafts = this.drafts.filter((draft) => draft.id !== id);
  }

  closeCompletionDialog() {
    if (this.generatingCards || this.savingCards || this.saving) {
      return;
    }
    this.completionActivity = null;
    this.lessonSummary = '';
    this.drafts = [];
    this.generationError = '';
    this.generationMessage = '';
    this.needsMoreContext = '';
  }

  get selectedDraftCount() {
    return this.drafts.filter((draft) => draft.selected).length;
  }

  get selectedDraftsValid() {
    const selected = this.drafts.filter((draft) => draft.selected);
    return (
      selected.length > 0 &&
      selected.every(
        (draft) =>
          draft.front.trim() &&
          draft.back.trim() &&
          draft.focus.trim() &&
          draft.front.length <= 500 &&
          draft.back.length <= 500 &&
          draft.focus.length <= 120,
      )
    );
  }

  activitiesOn(date: string) {
    return this.activities.filter((activity) => activity.starts_on === date);
  }

  reviewsOn(date: string) {
    return this.scheduledReviews.filter(
      (review) => this.formatDate(new Date(review.next_review_at)) === date,
    );
  }

  reviewTitles(date: string) {
    const reviews = this.reviewsOn(date);
    const titles = reviews
      .slice(0, 2)
      .map((review) => review.english_text)
      .join(' · ');
    return reviews.length > 2 ? `${titles} · +${reviews.length - 2} outros` : titles;
  }

  formatDateLabel(date: string) {
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(this.parseDate(date));
  }

  weekdayLong(date: string) {
    return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
      .format(this.parseDate(date))
      .replace('.', '');
  }

  activityTypeLabel(type: StudyActivityType) {
    return this.activityTypes.find((item) => item.value === type)?.label ?? 'Estudo';
  }

  activityIcon(type: StudyActivityType) {
    const icons: Record<StudyActivityType, string> = {
      study_lesson: '▤',
      flashcard_review: '◷',
      watch_video: '▶',
      write_english: '✎',
      conversation_class: '◌',
    };
    return icons[type];
  }

  statusLabel(status: StudyActivityStatus) {
    return status === 'completed' ? 'Concluída' : 'Planejada';
  }

  goToReview() {
    void this.router.navigate(['/review']);
  }

  private emptyForm(): ActivityForm {
    return {
      title: '',
      activity_type: 'study_lesson',
      starts_on: this.formatDate(new Date()),
      start_time: '',
      duration_minutes: null,
      lesson_reference: '',
    };
  }

  private visibleRange() {
    if (this.view === 'month') {
      const monthStart = new Date(
        this.displayedDate.getFullYear(),
        this.displayedDate.getMonth(),
        1,
      );
      const start = this.addDays(monthStart, -monthStart.getDay());
      const monthEnd = new Date(
        this.displayedDate.getFullYear(),
        this.displayedDate.getMonth() + 1,
        0,
      );
      const lastVisible = this.addDays(monthEnd, 6 - monthEnd.getDay());
      return { start, endExclusive: this.addDays(lastVisible, 1) };
    }

    if (this.view === 'week') {
      const start = this.addDays(this.displayedDate, -this.displayedDate.getDay());
      return { start, endExclusive: this.addDays(start, 7) };
    }

    return { start: this.displayedDate, endExclusive: this.addDays(this.displayedDate, 1) };
  }

  private updateCalendarDays() {
    this.periodLabel =
      this.view === 'day'
        ? this.formatDateLabel(this.selectedDate)
        : this.view === 'week'
          ? this.formatWeekLabel()
          : new Intl.DateTimeFormat('pt-BR', {
              month: 'long',
              year: 'numeric',
            }).format(this.displayedDate);

    const today = this.formatDate(new Date());
    if (this.view === 'month') {
      const first = new Date(this.displayedDate.getFullYear(), this.displayedDate.getMonth(), 1);
      const daysInMonth = new Date(
        this.displayedDate.getFullYear(),
        this.displayedDate.getMonth() + 1,
        0,
      ).getDate();
      this.monthDays = Array.from({ length: first.getDay() + daysInMonth }, (_, index) => {
        if (index < first.getDay()) return null;
        const dayNumber = index - first.getDay() + 1;
        const date = this.formatDate(
          new Date(this.displayedDate.getFullYear(), this.displayedDate.getMonth(), dayNumber),
        );
        return {
          date,
          dayNumber,
          isToday: date === today,
          isSelected: date === this.selectedDate,
        };
      });
    } else {
      this.monthDays = [];
    }

    const weekStart = this.addDays(this.displayedDate, -this.displayedDate.getDay());
    this.weekDays = Array.from({ length: 7 }, (_, index) => {
      const day = this.addDays(weekStart, index);
      const date = this.formatDate(day);
      return {
        date,
        dayNumber: day.getDate(),
        isToday: date === today,
        isSelected: date === this.selectedDate,
      };
    });
  }

  private startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private formatDate(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private parseDate(date: string) {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private formatWeekLabel() {
    const start = this.addDays(this.displayedDate, -this.displayedDate.getDay());
    const end = this.addDays(start, 6);
    const formatter = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
    const startLabel = formatter.format(start);
    const endLabel = formatter.format(end);

    return start.getFullYear() === end.getFullYear()
      ? `${startLabel} – ${endLabel} de ${end.getFullYear()}`
      : `${startLabel} de ${start.getFullYear()} – ${endLabel} de ${end.getFullYear()}`;
  }
}
