import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { CardService, type DailyActivity, type LearningInsights } from '../cards/card.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.html',
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
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit() {
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

  get studyNowCount() {
    if (this.statsLoading) {
      return 5;
    }
    return this.stats.dueToday
      ? Math.min(this.stats.dueToday, 5)
      : 5;
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
