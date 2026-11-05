import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { CardService, type DailyActivity, type LearningInsights } from '../cards/card.service';
import { AuthService } from '../core/auth.service';

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

      <section class="home-study" aria-labelledby="home-study-title">
        <div class="home-study-heading">
          <div>
            <p class="next-action-eyebrow">SEU PRÓXIMO PASSO</p>
            <h1 id="home-study-title">Seu ritmo de estudos</h1>
          </div>
          <button type="button" class="next-action-button" (click)="goToStudyNow()">
            Estudar agora · {{ studyNowCount }}
            {{ studyNowCount === 1 ? 'cartão' : 'cartões' }}
          </button>
        </div>
        <div class="daily-goal">
          <div
            class="goal-ring"
            [style.background]="goalRingBackground"
            role="progressbar"
            [attr.aria-valuenow]="goalProgress"
            [attr.aria-valuemin]="0"
            [attr.aria-valuemax]="dailyGoal"
            [attr.aria-label]="'Meta diária: ' + goalProgress + ' de ' + dailyGoal + ' cartões'"
          >
            <span>{{ goalProgress }}/{{ dailyGoal }}</span>
          </div>
          <label class="goal-setting">
            Meta diária
            <span>
              <input
                type="number"
                min="1"
                max="100"
                [value]="dailyGoal"
                (change)="updateDailyGoal($event)"
                aria-label="Quantidade de cartões da meta diária"
              />
              cartões
            </span>
          </label>
          @if (dailyGoalError) {
            <p class="goal-error" role="alert">{{ dailyGoalError }}</p>
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
          <p class="home-loading" role="status">Carregando seu resumo de estudos...</p>
        } @else {
          <div class="home-week">
            <div class="home-week-heading">
              <h2>Últimos 7 dias</h2>
              <strong>{{ streakDays }} {{ streakDays === 1 ? 'dia seguido' : 'dias seguidos' }}</strong>
            </div>
            <p class="streak-reminder">{{ streakReminder }}</p>
            <div class="home-week-dots" aria-label="Atividade dos últimos sete dias">
              @for (day of weeklyActivity; track day.date) {
                <div class="home-week-day">
                  <span
                    class="home-week-dot"
                    [attr.data-level]="day.level"
                    [attr.title]="day.label + ': ' + day.count + ' revisões'"
                    [attr.aria-label]="day.label + ': ' + day.count + ' revisões'"
                    role="img"
                  ></span>
                  <small>{{ day.weekday }}</small>
                </div>
              }
            </div>
          </div>
          <div class="home-month-totals" aria-label="Resumo deste mês">
            <h2>Este mês</h2>
            <article>
              <strong>{{ monthTotals.cardsAdded }}</strong>
              <span>adicionados</span>
            </article>
            <article>
              <strong>{{ monthTotals.cardsStudied }}</strong>
              <span>estudados</span>
            </article>
            <article>
              <strong>{{ monthTotals.reviews }}</strong>
              <span>revisões</span>
            </article>
          </div>
        }
        <button type="button" class="calendar-link" (click)="goToStudyPlan()">
          Ver calendário completo <span aria-hidden="true">→</span>
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

      <section class="learning-insights" aria-labelledby="insights-title">
        <div class="section-title">
          <div>
            <h2 id="insights-title">Estatísticas de aprendizagem</h2>
            <p>Seu aproveitamento, ritmo semanal e cartões que merecem mais atenção.</p>
          </div>
        </div>
        @if (insightsError) {
          <div class="status-box error" role="alert">
            <span>{{ insightsError }}</span>
            <button type="button" class="retry-button" (click)="loadLearningInsights()">
              Tentar novamente
            </button>
          </div>
        } @else if (insightsLoading) {
          <div class="insights-card" role="status">Carregando suas estatísticas...</div>
        } @else {
          <div class="insights-grid">
            <article class="accuracy-card">
              <span>Taxa de acerto</span>
              <strong>{{ learningInsights.accuracy === null ? '—' : learningInsights.accuracy + '%' }}</strong>
              <small>
                {{ learningInsights.accuracy === null
                  ? 'Aparecerá depois da primeira revisão'
                  : 'Em ' + learningInsights.reviewCount + ' revisões registradas' }}
              </small>
            </article>

            <section class="insights-card weekly-progress" aria-labelledby="weekly-progress-title">
              <h3 id="weekly-progress-title">Evolução por semana · últimas 8 semanas</h3>
              <div class="weekly-progress-bars">
                @for (week of learningInsights.weeklyProgress; track week.weekStart) {
                  <div class="weekly-progress-column">
                    <span class="weekly-progress-count">{{ week.reviews }}</span>
                    <span
                      class="weekly-progress-bar"
                      [style.height.%]="weeklyBarHeight(week.reviews)"
                      [attr.title]="week.label + ': ' + week.reviews + ' revisões'"
                    ></span>
                    <span class="weekly-progress-label">{{ week.label }}</span>
                    <small>{{ week.accuracy === null ? '—' : week.accuracy + '%' }}</small>
                  </div>
                }
              </div>
              <p>Revisões por semana; a porcentagem indica a taxa de acerto daquela semana.</p>
            </section>

            <section class="insights-card difficult-list" aria-labelledby="difficult-title">
              <div class="difficult-heading">
                <h3 id="difficult-title">Cartões mais difíceis</h3>
                <button
                  type="button"
                  class="difficult-review-button"
                  (click)="goToDifficultReview()"
                  [disabled]="!learningInsights.difficultCards.length"
                >
                  Revisar difíceis
                </button>
              </div>
              @if (learningInsights.difficultCards.length) {
                @for (card of learningInsights.difficultCards; track card.id) {
                  <article class="difficult-card">
                    <span>
                      <strong>{{ card.english_text }}</strong>
                      <small>{{ card.portuguese_text }}</small>
                    </span>
                    <small>{{ card.mistake_count }} {{ card.mistake_count === 1 ? 'erro' : 'erros' }}</small>
                  </article>
                }
              } @else {
                <p class="no-difficult-cards">Nenhum erro registrado ainda. Continue praticando!</p>
              }
            </section>
          </div>
        }
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
  monthTotals = { cardsAdded: 0, cardsStudied: 0, reviews: 0 };
  weeklyActivity: Array<{
    date: string;
    label: string;
    weekday: string;
    count: number;
    level: number;
  }> = [];
  learningInsights: LearningInsights = {
    accuracy: null,
    reviewCount: 0,
    difficultCards: [],
    weeklyProgress: [],
  };
  insightsLoading = true;
  insightsError = '';
  dailyGoal = 5;
  dailyGoalError = '';
  streakDays = 0;
  readonly Math = Math;

  readonly todayLabel = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  constructor(
    private readonly router: Router,
    private readonly cardService: CardService,
    private readonly auth: AuthService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    void this.loadDailyGoal();
    void this.loadStats();
    void this.loadActivity();
    void this.loadLearningInsights();
  }

  async loadActivity() {
    this.activityLoading = true;
    this.activityError = '';

    try {
      const today = new Date();
      const todayDate = this.formatDate(today);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const startDate = this.formatDate(monthStart);
      const endDate = this.formatDate(
        new Date(today.getFullYear(), today.getMonth() + 1, 0),
      );
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 6);
      const yearStart = new Date(today);
      yearStart.setDate(yearStart.getDate() - 364);
      const yearStartDate = this.formatDate(yearStart);
      const activity = await this.cardService.getActivityCalendar(
        yearStartDate,
        todayDate,
        timeZone,
      );
      this.streakDays = this.calculateStreak(activity, todayDate);
      this.weeklyActivity = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + index);
        const isoDate = this.formatDate(date);
        const item = activity.find((day) => day.date === isoDate);
        const total = item ? item.cardsAdded + item.cardsStudied + item.reviews : 0;
        return {
          date: isoDate,
          label: new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(date),
          weekday: new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
            .format(date)
            .replace('.', ''),
          count: item?.reviews ?? 0,
          level: total === 0 ? 0 : total === 1 ? 1 : total <= 3 ? 2 : total <= 6 ? 3 : 4,
        };
      });
      this.monthTotals = activity.filter((day) => day.date >= startDate && day.date <= endDate).reduce(
        (totals, day) => ({
          cardsAdded: totals.cardsAdded + day.cardsAdded,
          cardsStudied: totals.cardsStudied + day.cardsStudied,
          reviews: totals.reviews + day.reviews,
        }),
        { cardsAdded: 0, cardsStudied: 0, reviews: 0 },
      );
    } catch (error) {
      this.activityError =
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar seu resumo de estudos.';
    } finally {
      this.activityLoading = false;
      this.changeDetector.markForCheck();
    }
  }

  goToStudyPlan() {
    void this.router.navigate(['/study-plan']);
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

  async loadLearningInsights() {
    this.insightsLoading = true;
    this.insightsError = '';

    try {
      this.learningInsights = await this.cardService.getLearningInsights();
    } catch (error) {
      this.insightsError =
        error instanceof Error ? error.message : 'Não foi possível carregar suas estatísticas.';
    } finally {
      this.insightsLoading = false;
      this.changeDetector.markForCheck();
    }
  }

  weeklyBarHeight(count: number) {
    const maximum = Math.max(1, ...this.learningInsights.weeklyProgress.map((week) => week.reviews));
    return count ? Math.max(8, (count / maximum) * 100) : 3;
  }

  get goalProgress() {
    return Math.min(this.stats.reviewedToday, this.dailyGoal);
  }

  get goalRingBackground() {
    const progress = this.statsLoading ? 0 : (this.goalProgress / this.dailyGoal) * 100;
    return `conic-gradient(#34d399 ${progress}%, rgba(148, 163, 184, 0.2) ${progress}% 100%)`;
  }

  get studyNowCount() {
    if (this.statsLoading) {
      return this.dailyGoal;
    }
    return this.stats.dueToday
      ? Math.min(this.stats.dueToday, this.dailyGoal)
      : this.dailyGoal;
  }

  get streakReminder() {
    if (this.stats.reviewedToday > 0) {
      return 'Boa! Você já praticou hoje. Continue no seu ritmo para manter a sequência.';
    }
    if (this.streakDays > 0) {
      return `Sua sequência de ${this.streakDays} ${this.streakDays === 1 ? 'dia está' : 'dias está'} viva. Uma revisão hoje mantém o ritmo!`;
    }
    return 'Um cartão hoje já é um ótimo começo. Que tal estudar um pouquinho?';
  }

  goToStudyNow() {
    void this.router.navigate(['/review'], {
      queryParams: { limit: this.studyNowCount, all: this.stats.dueToday === 0 },
    });
  }

  goToDifficultReview() {
    void this.router.navigate(['/review'], { queryParams: { difficult: 'true' } });
  }

  async updateDailyGoal(event: Event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const goal = Number(input.value);
    if (!Number.isInteger(goal) || goal < 1 || goal > 100) {
      this.dailyGoalError = 'Escolha uma meta entre 1 e 100 cartões.';
      input.value = String(this.dailyGoal);
      return;
    }

    try {
      const { data } = await this.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) {
        throw new Error('Não foi possível identificar sua conta para salvar a meta.');
      }
      window.localStorage.setItem(`flashcards-daily-goal-${userId}`, String(goal));
      this.dailyGoal = goal;
      this.dailyGoalError = '';
    } catch (error) {
      this.dailyGoalError =
        error instanceof Error ? error.message : 'Não foi possível salvar sua meta diária.';
      input.value = String(this.dailyGoal);
    } finally {
      this.changeDetector.markForCheck();
    }
  }

  private async loadDailyGoal() {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const { data } = await this.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) {
        return;
      }
      const storedGoal = window.localStorage.getItem(`flashcards-daily-goal-${userId}`);
      if (storedGoal === null) {
        return;
      }
      const goal = Number(storedGoal);
      if (Number.isInteger(goal) && goal >= 1 && goal <= 100) {
        this.dailyGoal = goal;
      } else {
        this.dailyGoalError = 'A meta salva é inválida. Escolha um novo valor entre 1 e 100.';
      }
    } catch {
      this.dailyGoalError = 'Não foi possível ler sua meta diária neste navegador.';
    } finally {
      this.changeDetector.markForCheck();
    }
  }

  private calculateStreak(activity: DailyActivity[], todayDate: string) {
    const activeDates = new Set(
      activity.filter((day) => day.reviews > 0).map((day) => day.date),
    );
    const today = new Date();
    const startOffset = activeDates.has(todayDate) ? 0 : 1;
    let streak = 0;

    for (let offset = startOffset; offset < activity.length + startOffset; offset += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      if (!activeDates.has(this.formatDate(date))) {
        break;
      }
      streak += 1;
    }

    return streak;
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

  private formatDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
