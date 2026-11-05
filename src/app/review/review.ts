import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { CardService, type FlashcardRecord } from '../cards/card.service';
import { PronunciationPracticeComponent } from '../cards/pronunciation-practice';
import { SpeechService, type EnglishLocale } from '../core/speech.service';

@Component({
  selector: 'app-review',
  standalone: true,
  template: `
    <main class="review-shell">
      <section class="card">
        @if (isLoading) {
          <p class="loading">Carregando cartões...</p>
        } @else if (errorMessage) {
          <div class="empty-state">
            <p class="speech-message" role="alert">{{ errorMessage }}</p>
            <button type="button" class="primary" (click)="loadCards()">Tentar novamente</button>
          </div>
        } @else if (sessionComplete) {
          <div class="empty-state session-summary">
            <p class="eyebrow">Sessão concluída</p>
            <h1>Mandou bem!</h1>
            <p>Você revisou {{ reviewedCount }} {{ reviewedCount === 1 ? 'cartão' : 'cartões' }}.</p>
            <div class="summary-stats">
              <article><strong>{{ correctCount }}</strong><span>lembrados</span></article>
              <article><strong>{{ elapsedLabel }}</strong><span>tempo de estudo</span></article>
              <article>
                <strong>{{ nextReviewLabel }}</strong><span>próxima revisão prevista</span>
              </article>
            </div>
            <div class="empty-actions">
              <button type="button" class="primary" (click)="startNewReview()">Revisar novamente</button>
              <button type="button" class="secondary" (click)="goBack()">Voltar ao painel</button>
            </div>
          </div>
        } @else if (!currentCard) {
          <div class="empty-state">
          <h1>{{ difficultOnly ? 'Nenhum cartão difícil por enquanto' : 'Você está em dia!' }}</h1>
          <p>
            {{ difficultOnly
              ? 'Não há cartões com erros registrados para revisar.'
              : 'Não há cartões pendentes para revisão neste momento.' }}
          </p>
            @if (feedbackMessage) {
              <p class="review-feedback" role="status">{{ feedbackMessage }}</p>
            }
            <div class="empty-actions">
              <button type="button" class="primary" (click)="startNewReview()">Nova revisão</button>
              <button type="button" class="secondary" (click)="goBack()">Voltar ao painel</button>
            </div>
          </div>
        } @else {
          <div class="header">
            <p class="eyebrow">Prática de hoje</p>
            <span class="meta">
              {{ currentCardNumber }} de {{ sessionTotal }} cartões · cerca de
              {{ estimatedMinutes }} min
            </span>
          </div>
          <div
            class="progress-track"
            role="progressbar"
            [attr.aria-valuenow]="currentCardNumber"
            [attr.aria-valuemin]="0"
            [attr.aria-valuemax]="sessionTotal"
            [attr.aria-label]="'Progresso da sessão: cartão ' + currentCardNumber + ' de ' + sessionTotal"
          >
            <span [style.width.%]="progressPercent"></span>
          </div>

          <button
            type="button"
            class="phrase-card"
            [class.flipped]="showAnswer"
            (click)="toggleAnswer()"
            [attr.aria-expanded]="showAnswer"
            aria-label="Toque para revelar ou esconder a tradução"
          >
            <span class="flip-inner">
              <span class="flip-face front-face">
                <span class="phrase">{{ currentCard.english_text }}</span>
                <span class="tap-hint">Toque ou pressione Espaço para revelar</span>
              </span>
              <span class="flip-face back-face">
                <span class="phrase">{{ currentCard.portuguese_text }}</span>
                @if (currentCard.focus_word) {
                  <span class="answer-detail"><strong>Foco:</strong> {{ currentCard.focus_word }}</span>
                }
                @if (currentCard.category) {
                  <span class="answer-detail"><strong>Tema:</strong> {{ currentCard.category }}</span>
                }
                <span class="tap-hint">Toque ou pressione Espaço para voltar</span>
              </span>
            </span>
          </button>

          <div class="actions-row">
            <label class="voice-choice">
              <span>Voz</span>
              <select [(ngModel)]="voiceLocale" aria-label="Voz em inglês">
                <option value="en-US">EUA</option>
                <option value="en-GB">Reino Unido</option>
              </select>
            </label>
            <button
              type="button"
              class="secondary"
              (click)="speakEnglish()"
              [disabled]="!speech.isSupported"
              aria-label="Ouvir frase em inglês"
            >
              🔊 Ouvir frase
            </button>
            <button type="button" class="secondary" (click)="toggleAnswer()">
              {{ showAnswer ? 'Esconder resposta' : 'Revelar tradução' }}
            </button>
          </div>

          @if (!speech.isSupported) {
            <p class="speech-message" role="status">
              A reprodução de voz não está disponível neste navegador.
            </p>
          } @else if (speechMessage) {
            <p class="speech-message" role="status">{{ speechMessage }}</p>
          }

          <app-pronunciation-practice
            [referenceText]="currentCard.english_text"
            [assessmentEnabled]="false"
          />

          @if (feedbackMessage) {
            <p class="review-feedback" role="status">{{ feedbackMessage }}</p>
          }

          <p class="rating-hint">
            Sua resposta define quando este cartão volta para revisão.
          </p>
          <div class="rating-row">
            <button type="button" class="rating miss" (click)="rateCard('miss')" [disabled]="isSaving || !showAnswer">
              <strong>Errei</strong><small>em 1 hora</small>
            </button>
            <button type="button" class="rating hard" (click)="rateCard('hard')" [disabled]="isSaving || !showAnswer">
              <strong>Difícil</strong><small>· 1d</small>
            </button>
            <button type="button" class="rating remembered" (click)="rateCard('remembered')" [disabled]="isSaving || !showAnswer">
              <strong>Lembrei</strong><small>· 3d</small>
            </button>
            <button
              type="button"
              class="rating easy"
              (click)="rateCard('easy')"
              [disabled]="isSaving || !showAnswer"
            >
              <strong>Fácil</strong><small>· 7d</small>
            </button>
          </div>
          @if (errorMessage) {
            <p class="review-feedback error" role="alert">{{ errorMessage }}</p>
          }
        }
      </section>
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100%;
      background: transparent;
      font-family: Arial, sans-serif;
      color: #e5e7eb;
    }

    .review-shell {
      min-height: calc(100vh - 72px);
      display: grid;
      place-items: center;
      padding: 2rem clamp(1rem, 4vw, 3.5rem);
      box-sizing: border-box;
    }

    .card {
      width: min(100%, 760px);
      background: rgba(15, 23, 42, 0.94);
      border: 1px solid rgba(96, 165, 250, 0.22);
      border-radius: 20px;
      padding: 2rem;
      box-shadow: 0 18px 40px rgba(2, 6, 23, 0.42);
    }

    .progress-track {
      height: 8px;
      overflow: hidden;
      margin: 1.25rem 0 1.5rem;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.2);
    }

    .progress-track span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #38bdf8, #34d399);
      transition: width 250ms ease;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }

    .eyebrow {
      margin: 0;
      color: #7dd3fc;
      font-size: 0.76rem;
      font-weight: 750;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .eyebrow {
      margin: 0 0 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.72rem;
      color: #60a5fa;
      font-weight: 700;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.6rem;
      color: #60a5fa;
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .brand img {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      object-fit: cover;
    }

    .meta {
      color: #cbd5e1;
      font-weight: 700;
    }

    .phrase-card {
      display: block;
      width: 100%;
      min-height: clamp(260px, 38vh, 390px);
      margin: 0 0 1.25rem;
      padding: 0;
      border: 0;
      border-radius: 18px;
      background: transparent;
      color: #e5e7eb;
      text-align: left;
      perspective: 1200px;
      cursor: pointer;
    }

    .flip-inner {
      position: relative;
      display: block;
      width: 100%;
      height: 100%;
      min-height: inherit;
      transition: transform 550ms cubic-bezier(0.2, 0.75, 0.25, 1);
      transform-style: preserve-3d;
    }

    .phrase-card.flipped .flip-inner {
      transform: rotateY(180deg);
    }

    .flip-face {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 1rem;
      padding: clamp(1.5rem, 5vw, 3rem);
      border: 1px solid rgba(96, 165, 250, 0.32);
      border-radius: 16px;
      background: rgba(96, 165, 250, 0.06);
      backface-visibility: hidden;
      overflow-wrap: anywhere;
    }

    .back-face {
      transform: rotateY(180deg);
      background: rgba(16, 185, 129, 0.08);
      border-color: rgba(52, 211, 153, 0.35);
    }

    .answer-detail {
      color: #cbd5e1;
      font-size: 1rem;
    }

    .phrase {
      font-size: clamp(2rem, 4vw, 3rem);
      font-weight: 750;
      line-height: 1.2;
      overflow-wrap: anywhere;
    }

    .tap-hint {
      color: #a5b4c8;
      font-size: 0.9rem;
    }

    .actions-row {
      display: flex;
      align-items: end;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-bottom: 1rem;
    }

    button {
      border: none;
      border-radius: 12px;
      padding: 0.8rem 1rem;
      font: inherit;
      cursor: pointer;
      font-weight: 700;
    }

    .secondary {
      background: rgba(96, 165, 250, 0.12);
      border: 1px solid rgba(96, 165, 250, 0.25);
      color: #e5e7eb;
    }

    .secondary:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .voice-choice {
      display: grid;
      gap: 0.3rem;
      color: #cbd5e1;
      font-size: 0.8rem;
    }

    .voice-choice select {
      min-height: 43px;
      border: 1px solid rgba(96, 165, 250, 0.25);
      border-radius: 12px;
      padding: 0.65rem 0.8rem;
      background: rgba(96, 165, 250, 0.12);
      color: #e5e7eb;
      font: inherit;
    }

    .speech-message {
      margin: 0 0 1rem;
      color: #cbd5e1;
      font-size: 0.9rem;
    }

    .primary {
      background: linear-gradient(135deg, #60a5fa 0%, #38bdf8 100%);
      color: #0b1220;
    }

    .answer-box {
      background: rgba(96, 165, 250, 0.08);
      border: 1px solid rgba(96, 165, 250, 0.28);
      border-radius: 16px;
      padding: 1rem 1.1rem;
      margin-bottom: 1rem;
      line-height: 1.7;
    }

    .rating-row {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.75rem;
    }

    .rating {
      display: grid;
      min-height: 62px;
      justify-items: center;
      gap: 0.2rem;
      color: white;
    }

    .rating small {
      font-size: 0.75rem;
      font-weight: 500;
    }

    .rating:disabled {
      opacity: 0.55;
      cursor: wait;
    }

    .rating-hint {
      margin: 0 0 0.65rem;
      color: #b6c4d6;
      font-size: 0.95rem;
    }

    .review-feedback {
      margin: 0 0 0.85rem;
      color: #a7f3d0;
      font-size: 1rem;
    }

    .review-feedback.error {
      color: #fecaca;
    }

    .miss {
      background: #ef4444;
    }
    .hard {
      background: #f59e0b;
    }
    .remember {
      background: #10b981;
    }
    .remembered {
      background: #10b981;
    }
    .easy {
      background: #2563eb;
    }

    .empty-state {
      text-align: center;
    }

    .summary-stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.75rem;
      margin-top: 1.5rem;
    }

    .summary-stats article {
      display: grid;
      gap: 0.35rem;
      padding: 1rem;
      border: 1px solid rgba(96, 165, 250, 0.22);
      border-radius: 12px;
      background: rgba(96, 165, 250, 0.06);
    }

    .summary-stats strong {
      color: #7dd3fc;
      font-size: 1.2rem;
    }

    .summary-stats span {
      color: #cbd5e1;
      font-size: 0.85rem;
    }

    .empty-actions {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-top: 1.25rem;
    }

    .loading {
      color: #cbd5e1;
      font-size: 1.05rem;
    }

    @media (max-width: 640px) {
      .rating-row {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .card {
        padding: 1.2rem;
      }

      .summary-stats {
        grid-template-columns: 1fr;
      }

      .phrase-card {
        min-height: 280px;
      }

      .rating {
        min-height: 72px;
      }

      .meta {
        font-size: 0.9rem;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .flip-inner,
      .progress-track span {
        transition: none;
      }
    }
  `,
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
