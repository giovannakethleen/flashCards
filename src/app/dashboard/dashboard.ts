import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { CardService, type DailyActivity } from '../cards/card.service';
import { StudyPlanService, type StudyActivity } from '../study-plan/study-plan.service';

interface ActivityCell extends DailyActivity {
  level: number;
  title: string;
  isFuture: boolean;
  isToday: boolean;
  dayNumber: number;
  plannedActivities: StudyActivity[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <section class="main-content">
      <div class="page-header">
        <div>
          <p class="date-label">{{ todayLabel }}</p>
        </div>
      </div>

      <section class="activity-section" aria-labelledby="activity-title">
        <div class="activity-heading">
          <div>
            <h1 id="activity-title">Seu ritmo de estudos</h1>
            <p>Uma visão diária do que você adicionou e praticou.</p>
          </div>
          @if (!activityLoading && !activityError) {
            <strong
              >{{ activeDays }} {{ activeDays === 1 ? 'dia ativo' : 'dias ativos' }} neste
              mês</strong
            >
          }
        </div>

        @if (activityError) {
          <div class="status-box error" role="alert">
            <span>{{ activityError }}</span>
            <button type="button" class="retry-button" (click)="loadActivity()">
              Tentar novamente
            </button>
          </div>
        } @else if (activityLoading) {
          <div class="activity-card activity-loading" role="status">
            Carregando seu calendário de estudos...
          </div>
        } @else {
          <div class="activity-card">
            <div class="month-calendar">
              <div class="month-navigation">
                <button
                  type="button"
                  class="month-arrow"
                  (click)="changeMonth(-1)"
                  aria-label="Mês anterior"
                >
                  ‹
                </button>
                <h2>{{ activityMonthLabel }}</h2>
                <button
                  type="button"
                  class="month-arrow"
                  (click)="changeMonth(1)"
                  [disabled]="!canGoToNextMonth"
                  aria-label="Próximo mês"
                >
                  ›
                </button>
              </div>
              <div class="weekday-names" aria-hidden="true">
                @for (weekday of weekdayNames; track weekday) {
                  <span>{{ weekday }}</span>
                }
              </div>
              <div
                class="calendar-days"
                role="group"
                [attr.aria-label]="'Calendário de atividade de ' + activityMonthLabel"
              >
                @for (day of activityDays; track $index) {
                  @if (day) {
                    <button
                      type="button"
                      class="activity-day"
                      [class.selected]="selectedActivityDate === day.date"
                      [class.today]="day.isToday"
                      [class.future]="day.isFuture"
                      [attr.data-level]="day.level"
                      [attr.aria-label]="day.title"
                      [attr.aria-pressed]="selectedActivityDate === day.date"
                      [attr.title]="day.title"
                      [disabled]="day.isFuture && !day.plannedActivities.length"
                      (click)="selectActivityDay(day)"
                    >
                      {{ day.dayNumber }}
                      @if (day.plannedActivities.length) {
                        <span class="planned-marker">
                          {{ day.plannedActivities.length }}
                        </span>
                      }
                    </button>
                  } @else {
                    <span class="calendar-empty" aria-hidden="true"></span>
                  }
                }
              </div>
              <div class="calendar-legend">
                <span>Menos atividade</span>
                <span class="legend-day" data-level="0"></span>
                <span class="legend-day" data-level="1"></span>
                <span class="legend-day" data-level="2"></span>
                <span class="legend-day" data-level="3"></span>
                <span class="legend-day" data-level="4"></span>
                <span>Mais</span>
              </div>
            </div>

            <aside class="activity-details">
              <div class="month-totals">
                <article class="month-stat">
                  <strong>{{ monthTotals.cardsAdded }}</strong>
                  <span>cards adicionados</span>
                </article>
                <article class="month-stat">
                  <strong>{{ monthTotals.cardsStudied }}</strong>
                  <span>cards estudados*</span>
                </article>
                <article class="month-stat">
                  <strong>{{ monthTotals.reviews }}</strong>
                  <span>revisões</span>
                </article>
              </div>

              <div class="selected-day">
                <h2>{{ selectedActivityLabel }}</h2>
                <div class="day-stats">
                  <p>
                    <strong>{{ selectedActivity.cardsAdded }}</strong
                    ><span>cards adicionados</span>
                  </p>
                  <p>
                    <strong>{{ selectedActivity.cardsStudied }}</strong
                    ><span>cards estudados</span>
                  </p>
                  <p>
                    <strong>{{ selectedActivity.reviews }}</strong
                    ><span>revisões feitas</span>
                  </p>
                </div>
              </div>
              <p class="activity-note">
                Selecione um dia para ver os detalhes. *No mês, cards estudados soma os cartões
                distintos praticados a cada dia.
              </p>
              @if (selectedPlannedActivities.length) {
                <div class="planned-day-list" aria-label="Atividades planejadas para este dia">
                  <h3>Plano do dia</h3>
                  @for (activity of selectedPlannedActivities; track activity.id) {
                    <article
                      class="planned-day-item"
                      [class.completed]="activity.status === 'completed'"
                    >
                      <span>
                        <strong>{{ activity.title }}</strong>
                        <small>
                          {{ activityTypeLabel(activity.activity_type) }} ·
                          {{ activityStatusLabel(activity.status) }}
                        </small>
                      </span>
                      @if (activity.status !== 'completed') {
                        <button
                          type="button"
                          class="complete-plan-button"
                          (click)="completePlannedActivity(activity)"
                          [disabled]="savingPlanActivity"
                        >
                          Concluir
                        </button>
                      } @else {
                        <span class="completed-plan-label">Concluída</span>
                      }
                    </article>
                  }
                  <button type="button" class="view-plan-button" (click)="goToStudyPlan()">
                    Abrir Meu plano
                  </button>
                </div>
              }
            </aside>
          </div>
        }
      </section>

      <section class="next-action" aria-labelledby="next-action-title">
        <div class="next-action-copy">
          <p class="next-action-eyebrow">PRÓXIMO PASSO</p>
          <h2 id="next-action-title">
            @if (statsLoading) {
              Carregando sua próxima atividade...
            } @else if (stats.dueToday) {
              Você tem {{ stats.dueToday }}
              {{ stats.dueToday === 1 ? 'cartão para revisar' : 'cartões para revisar' }}
            } @else {
              Nenhum cartão pendente para revisar
            }
          </h2>
          <p>
            Revisão rápida · cerca de
            {{ statsLoading ? '—' : estimatedReviewMinutes }} minutos
          </p>
          @if (!todayPlanLoading) {
            <p class="today-plan-summary">
              {{ todayPlanSummary }}
            </p>
          }
          @if (todayPlanError) {
            <p class="today-plan-error" role="status">{{ todayPlanError }}</p>
          }
        </div>
        <button type="button" class="next-action-button" (click)="goToReview()">
          {{ stats.dueToday ? 'Começar agora' : 'Abrir revisão' }}
        </button>
      </section>

      @if (statsError) {
        <div class="status-box error" role="alert">
          <span>{{ statsError }}</span>
          <button type="button" class="retry-button" (click)="loadStats()">Tentar novamente</button>
        </div>
      }

      <section class="overview">
        <div class="section-title">
          <div>
            <h2>Seu progresso</h2>
          </div>
          <span class="section-note">Resumo de hoje</span>
        </div>
        <div class="stats-grid" aria-label="Resumo de estudos">
          <article class="stat-card">
            <div class="stat-top">
              <span class="stat-icon blue" aria-hidden="true">▤</span
              ><span class="stat-caption">COLEÇÃO</span>
            </div>
            <strong>{{ statsLoading ? '—' : stats.totalCards }}</strong>
            <p>frases salvas</p>
            <button type="button" class="stat-link" (click)="goToCollection()">
              Ver coleção <span aria-hidden="true">↗</span>
            </button>
          </article>
          <article class="stat-card due-card">
            <div class="stat-top">
              <span class="stat-icon cyan" aria-hidden="true">◷</span
              ><span class="stat-caption">NA FILA</span>
            </div>
            <strong>{{ statsLoading ? '—' : stats.dueToday }}</strong>
            <p>para revisar agora</p>
            <button type="button" class="stat-link" (click)="goToReview()">
              Revisar frases <span aria-hidden="true">↗</span>
            </button>
          </article>
          <article class="stat-card">
            <div class="stat-top">
              <span class="stat-icon purple" aria-hidden="true">✓</span
              ><span class="stat-caption">CONQUISTA DE HOJE</span>
            </div>
            <strong>{{ statsLoading ? '—' : stats.reviewedToday }}</strong>
            <p>já revisadas hoje</p>
            <span class="stat-footnote">Cada revisão conta.</span>
          </article>
        </div>
      </section>

      <section class="tools-section">
        <div class="section-title">
          <div>
            <h2>Atalhos rápidos</h2>
          </div>
          <span class="section-note">Organize seu aprendizado</span>
        </div>
        <div class="tools-grid">
          <button type="button" class="tool-card create-tool" (click)="goToQuickCard()">
            <span class="tool-icon">＋</span>
            <span class="tool-copy"
              ><strong>Nova frase</strong><small>Guarde uma expressão que encontrou</small></span
            >
            <span class="tool-arrow">↗</span>
          </button>
          <button type="button" class="tool-card" (click)="goToCollection()">
            <span class="tool-icon collection-tool-icon">⌕</span>
            <span class="tool-copy"
              ><strong>Explorar coleção</strong
              ><small>Encontre e organize seus cartões</small></span
            >
            <span class="tool-arrow">↗</span>
          </button>
        </div>
      </section>

      <section class="backup-strip">
        <div class="backup-symbol" aria-hidden="true">↕</div>
        <div class="backup-copy">
          <strong>Backup e portabilidade</strong
          ><small>Seus cartões também podem ser guardados em um arquivo JSON.</small>
        </div>
        <button type="button" class="backup-button" (click)="exportJson()">Exportar</button>
        <button type="button" class="backup-button" (click)="triggerImport()">Importar</button>
      </section>

      <input
        id="jsonInput"
        type="file"
        accept="application/json"
        hidden
        (change)="handleImport($event)"
      />
      @if (statusMessage) {
        <div class="status-box" role="status">{{ statusMessage }}</div>
      }
    </section>
  `,
})
export class DashboardComponent implements OnInit {
  statusMessage = '';
  statsError = '';
  statsLoading = true;
  stats = { totalCards: 0, dueToday: 0, reviewedToday: 0 };
  activityLoading = true;
  activityError = '';
  activityDays: Array<ActivityCell | null> = [];
  displayedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  activityMonthLabel = '';
  selectedActivityDate = '';
  selectedActivity: DailyActivity = { date: '', cardsAdded: 0, cardsStudied: 0, reviews: 0 };
  selectedPlannedActivities: StudyActivity[] = [];
  dailyPlanActivities: StudyActivity[] = [];
  private plannedActivities: StudyActivity[] = [];
  selectedActivityLabel = '';
  activeDays = 0;
  monthTotals = { cardsAdded: 0, cardsStudied: 0, reviews: 0 };
  todayPlanLoading = true;
  todayPlanError = '';
  savingPlanActivity = false;
  readonly weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  readonly todayLabel = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  constructor(
    private readonly router: Router,
    private readonly cardService: CardService,
    private readonly studyPlanService: StudyPlanService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    void this.loadStats();
    void this.loadActivity();
    void this.loadTodayPlan();
  }

  async loadActivity() {
    this.activityLoading = true;
    this.activityError = '';

    try {
      const today = new Date();
      const todayDate = this.formatDate(today);
      const monthStart = new Date(
        this.displayedMonth.getFullYear(),
        this.displayedMonth.getMonth(),
        1,
      );
      const startDate = this.formatDate(monthStart);
      const endDate = this.formatDate(
        new Date(this.displayedMonth.getFullYear(), this.displayedMonth.getMonth() + 1, 0),
      );
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const [activity, plannedActivities] = await Promise.all([
        this.cardService.getActivityCalendar(startDate, endDate, timeZone),
        this.studyPlanService.listActivities(startDate, endDate),
      ]);
      this.plannedActivities = plannedActivities;
      this.activityDays = this.buildActivityDays(monthStart, activity, todayDate, plannedActivities);
      this.activeDays = activity.filter((day) => day.cardsAdded + day.reviews > 0).length;
      this.monthTotals = activity.reduce(
        (totals, day) => ({
          cardsAdded: totals.cardsAdded + day.cardsAdded,
          cardsStudied: totals.cardsStudied + day.cardsStudied,
          reviews: totals.reviews + day.reviews,
        }),
        { cardsAdded: 0, cardsStudied: 0, reviews: 0 },
      );
      this.activityMonthLabel = new Intl.DateTimeFormat('pt-BR', {
        month: 'long',
        year: 'numeric',
      }).format(monthStart);
      const retainedDate =
        this.selectedActivityDate >= startDate && this.selectedActivityDate <= endDate
          ? this.selectedActivityDate
          : todayDate >= startDate && todayDate <= endDate
            ? todayDate
            : startDate;
      const selectedDay = this.activityDays.find((day) => day?.date === retainedDate);
      if (selectedDay) {
        this.selectActivityDay(selectedDay);
      }
    } catch (error) {
      this.activityError =
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar o calendário de atividade.';
    } finally {
      this.activityLoading = false;
      this.changeDetector.markForCheck();
    }
  }

  selectActivityDay(day: ActivityCell) {
    if (day.isFuture && !day.plannedActivities.length) {
      return;
    }

    this.selectedActivityDate = day.date;
    this.selectedActivity = day;
    this.selectedPlannedActivities = day.plannedActivities;
    this.selectedActivityLabel = this.formatActivityLabel(day.date);
  }

  async loadTodayPlan() {
    this.todayPlanLoading = true;
    this.todayPlanError = '';
    const todayDate = this.formatDate(new Date());
    try {
      this.dailyPlanActivities = await this.studyPlanService.listActivities(todayDate, todayDate);
    } catch (error) {
      this.todayPlanError =
        error instanceof Error ? error.message : 'Não foi possível carregar o plano de hoje.';
    } finally {
      this.todayPlanLoading = false;
      this.changeDetector.markForCheck();
    }
  }

  async completePlannedActivity(activity: StudyActivity) {
    if (this.savingPlanActivity) {
      return;
    }
    this.savingPlanActivity = true;
    this.todayPlanError = '';
    try {
      await this.studyPlanService.updateStatus(activity.id, 'completed');
      await Promise.all([this.loadActivity(), this.loadTodayPlan()]);
      if (window.confirm('Atividade concluída. Quer criar cartões a partir do seu resumo?')) {
        this.goToFlashcardGeneration(activity);
      }
    } catch (error) {
      this.todayPlanError =
        error instanceof Error ? error.message : 'Não foi possível concluir a atividade.';
    } finally {
      this.savingPlanActivity = false;
      this.changeDetector.markForCheck();
    }
  }

  goToFlashcardGeneration(activity: StudyActivity) {
    const source = activity.lesson_reference
      ? `${activity.lesson_reference} — ${activity.title}`
      : activity.title;
    void this.router.navigate(['/generate-cards'], { queryParams: { source } });
  }

  goToStudyPlan() {
    void this.router.navigate(['/study-plan']);
  }

  get estimatedReviewMinutes() {
    return this.stats.dueToday === 0 ? 0 : Math.max(1, Math.ceil(this.stats.dueToday * 0.6));
  }

  get todayPlanSummary() {
    const pending = this.dailyPlanActivities.filter(
      (activity) => activity.status === 'planned' || activity.status === 'unrecorded',
    );
    if (!pending.length) {
      return 'Plano de hoje em dia — nenhuma atividade pendente.';
    }

    const counts = [
      { type: 'study_lesson', singular: 'lição', plural: 'lições' },
      { type: 'watch_video', singular: 'vídeo', plural: 'vídeos' },
      { type: 'write_english', singular: 'resumo', plural: 'resumos' },
      { type: 'conversation_class', singular: 'conversa', plural: 'conversas' },
      { type: 'flashcard_review', singular: 'revisão', plural: 'revisões' },
    ]
      .map(({ type, singular, plural }) => {
        const count = pending.filter((activity) => activity.activity_type === type).length;
        return count ? `${count} ${count === 1 ? singular : plural}` : '';
      })
      .filter(Boolean);

    return `${counts.join(', ')} pendentes no plano de hoje.`;
  }

  get canGoToNextMonth() {
    const now = new Date();
    return (
      this.displayedMonth.getFullYear() < now.getFullYear() ||
      (this.displayedMonth.getFullYear() === now.getFullYear() &&
        this.displayedMonth.getMonth() < now.getMonth())
    );
  }

  changeMonth(offset: -1 | 1) {
    this.displayedMonth = new Date(
      this.displayedMonth.getFullYear(),
      this.displayedMonth.getMonth() + offset,
      1,
    );
    this.selectedActivityDate = '';
    this.selectedActivity = { date: '', cardsAdded: 0, cardsStudied: 0, reviews: 0 };
    this.selectedPlannedActivities = [];
    void this.loadActivity();
  }

  async loadStats() {
    this.statsLoading = true;
    this.statsError = '';

    try {
      this.stats = await this.cardService.getDashboardStats();
    } catch (error) {
      this.statsError =
        error instanceof Error ? error.message : 'Não foi possível carregar o resumo de estudos.';
    } finally {
      this.statsLoading = false;
      this.changeDetector.markForCheck();
    }
  }

  goToQuickCard() {
    void this.router.navigate(['/cards/new']);
  }

  goToCollection() {
    void this.router.navigate(['/cards']);
  }

  goToReview() {
    void this.router.navigate(['/review']);
  }

  private buildActivityDays(
    monthStart: Date,
    activity: DailyActivity[],
    todayDate: string,
    plannedActivities: StudyActivity[],
  ): Array<ActivityCell | null> {
    const activityByDate = new Map(activity.map((day) => [day.date, day]));
    const plansByDate = new Map<string, StudyActivity[]>();
    for (const planActivity of plannedActivities) {
      const dayActivities = plansByDate.get(planActivity.starts_on) ?? [];
      dayActivities.push(planActivity);
      plansByDate.set(planActivity.starts_on, dayActivities);
    }
    const days: Array<ActivityCell | null> = Array(monthStart.getDay()).fill(null);
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();

    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
      const current = new Date(monthStart.getFullYear(), monthStart.getMonth(), dayNumber);
      const date = this.formatDate(current);
      const dayPlans = plansByDate.get(date) ?? [];
      const record = activityByDate.get(date) ?? {
        date,
        cardsAdded: 0,
        cardsStudied: 0,
        reviews: 0,
      };
      const total = record.cardsAdded + record.reviews + dayPlans.length;
      const level = total === 0 ? 0 : total === 1 ? 1 : total <= 3 ? 2 : total <= 6 ? 3 : 4;
      const isFuture = date > todayDate;
      const isToday = date === todayDate;
      const dayLabel = this.formatActivityLabel(date);
      const title =
        `${dayLabel}: ${record.cardsAdded} cards adicionados, ` +
        `${record.cardsStudied} cards estudados, ${record.reviews} revisões, ` +
        `${dayPlans.length} atividades planejadas`;

      days.push({
        ...record,
        level,
        title,
        isFuture,
        isToday,
        dayNumber,
        plannedActivities: dayPlans,
      });
    }

    return days;
  }

  activityTypeLabel(type: StudyActivity['activity_type']) {
    const labels: Record<StudyActivity['activity_type'], string> = {
      study_lesson: 'Aula',
      flashcard_review: 'Revisão',
      watch_video: 'Vídeo',
      write_english: 'Escrita',
      conversation_class: 'Conversação',
    };
    return labels[type];
  }

  activityStatusLabel(status: StudyActivity['status']) {
    return status === 'completed' ? 'Concluída' : status === 'planned' ? 'Planejada' : 'Pendente';
  }

  private formatDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatActivityLabel(date: string) {
    const [year, month, day] = date.split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(year, month - 1, day));
  }

  async exportJson() {
    try {
      const json = await this.cardService.exportJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'flashcards-export.json';
      link.click();
      URL.revokeObjectURL(url);
      this.statusMessage = 'Exportação concluída. O arquivo foi gerado em JSON.';
    } catch (error) {
      this.statusMessage =
        error instanceof Error ? error.message : 'Não foi possível exportar os cartões.';
    }
  }

  triggerImport() {
    document.querySelector<HTMLInputElement>('#jsonInput')?.click();
  }

  async handleImport(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    try {
      const mode = window.confirm('Deseja substituir os cartões existentes pela importação?');
      const importedCount = await this.cardService.importJson(file, mode ? 'replace' : 'merge');
      this.statusMessage = `Importação concluída: ${importedCount} cartão(es) salvos.`;
      await this.loadStats();
    } catch (error) {
      this.statusMessage =
        error instanceof Error ? error.message : 'Não foi possível importar os cartões.';
    } finally {
      input.value = '';
    }
  }
}
