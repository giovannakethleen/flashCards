import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { CardService, type FlashcardRecord } from '../cards/card.service';
import { PronunciationPracticeComponent } from '../cards/pronunciation-practice';
import { SpeechService, type EnglishLocale } from '../core/speech.service';

@Component({
  selector: 'app-review',
  standalone: true,
  templateUrl: './review.html',
  styleUrl: './review.scss',
  imports: [FormsModule, PronunciationPracticeComponent],
})
export class ReviewComponent implements OnInit {
  cards: FlashcardRecord[] = [];
  currentIndex = 0;
  currentCard: FlashcardRecord | null = null;
  sessionTotal = 0;
  reviewedCount = 0;
  correctCount = 0;
  sessionComplete = false;
  private sessionStartedAt = 0;
  private nextReviewAt: Date | null = null;
  showAnswer = false;
  isLoading = true;
  voiceLocale: EnglishLocale = 'en-US';
  speechMessage = '';
  difficultOnly = false;
  private loadAllCards = false;
  private reviewLimit = 5;
  errorMessage = '';
  feedbackMessage = '';
  isSaving = false;

  constructor(
    private readonly cardService: CardService,
    public readonly speech: SpeechService,
    private readonly route: ActivatedRoute,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.difficultOnly = this.route.snapshot.queryParamMap.get('difficult') === 'true';
    this.loadAllCards = this.route.snapshot.queryParamMap.get('all') === 'true';
    const requestedLimit = Number(this.route.snapshot.queryParamMap.get('limit'));
    if (Number.isInteger(requestedLimit) && requestedLimit >= 1 && requestedLimit <= 100) {
      this.reviewLimit = requestedLimit;
    }
    void this.loadCards();
  }

  async loadCards() {
    this.isLoading = true;
    this.errorMessage = '';
    this.feedbackMessage = '';

    try {
      const loadedCards = this.difficultOnly
        ? await this.cardService.getDifficultCards(this.reviewLimit)
        : this.loadAllCards
          ? await this.cardService.getAllCards()
          : await this.cardService.getDueCards();
      this.cards = loadedCards.slice(0, this.reviewLimit);
      this.currentIndex = 0;
      this.currentCard = this.cards[0] ?? null;
      this.resetSession(this.cards.length);
    } catch (error) {
      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar os cartões para revisão.';
    } finally {
      this.isLoading = false;
      this.changeDetector.markForCheck();
    }
  }

  async startNewReview() {
    this.isLoading = true;
    this.errorMessage = '';
    this.feedbackMessage = '';
    this.showAnswer = false;

    try {
      const loadedCards = this.difficultOnly
        ? await this.cardService.getDifficultCards(this.reviewLimit)
        : await this.cardService.getAllCards();
      this.cards = loadedCards.slice(0, this.reviewLimit);
      this.currentIndex = 0;
      this.currentCard = this.cards[0] ?? null;
      this.resetSession(this.cards.length);
    } catch (error) {
      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar os cartões para uma nova revisão.';
      this.currentCard = null;
    } finally {
      this.isLoading = false;
      this.changeDetector.markForCheck();
    }
  }

  speakEnglish() {
    if (!this.currentCard) {
      return;
    }

    this.speechMessage = '';
    const started = this.speech.speak(this.currentCard.english_text, this.voiceLocale, () => {
      this.speechMessage = 'Não foi possível reproduzir o áudio. Tente novamente.';
    });

    if (!started) {
      this.speechMessage = 'A reprodução de voz não está disponível neste navegador.';
    }
  }

  toggleAnswer() {
    this.showAnswer = !this.showAnswer;
  }

  get remainingCards() {
    return this.cards.length;
  }

  get currentCardNumber() {
    return this.sessionTotal - this.remainingCards + 1;
  }

  get progressPercent() {
    return this.sessionTotal ? (this.reviewedCount / this.sessionTotal) * 100 : 0;
  }

  get elapsedLabel() {
    const seconds = Math.max(0, Math.floor((Date.now() - this.sessionStartedAt) / 1000));
    const minutes = Math.floor(seconds / 60);
    return minutes ? `${minutes} min ${seconds % 60}s` : `${seconds}s`;
  }

  get nextReviewLabel() {
    return this.nextReviewAt
      ? new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(this.nextReviewAt)
      : '—';
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent) {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    ) {
      return;
    }

    if (event.code === 'Space' && this.currentCard) {
      if (target instanceof HTMLButtonElement) {
        return;
      }
      event.preventDefault();
      this.toggleAnswer();
      return;
    }

    if (this.showAnswer && !this.isSaving) {
      const results = { '1': 'miss', '2': 'hard', '3': 'remembered', '4': 'easy' } as const;
      const result = results[event.key as keyof typeof results];
      if (result) {
        event.preventDefault();
        void this.rateCard(result);
      }
    }
  }

  get estimatedMinutes() {
    return this.remainingCards === 0 ? 0 : Math.max(1, Math.ceil(this.remainingCards * 0.6));
  }

  async rateCard(result: 'miss' | 'hard' | 'remembered' | 'easy') {
    if (!this.currentCard || this.isSaving || !this.showAnswer) {
      return;
    }

    const intervals: Record<typeof result, number> = {
      miss: 60 * 60 * 1000,
      hard: 24 * 60 * 60 * 1000,
      remembered: 3 * 24 * 60 * 60 * 1000,
      easy: 7 * 24 * 60 * 60 * 1000,
    };
    const messages = {
      miss: 'Você verá este cartão novamente em cerca de 1 hora.',
      hard: 'Você verá este cartão novamente amanhã.',
      remembered: 'Você verá este cartão novamente em 3 dias.',
      easy: 'Você verá este cartão novamente em 7 dias.',
    };
    const reviewedCard = this.currentCard;
    this.isSaving = true;
    this.errorMessage = '';

    try {
      await this.cardService.updateReview(reviewedCard.id, result);
      this.reviewedCount += 1;
      if (result === 'remembered' || result === 'easy') {
        this.correctCount += 1;
      }
      const reviewDate = new Date(Date.now() + intervals[result]);
      if (!this.nextReviewAt || reviewDate < this.nextReviewAt) {
        this.nextReviewAt = reviewDate;
      }
      this.feedbackMessage = messages[result];
      this.showAnswer = false;
      this.cards = this.cards.filter((card) => card.id !== reviewedCard.id);
      this.currentCard = this.cards[0] ?? null;
      this.currentIndex = 0;
      this.sessionComplete = this.reviewedCount > 0 && !this.currentCard;
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Não foi possível registrar sua resposta.';
    } finally {
      this.isSaving = false;
      this.changeDetector.markForCheck();
    }
  }

  goBack() {
    window.history.back();
  }

  private resetSession(total: number) {
    this.sessionTotal = total;
    this.reviewedCount = 0;
    this.correctCount = 0;
    this.sessionComplete = false;
    this.sessionStartedAt = Date.now();
    this.nextReviewAt = null;
  }
}
