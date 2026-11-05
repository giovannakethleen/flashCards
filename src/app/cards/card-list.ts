import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CardService, type FlashcardRecord } from './card.service';
import { SpeechService, type EnglishLocale } from '../core/speech.service';
import { TranslationService } from '../core/translation.service';
import { isPronunciationAssessmentEnabled } from '../core/supabase';
import { PronunciationPracticeComponent } from './pronunciation-practice';

@Component({
  selector: 'app-card-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PronunciationPracticeComponent],
  template: `
    <main class="collection-shell">
      <section class="panel">
        <div class="header">
          <h1>Coleção</h1>
        </div>

        <div class="toolbar">
          <input [(ngModel)]="searchTerm" type="text" placeholder="Buscar frase ou tradução" />
          <select [(ngModel)]="categoryFilter" (change)="loadCards()">
            <option value="">Todos os temas</option>
            @for (category of categories; track category) {
              <option [value]="category">{{ category }}</option>
            }
          </select>
          <select [(ngModel)]="voiceLocale" aria-label="Voz em inglês">
            <option value="en-US">Voz EUA</option>
            <option value="en-GB">Voz Reino Unido</option>
          </select>
          <button type="button" class="primary" (click)="loadCards()">Buscar</button>
        </div>

        @if (speechMessage) {
          <p class="status" role="status">{{ speechMessage }}</p>
        }

        @if (isLoading) {
          <p class="status">Carregando cartões...</p>
        } @else if (errorMessage) {
          <p class="status error-message" role="alert">{{ errorMessage }}</p>
        } @else if (!cards.length) {
          <p class="status">Nenhum cartão encontrado.</p>
        } @else {
          <div class="list">
            @for (card of cards; track card.id) {
              <article class="item">
                @if (editingId === card.id) {
                  <div class="editor">
                    <label>
                      <span>Inglês</span>
                      <textarea [(ngModel)]="draftEnglish" rows="3"></textarea>
                    </label>
                    <label>
                      <span>Português</span>
                      <textarea [(ngModel)]="draftPortuguese" rows="3"></textarea>
                    </label>
                    <button
                      type="button"
                      class="secondary translation-button"
                      (click)="translateDraftToPortuguese()"
                      [disabled]="isTranslating || !translation.enabled"
                    >
                      {{ isTranslating ? 'Traduzindo...' : 'Traduzir para português' }}
                    </button>
                    @if (translationMessage) {
                      <p
                        class="translation-message"
                        [class.error-message]="translationError"
                        role="status"
                      >
                        {{ translationMessage }}
                      </p>
                    } @else if (!translation.enabled) {
                      <p class="translation-message">
                        Tradução automática indisponível no momento. Você pode preencher o campo
                        manualmente.
                      </p>
                    }
                    <label>
                      <span>Tema</span>
                      <input [(ngModel)]="draftCategory" type="text" />
                    </label>
                    <div class="editor-actions">
                      <button
                        type="button"
                        class="primary"
                        (click)="saveEdit()"
                        [disabled]="isTranslating"
                      >
                        Salvar
                      </button>
                      <button type="button" class="secondary" (click)="cancelEdit()">
                        Cancelar
                      </button>
                    </div>
                  </div>
                } @else {
                  <div class="item-head">
                    <div>
                      <p class="phrase">{{ card.english_text }}</p>
                      <button
                        type="button"
                        class="translation-toggle"
                        [attr.aria-expanded]="isTranslationVisible(card.id)"
                        (click)="toggleTranslation(card.id)"
                      >
                        {{
                          isTranslationVisible(card.id) ? 'Ocultar tradução' : 'Mostrar tradução'
                        }}
                      </button>
                      @if (isTranslationVisible(card.id)) {
                        <p class="translation">{{ card.portuguese_text }}</p>
                      }
                    </div>
                    <div class="item-meta">
                      <span>{{ card.category || 'Sem tema' }}</span>
                      <span>{{ card.next_review_at | date: 'dd/MM/yyyy' }}</span>
                    </div>
                  </div>
                  <div class="item-actions">
                    <button
                      type="button"
                      class="secondary"
                      (click)="speakEnglish(card.english_text)"
                      [disabled]="!speech.isSupported"
                      aria-label="Ouvir frase em inglês"
                    >
                      🔊 Ouvir inglês
                    </button>
                    <button type="button" class="secondary" (click)="startEdit(card)">
                      Editar
                    </button>
                    <button type="button" class="danger" (click)="deleteCard(card.id)">
                      Excluir
                    </button>
                  </div>
                  @defer (on interaction) {
                    <app-pronunciation-practice
                      [referenceText]="card.english_text"
                      [assessmentEnabled]="pronunciationAssessmentEnabled"
                      [initiallyOpen]="true"
                    />
                  } @placeholder {
                    <button type="button" class="secondary practice-trigger">
                      Praticar pronúncia
                    </button>
                  }
                }
              </article>
            }
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

    .collection-shell {
      width: 100%;
      min-width: 0;
      min-height: calc(100vh - 72px);
      padding: 1.5rem clamp(1rem, 4vw, 3.5rem);
      box-sizing: border-box;
    }

    .panel {
      width: min(100%, 980px);
      min-width: 0;
      margin: 0 auto;
      background: rgba(15, 23, 42, 0.94);
      border: 1px solid rgba(96, 165, 250, 0.22);
      border-radius: 18px;
      padding: 2rem;
      box-shadow: 0 18px 45px rgba(2, 6, 23, 0.42);
    }

    .header {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .header h1 {
      margin: 0;
    }

    .eyebrow {
      margin: 0 0 0.4rem;
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

    h1 {
      margin: 0;
      font-size: clamp(1.8rem, 4vw, 2.6rem);
      color: #e5e7eb;
    }

    .toolbar {
      margin-top: 1.5rem;
      display: grid;
      min-width: 0;
      grid-template-columns: minmax(0, 2fr) minmax(120px, 1fr) minmax(120px, 1fr) auto;
      gap: 0.75rem;
    }

    input,
    select,
    textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 0.8rem 0.9rem;
      border: 1px solid rgba(96, 165, 250, 0.3);
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.7);
      color: #e5e7eb;
      font: inherit;
    }

    textarea {
      resize: vertical;
    }

    button {
      border: none;
      border-radius: 12px;
      padding: 0.8rem 1rem;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    .primary {
      background: linear-gradient(135deg, #60a5fa 0%, #38bdf8 100%);
      color: #0b1220;
    }

    .secondary {
      background: rgba(96, 165, 250, 0.12);
      color: #e5e7eb;
      border: 1px solid rgba(96, 165, 250, 0.25);
    }

    .secondary:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .danger {
      background: rgba(239, 68, 68, 0.12);
      color: #fecaca;
      border: 1px solid rgba(239, 68, 68, 0.25);
    }

    .list {
      margin-top: 1.5rem;
      display: grid;
      min-width: 0;
      gap: 1rem;
    }

    .item {
      min-width: 0;
      overflow-wrap: anywhere;
      border: 1px solid rgba(96, 165, 250, 0.22);
      border-radius: 14px;
      padding: 1rem;
      background: rgba(15, 23, 42, 0.7);
    }

    .item-head {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: flex-start;
    }

    .phrase {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
      color: #e5e7eb;
    }

    .translation {
      margin: 0.35rem 0 0;
      color: #cbd5e1;
    }

    .translation-toggle {
      margin-top: 0.45rem;
      padding: 0;
      border: 0;
      background: transparent;
      color: #7dd3fc;
      font: inherit;
      font-size: 0.82rem;
      text-align: left;
      text-decoration: underline;
      cursor: pointer;
    }

    .item-meta {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: 0.85rem;
      color: #cbd5e1;
      text-align: right;
    }

    .item-actions,
    .editor-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.7rem;
      margin-top: 0.9rem;
      flex-wrap: wrap;
    }

    .editor {
      display: grid;
      gap: 0.75rem;
    }

    .translation-button {
      justify-self: start;
    }

    .translation-message {
      margin: 0;
      color: #94a3b8;
      font-size: 0.82rem;
    }

    .status {
      margin-top: 1rem;
      color: #cbd5e1;
    }

    .error-message {
      color: #fecaca;
    }

    @media (max-width: 640px) {
      .toolbar {
        grid-template-columns: 1fr;
      }

      .collection-shell {
        padding: 1rem 0.75rem;
      }

      .panel {
        padding: 1.1rem;
      }

      .item-head {
        flex-direction: column;
      }

      .item-meta {
        text-align: left;
      }
    }
  `,
})
export class CardListComponent implements OnInit {
  cards: FlashcardRecord[] = [];
  categories: string[] = [];
  searchTerm = '';
  categoryFilter = '';
  editingId: string | null = null;
  draftEnglish = '';
  draftPortuguese = '';
  draftCategory = '';
  isLoading = true;
  voiceLocale: EnglishLocale = 'en-US';
  speechMessage = '';
  errorMessage = '';
  isTranslating = false;
  translationMessage = '';
  translationError = false;
  pronunciationAssessmentEnabled = isPronunciationAssessmentEnabled();
  private readonly visibleTranslations = new Set<string>();

  constructor(
    private readonly cardService: CardService,
    public readonly speech: SpeechService,
    public readonly translation: TranslationService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    void this.loadCards();
  }

  isTranslationVisible(cardId: string): boolean {
    return this.visibleTranslations.has(cardId);
  }

  toggleTranslation(cardId: string) {
    if (this.visibleTranslations.has(cardId)) {
      this.visibleTranslations.delete(cardId);
      return;
    }

    this.visibleTranslations.add(cardId);
  }

  async loadCards() {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      this.cards = await this.cardService.listCards({
        search: this.searchTerm,
        category: this.categoryFilter,
      });
      this.categories = [
        ...new Set(this.cards.map((card) => card.category).filter(Boolean)),
      ] as string[];
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Não foi possível carregar a coleção.';
    } finally {
      this.isLoading = false;
      this.changeDetector.markForCheck();
    }
  }

  startEdit(card: FlashcardRecord) {
    this.editingId = card.id;
    this.draftEnglish = card.english_text;
    this.draftPortuguese = card.portuguese_text;
    this.draftCategory = card.category ?? '';
    this.translationMessage = '';
    this.translationError = false;
  }

  cancelEdit() {
    this.editingId = null;
    this.translationMessage = '';
  }

  async translateDraftToPortuguese() {
    const text = this.draftEnglish.trim();
    if (!text) {
      this.translationError = true;
      this.translationMessage = 'Digite a frase em inglês antes de solicitar a tradução.';
      return;
    }

    if (
      this.draftPortuguese.trim() &&
      !window.confirm('Substituir a tradução que você já escreveu?')
    ) {
      return;
    }

    this.isTranslating = true;
    this.translationMessage = '';
    this.translationError = false;

    try {
      const result = await this.translation.translateToPortuguese(text);
      if (this.draftEnglish.trim() !== text) {
        this.translationError = true;
        this.translationMessage =
          'A frase em inglês mudou durante a tradução. Solicite uma nova tradução para evitar usar um resultado desatualizado.';
        return;
      }
      this.draftPortuguese = result.text;
      this.translationMessage = result.usage.nearLimit
        ? `Tradução pronta para revisar. O uso mensal está perto do limite (${result.usage.charactersUsed.toLocaleString('pt-BR')} de ${result.usage.monthlyLimit.toLocaleString('pt-BR')} caracteres).`
        : `Tradução pronta para revisar. Uso mensal: ${result.usage.charactersUsed.toLocaleString('pt-BR')} de ${result.usage.monthlyLimit.toLocaleString('pt-BR')} caracteres.`;
    } catch (error) {
      this.translationError = true;
      this.translationMessage =
        error instanceof Error ? error.message : 'Não foi possível traduzir a frase.';
    } finally {
      this.isTranslating = false;
    }
  }

  async saveEdit() {
    if (!this.editingId) {
      return;
    }

    await this.cardService.updateCard(this.editingId, {
      english_text: this.draftEnglish,
      portuguese_text: this.draftPortuguese,
      category: this.draftCategory,
    });

    this.editingId = null;
    await this.loadCards();
  }

  async deleteCard(cardId: string) {
    if (!window.confirm('Deseja excluir este cartão?')) {
      return;
    }

    await this.cardService.deleteCard(cardId);
    await this.loadCards();
  }

  speakEnglish(phrase: string) {
    this.speechMessage = '';
    const started = this.speech.speak(phrase, this.voiceLocale, () => {
      this.speechMessage = 'Não foi possível reproduzir o áudio. Tente novamente.';
    });

    if (!started) {
      this.speechMessage = 'A reprodução de voz não está disponível neste navegador.';
    }
  }
}
