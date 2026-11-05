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
  actual_duration_minutes: number | null;
  lesson_reference: string;
  plan_name: string;
}

function addActivity(
  activities: StudyActivityInput[],
  planName: string,
  date: string,
  title: string,
  activity_type: StudyActivityType,
  duration_minutes: number,
  lesson_reference: string | null = null,
  status: StudyActivityStatus = 'planned',
) {
  activities.push({
    title,
    activity_type,
    starts_on: date,
    start_time: null,
    duration_minutes,
    actual_duration_minutes: null,
    lesson_reference,
    plan_name: planName,
    status,
  });
}

function createLevelTwoSchedule(month: string, planName: string): StudyActivityInput[] {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const dayCount = new Date(year, monthNumber, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let lessonNumber = 0;
  const activities: StudyActivityInput[] = [];

  for (let day = 1; day <= dayCount; day += 1) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = new Date(year, monthNumber - 1, day).getDay();
    const status: StudyActivityStatus =
      new Date(year, monthNumber - 1, day) < today ? 'unrecorded' : 'planned';
    const lesson = () => {
      lessonNumber += 1;
      const source = `${planName} · Lição ${lessonNumber}`;
      addActivity(
        activities,
        planName,
        date,
        `Lição ${lessonNumber} — A1 Level 2`,
        'study_lesson',
        30,
        source,
        status,
      );
    };
    const add = (title: string, type: StudyActivityType, duration: number) =>
      addActivity(activities, planName, date, title, type, duration, null, status);
    const vocabulary = (title = 'Revisar vocabulário com flashcards', duration = 20) =>
      add(title, 'flashcard_review', duration);

    if (day === 1) {
      add('Assistir a vídeo em inglês', 'watch_video', 50);
      add('Escrever o que entendeu', 'write_english', 30);
      add('Corrigir e conferir o texto', 'write_english', 20);
      add('Resumir o vídeo em voz alta', 'conversation_class', 10);
      continue;
    }

    if (day === 8 || day === 22) {
      lesson();
      add('Revisar as lições da semana', 'study_lesson', 30);
      vocabulary('Revisar vocabulário da semana', 25);
      add('Revisar erros escritos', 'write_english', 25);
      add('Listening da semana', 'watch_video', 30);
      add('Speaking: resumo da semana', 'conversation_class', 20);
      continue;
    }

    if (day === 15) {
      lesson();
      add('Revisar as lições da semana', 'study_lesson', 30);
      vocabulary('Revisar vocabulário das semanas', 25);
      add('Revisar erros escritos', 'write_english', 25);
      add('Listening da semana', 'watch_video', 30);
      add('Speaking: resumo da semana', 'conversation_class', 20);
      add('Rever as semanas anteriores', 'study_lesson', 30);
      continue;
    }

    if (day === 29) {
      add('Revisar o mês', 'study_lesson', 30);
      add('Revisar erros recorrentes', 'write_english', 30);
      add('Listening sem legenda', 'watch_video', 45);
      add('Speaking: temas do mês', 'conversation_class', 30);
      add('Escrever retrospectiva em inglês', 'write_english', 30);
      continue;
    }

    if (day === 25) {
      lesson();
      lesson();
      add('Assistir a vídeo técnico em inglês', 'watch_video', 30);
      add('Resumir o conteúdo técnico', 'write_english', 30);
      add('Preparar apresentação profissional', 'write_english', 30);
      add('Praticar entrevista de emprego', 'conversation_class', 30);
      vocabulary('Revisar vocabulário profissional', 20);
      continue;
    }

    if (day === 30) {
      lesson();
      lesson();
      add('Assistir a vídeo em inglês', 'watch_video', 30);
      add('Escrever resumo final do mês', 'write_english', 30);
      add('Gravar áudio de retrospectiva', 'conversation_class', 20);
      add('Avaliar a evolução do mês', 'study_lesson', 20);
      vocabulary('Revisar vocabulário do mês', 20);
      continue;
    }

    if (dayOfWeek === 0) {
      lesson();
      add('Revisar as lições da semana', 'study_lesson', 30);
      vocabulary('Revisar vocabulário da semana', 30);
      add('Revisar erros escritos', 'write_english', 30);
      add('Listening em inglês', 'watch_video', 30);
      add('Speaking: resumo da semana', 'conversation_class', 20);
      continue;
    }

    lesson();
    lesson();
    switch (dayOfWeek) {
      case 1:
        add('Assistir a vídeo em inglês', 'watch_video', 30);
        add('Escrever resumo do vídeo', 'write_english', 30);
        add('Corrigir ou reescrever o resumo', 'write_english', 30);
        add('Speaking: contar o que estudou', 'conversation_class', 20);
        vocabulary();
        break;
      case 2:
        add('Aula coletiva de conversação', 'conversation_class', 60);
        add('Revisar erros da conversação', 'write_english', 30);
        add('Listening em inglês', 'watch_video', 30);
        vocabulary();
        break;
      case 3:
        add('Assistir a vídeo de tecnologia em inglês', 'watch_video', 30);
        add('Escrever resumo técnico', 'write_english', 30);
        add('Prática oral sobre trabalho', 'conversation_class', 30);
        vocabulary('Revisar vocabulário técnico', 20);
        add('Revisar conteúdo técnico', 'study_lesson', 20);
        break;
      case 4:
        add('Aula individual de conversação', 'conversation_class', 60);
        add('Revisar conteúdo da aula', 'study_lesson', 30);
        add('Listening em inglês', 'watch_video', 30);
        add('Registrar 5 a 10 frases', 'write_english', 20);
        break;
      case 5:
        add('Aula coletiva de conversação', 'conversation_class', 60);
        add('Assistir a vídeo no YouTube', 'watch_video', 30);
        add('Escrever resumo do vídeo', 'write_english', 30);
        vocabulary();
        break;
      case 6:
        add('Assistir a série ou vídeo em inglês', 'watch_video', 45);
        add('Leitura em inglês', 'study_lesson', 30);
        add('Escrever diário em inglês', 'write_english', 30);
        add('Speaking: narrar o dia', 'conversation_class', 20);
        vocabulary();
        break;
    }
  }

  return activities;
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
          <p class="intro">
            {{
              activePlanName || 'Planeje suas sessões e acompanhe as revisões que estão chegando.'
            }}
          </p>
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

      <section class="plan-generator" aria-label="Criar plano mensal">
        <p class="plan-guidance">
          Meta orientativa: cerca de 3h a 3h30 por dia, incluindo o curso. Ajuste, adie ou remova
          atividades sem restrições.
        </p>
        <label>
          Nome do plano
          <input
            type="text"
            [(ngModel)]="planName"
            [ngModelOptions]="{ standalone: true }"
            maxlength="120"
          />
        </label>
        <label>
          Mês do calendário
          <input type="month" [(ngModel)]="planMonth" [ngModelOptions]="{ standalone: true }" />
        </label>
        <button
          type="button"
          class="secondary-button"
          (click)="generateMonthlyPlan()"
          [disabled]="generatingPlan || deletingPlan || !planName.trim() || !planMonth"
        >
          {{ generatingPlan ? 'Criando plano...' : 'Criar plano mensal' }}
        </button>
        <button
          type="button"
          class="secondary-button delete-plan-button"
          (click)="deleteMonthlyPlan()"
          [disabled]="generatingPlan || deletingPlan || !planName.trim() || !planMonth"
        >
          {{ deletingPlan ? 'Excluindo plano...' : 'Excluir plano deste mês' }}
        </button>
        @if (planMessage) {
          <p class="plan-message" role="status">{{ planMessage }}</p>
        }
      </section>

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
                          [class]="
                            'month-activity status-' +
                            activity.status +
                            ' type-' +
                            activity.activity_type
                          "
                        >
                          {{ activity.title }} · {{ activity.duration_minutes ?? '—' }}m
                        </span>
                      }
                      @if (activitiesOn(day.date).length > 2) {
                        <span class="more-items">
                          +{{ activitiesOn(day.date).length - 2 }} mais
                        </span>
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
                    <span
                      class="week-activity"
                      [class]="
                        'week-activity status-' +
                        activity.status +
                        ' type-' +
                        activity.activity_type
                      "
                    >
                      {{ activity.start_time ? activity.start_time.slice(0, 5) + ' · ' : ''
                      }}{{ activity.title }} · {{ activity.duration_minutes ?? '—' }}m
                    </span>
                  }
                  @if (activitiesOn(day.date).length > 3) {
                    <span class="more-items"> +{{ activitiesOn(day.date).length - 3 }} mais </span>
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
            <span>Planejado: {{ selectedDayPlannedMinutes }} min</span>
            <span>Real: {{ selectedDayActualMinutes }} min</span>
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
              <article
                class="activity-card"
                [class.completed]="activity.status === 'completed'"
                [class.status-postponed]="activity.status === 'postponed'"
                [class.status-skipped]="activity.status === 'skipped'"
                [class.status-unrecorded]="activity.status === 'unrecorded'"
              >
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
                    @if (activity.actual_duration_minutes) {
                      <span> · Real: {{ activity.actual_duration_minutes }} min</span>
                    }
                  </p>
                  @if (activity.lesson_reference) {
                    <small>Lição: {{ activity.lesson_reference }}</small>
                  }
                </div>
                <div class="activity-actions">
                  @if (activity.status !== 'completed') {
                    <button
                      type="button"
                      class="complete-button"
                      (click)="changeActivityStatus(activity, 'completed')"
                      [disabled]="saving"
                    >
                      Concluir
                    </button>
                  } @else {
                    <span class="completed-label">Concluída</span>
                  }
                  <label class="status-control">
                    <span class="visually-hidden">Status da atividade</span>
                    <select
                      [ngModel]="activity.status"
                      [ngModelOptions]="{ standalone: true }"
                      (ngModelChange)="changeActivityStatus(activity, $event)"
                      [disabled]="saving"
                    >
                      @for (status of activityStatuses; track status.value) {
                        <option [value]="status.value">{{ status.label }}</option>
                      }
                    </select>
                  </label>
                  @if (activity.activity_type === 'flashcard_review') {
                    <button type="button" class="text-button" (click)="goToReview()">
                      Revisar cards
                    </button>
                  }
                  <button
                    type="button"
                    class="text-button"
                    (click)="goToFlashcardGeneration(activity)"
                  >
                    Gerar flashcards com IA
                  </button>
                  <button type="button" class="text-button" (click)="editActivity(activity)">
                    Editar
                  </button>
                  <button
                    type="button"
                    class="text-button delete-button"
                    (click)="deleteActivity(activity)"
                    [disabled]="saving"
                  >
                    <span aria-hidden="true">🗑</span> Excluir
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
            <div class="form-row">
              <label>
                Duração real em minutos <span class="optional">(opcional)</span>
                <input
                  type="number"
                  name="actual_duration_minutes"
                  [(ngModel)]="form.actual_duration_minutes"
                  min="1"
                  max="1440"
                  placeholder="Registrar depois"
                />
              </label>
              <label>
                Plano <span class="optional">(opcional)</span>
                <input
                  type="text"
                  name="plan_name"
                  [(ngModel)]="form.plan_name"
                  maxlength="120"
                  placeholder="A1 — Level 2"
                />
              </label>
            </div>
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

  view: CalendarView = 'week';
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
  planName = 'A1 — Level 2';
  planMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  planMessage = '';
  generatingPlan = false;
  deletingPlan = false;
  readonly activityStatuses: Array<{ value: StudyActivityStatus; label: string }> = [
    { value: 'planned', label: 'Planejada' },
    { value: 'completed', label: 'Concluída' },
    { value: 'postponed', label: 'Adiada' },
    { value: 'skipped', label: 'Não realizada' },
    { value: 'unrecorded', label: 'Ainda não registrada' },
  ];
  constructor(
    private readonly service: StudyPlanService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
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
      actual_duration_minutes: activity.actual_duration_minutes,
      lesson_reference: activity.lesson_reference ?? '',
      plan_name: activity.plan_name ?? '',
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
    if (
      this.form.actual_duration_minutes !== null &&
      (!Number.isInteger(Number(this.form.actual_duration_minutes)) ||
        Number(this.form.actual_duration_minutes) < 1 ||
        Number(this.form.actual_duration_minutes) > 1440)
    ) {
      this.formError = 'O tempo real deve ser um número entre 1 e 1440 minutos.';
      return;
    }

    const existing = this.activities.find((activity) => activity.id === this.editingId);
    const input: StudyActivityInput = {
      title: this.form.title.trim(),
      activity_type: this.form.activity_type,
      starts_on: this.form.starts_on,
      start_time: this.form.start_time || null,
      duration_minutes: this.form.duration_minutes ? Number(this.form.duration_minutes) : null,
      actual_duration_minutes: this.form.actual_duration_minutes
        ? Number(this.form.actual_duration_minutes)
        : null,
      lesson_reference: this.form.lesson_reference.trim() || null,
      plan_name: this.form.plan_name.trim() || null,
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

  goToFlashcardGeneration(activity: StudyActivity) {
    const source = activity.lesson_reference
      ? `${activity.lesson_reference} — ${activity.title}`
      : activity.title;
    void this.router.navigate(['/generate-cards'], { queryParams: { source } });
  }

  async changeActivityStatus(activity: StudyActivity, status: StudyActivityStatus) {
    if (activity.status === status) {
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    try {
      await this.service.updateStatus(activity.id, status);
      await this.loadCalendar();
      if (
        status === 'completed' &&
        window.confirm('Atividade concluída. Quer criar cartões a partir do seu resumo?')
      ) {
        this.goToFlashcardGeneration(activity);
      }
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Não foi possível atualizar o status.';
    } finally {
      this.saving = false;
      this.changeDetector.markForCheck();
    }
  }

  async generateMonthlyPlan() {
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(this.planMonth) ||
      !this.planName.trim() ||
      this.planName.trim().length > 120
    ) {
      this.planMessage = 'Informe um nome e um mês válidos para criar o plano.';
      return;
    }

    const [yearText, monthText] = this.planMonth.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const startDate = `${this.planMonth}-01`;
    const endDate = `${this.planMonth}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    const activities = createLevelTwoSchedule(this.planMonth, this.planName.trim());

    this.generatingPlan = true;
    this.planMessage = '';
    try {
      const created = await this.service.createMonthlyPlan(
        this.planName.trim(),
        startDate,
        endDate,
        activities,
      );
      if (!created) {
        this.planMessage =
          'Já existe um plano com esse nome neste mês. Edite as atividades existentes para evitar duplicatas.';
        return;
      }

      this.selectedDate = startDate;
      this.displayedDate = this.parseDate(startDate);
      this.view = 'month';
      this.planMessage = `${activities.length} atividades criadas para ${this.planMonth}. O plano é uma meta orientativa; ajuste o calendário como preferir.`;
      await this.loadCalendar();
    } catch (error) {
      this.planMessage =
        error instanceof Error ? error.message : 'Não foi possível criar o plano mensal.';
    } finally {
      this.generatingPlan = false;
      this.changeDetector.markForCheck();
    }
  }

  async deleteMonthlyPlan() {
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(this.planMonth) ||
      !this.planName.trim() ||
      this.planName.trim().length > 120
    ) {
      this.planMessage = 'Informe um nome e um mês válidos para excluir o plano.';
      return;
    }

    const [yearText, monthText] = this.planMonth.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const startDate = `${this.planMonth}-01`;
    const endDate = `${this.planMonth}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    const confirmed = window.confirm(
      `Excluir todas as atividades do plano “${this.planName.trim()}” de ${this.planMonth}? Esta ação não pode ser desfeita.`,
    );
    if (!confirmed) {
      return;
    }

    this.deletingPlan = true;
    this.planMessage = '';
    try {
      const deleted = await this.service.deleteMonthlyPlan(
        this.planName.trim(),
        startDate,
        endDate,
      );
      this.planMessage = deleted
        ? `${deleted} atividades foram excluídas do plano ${this.planName.trim()} em ${this.planMonth}.`
        : `Nenhuma atividade do plano ${this.planName.trim()} foi encontrada em ${this.planMonth}.`;
      await this.loadCalendar();
    } catch (error) {
      this.planMessage =
        error instanceof Error ? error.message : 'Não foi possível excluir o plano mensal.';
    } finally {
      this.deletingPlan = false;
      this.changeDetector.markForCheck();
    }
  }

  get activePlanName() {
    return this.activities.find((activity) => activity.plan_name)?.plan_name ?? '';
  }

  get selectedDayPlannedMinutes() {
    return this.activitiesOn(this.selectedDate).reduce(
      (total, activity) => total + (activity.duration_minutes ?? 0),
      0,
    );
  }

  get selectedDayActualMinutes() {
    return this.activitiesOn(this.selectedDate).reduce(
      (total, activity) => total + (activity.actual_duration_minutes ?? 0),
      0,
    );
  }

  async deleteActivity(activity: StudyActivity) {
    if (!window.confirm(`Excluir “${activity.title}” do calendário?`)) {
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    try {
      await this.service.deleteActivity(activity.id);
      await this.loadCalendar();
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Não foi possível excluir a atividade.';
    } finally {
      this.saving = false;
      this.changeDetector.markForCheck();
    }
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
    return (
      this.activityTypes.find((item) => item.value === type)?.label ??
      (type === 'flashcard_review' ? 'Revisar flashcards' : 'Estudo')
    );
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
    return this.activityStatuses.find((item) => item.value === status)?.label ?? 'Planejada';
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
      actual_duration_minutes: null,
      lesson_reference: '',
      plan_name: '',
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
