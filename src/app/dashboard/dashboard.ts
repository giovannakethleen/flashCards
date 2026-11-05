import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { CardService, type DailyActivity } from '../cards/card.service';

interface ActivityCell extends DailyActivity {
  level: number;
  title: string;
  isFuture: boolean;
  isToday: boolean;
  dayNumber: number;
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
                      [disabled]="day.isFuture"
                      (click)="selectActivityDay(day)"
                    >
                      {{ day.dayNumber }}
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
            </aside>
          </div>
        }
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
  selectedActivityLabel = '';
  activeDays = 0;
  monthTotals = { cardsAdded: 0, cardsStudied: 0, reviews: 0 };
  readonly weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  readonly todayLabel = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  constructor(
    private readonly router: Router,
    private readonly cardService: CardService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    void this.loadStats();
    void this.loadActivity();
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
      const activity = await this.cardService.getActivityCalendar(startDate, endDate, timeZone);
      this.activityDays = this.buildActivityDays(monthStart, activity, todayDate);
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
    if (day.isFuture) {
      return;
    }

    this.selectedActivityDate = day.date;
    this.selectedActivity = day;
    this.selectedActivityLabel = this.formatActivityLabel(day.date);
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
  ): Array<ActivityCell | null> {
    const activityByDate = new Map(activity.map((day) => [day.date, day]));
    const days: Array<ActivityCell | null> = Array(monthStart.getDay()).fill(null);
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();

    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
      const current = new Date(monthStart.getFullYear(), monthStart.getMonth(), dayNumber);
      const date = this.formatDate(current);
      const record = activityByDate.get(date) ?? {
        date,
        cardsAdded: 0,
        cardsStudied: 0,
        reviews: 0,
      };
      const total = record.cardsAdded + record.reviews;
      const level = total === 0 ? 0 : total === 1 ? 1 : total <= 3 ? 2 : total <= 6 ? 3 : 4;
      const isFuture = date > todayDate;
      const isToday = date === todayDate;
      const dayLabel = this.formatActivityLabel(date);
      const title =
        `${dayLabel}: ${record.cardsAdded} cards adicionados, ` +
        `${record.cardsStudied} cards estudados, ${record.reviews} revisões`;

      days.push({ ...record, level, title, isFuture, isToday, dayNumber });
    }

    return days;
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
