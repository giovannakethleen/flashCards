import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CardService, type FlashcardRecord } from '../cards/card.service';
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
        } @else if (!currentCard) {
          <div class="empty-state">
            <h1>Você está em dia!</h1>
            <p>Não há cartões pendentes para revisão neste momento.</p>
            <div class="empty-actions">
              <button type="button" class="primary" (click)="startNewReview()">Nova revisão</button>
              <button type="button" class="secondary" (click)="goBack()">Voltar ao painel</button>
            </div>
          </div>
        } @else {
          <div class="header">
            <p class="eyebrow">Prática de hoje</p>
            <span class="meta">{{ currentIndex + 1 }} / {{ cards.length }}</span>
          </div>

          <h1>{{ currentCard.english_text }}</h1>

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

          @if (showAnswer) {
            <div class="answer-box">
              <p><strong>Tradução:</strong> {{ currentCard.portuguese_text }}</p>
              @if (currentCard.focus_word) {
                <p><strong>Foco:</strong> {{ currentCard.focus_word }}</p>
              }
              @if (currentCard.category) {
                <p><strong>Tema:</strong> {{ currentCard.category }}</p>
              }
            </div>
          }

          <div class="rating-row">
            <button type="button" class="rating miss" (click)="rateCard('miss')">Errei</button>
            <button type="button" class="rating hard" (click)="rateCard('hard')">Difícil</button>
            <button type="button" class="rating easy" (click)="rateCard('easy')">Fácil</button>
            <button type="button" class="rating remember" (click)="rateCard('remembered')">
              Lembrei
            </button>
          </div>
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
      place-items: start center;
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

    h1 {
      margin: 1rem 0 1.25rem;
      font-size: clamp(2rem, 4vw, 3rem);
      line-height: 1.2;
      color: #e5e7eb;
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
      color: white;
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
    .easy {
      background: #2563eb;
    }

    .empty-state {
      text-align: center;
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
    }
  `,
  imports: [FormsModule],
})
export class ReviewComponent implements OnInit {
  cards: FlashcardRecord[] = [];
  currentIndex = 0;
  currentCard: FlashcardRecord | null = null;
  showAnswer = false;
  isLoading = true;
  voiceLocale: EnglishLocale = 'en-US';
  speechMessage = '';
  errorMessage = '';

  constructor(
    private readonly cardService: CardService,
    public readonly speech: SpeechService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    void this.loadCards();
  }

  async loadCards() {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      this.cards = await this.cardService.getDueCards();
      this.currentIndex = 0;
      this.currentCard = this.cards[0] ?? null;
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
    this.showAnswer = false;

    try {
      this.cards = await this.cardService.getAllCards();
      this.currentIndex = 0;
      this.currentCard = this.cards[0] ?? null;
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

  async rateCard(result: 'miss' | 'hard' | 'remembered' | 'easy') {
    if (!this.currentCard) {
      return;
    }

    await this.cardService.updateReview(this.currentCard.id, result);
    this.showAnswer = false;

    this.cards = this.cards.filter((card) => card.id !== this.currentCard?.id);
    this.currentCard = this.cards[this.currentIndex] ?? null;

    if (!this.currentCard && this.cards.length === 0) {
      this.currentCard = null;
    }

    if (this.currentCard) {
      this.currentIndex = 0;
    }
  }

  goBack() {
    window.history.back();
  }
}
