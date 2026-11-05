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
          <input
            [(ngModel)]="searchTerm"
            (ngModelChange)="applyFilters()"
            type="search"
            placeholder="Buscar frase, tradução ou origem"
            aria-label="Buscar na coleção"
          />
          <select [(ngModel)]="categoryFilter" (ngModelChange)="applyFilters()" aria-label="Tema">
            <option value="">Todos os temas</option>
            @for (category of categories; track category) {
              <option [value]="category">{{ categoryLabel(category) }}</option>
            }
          </select>
          <select [(ngModel)]="sourceFilter" (ngModelChange)="applyFilters()" aria-label="Origem">
            <option value="">Todas as origens</option>
            @for (source of sources; track source) {
              <option [value]="source">{{ source }}</option>
            }
          </select>
          <select [(ngModel)]="levelFilter" (ngModelChange)="applyFilters()" aria-label="Nível">
            <option value="">Todos os níveis</option>
            <option value="beginner">Iniciante</option>
            <option value="intermediate">Intermediário</option>
            <option value="advanced">Avançado</option>
          </select>
          <select
            [(ngModel)]="reviewFilter"
            (ngModelChange)="applyFilters()"
            aria-label="Estado de revisão"
          >
            <option value="">Todos os estados</option>
            <option value="due">Precisa de revisão</option>
            <option value="scheduled">Agendado</option>
            <option value="learned">Aprendido</option>
          </select>
          <select [(ngModel)]="learningFilter" (ngModelChange)="applyFilters()" aria-label="Progresso">
            <option value="">Todos os níveis de aprendizado</option>
            <option value="new">Novo</option>
            <option value="learning">Aprendendo</option>
            <option value="mastered">Dominado</option>
          </select>
          <select [(ngModel)]="sortOrder" (ngModelChange)="applyFilters()" aria-label="Ordenar coleção">
            <option value="due">Ordenar por próxima revisão</option>
            <option value="newest">Mais recentes</option>
            <option value="alphabetical">Ordem alfabética</option>
          </select>
          <select [(ngModel)]="voiceLocale" aria-label="Voz em inglês">
            <option value="en-US">Voz EUA</option>
            <option value="en-GB">Voz Reino Unido</option>
          </select>
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
                    <label>
                      <span>Origem</span>
                      <input [(ngModel)]="draftSource" type="text" />
                    </label>
                    <label>
                      <span>Nível</span>
                      <select [(ngModel)]="draftLevel">
                        <option value="">Não informado</option>
                        <option value="beginner">Iniciante</option>
                        <option value="intermediate">Intermediário</option>
                        <option value="advanced">Avançado</option>
                      </select>
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
                      <span [class]="categoryClass(card.category)">
                        {{ categoryLabel(card.category) }}
                      </span>
                      <span [class]="'learning-state ' + learningState(card)">
                        {{ learningStateLabel(card) }}
                      </span>
                      @if (card.source) {
                        <span>Origem: {{ card.source }}</span>
                      }
                      @if (card.level) {
                        <span>{{ levelLabel(card.level) }}</span>
                      }
                      <span class="review-state" [class]="'review-state ' + reviewState(card)">
                        {{ reviewStateLabel(card) }}
                      </span>
                      <span>Próxima revisão: {{ card.next_review_at | date: 'dd/MM/yyyy' }}</span>
                    </div>
                  </div>
                  <div class="item-actions">
                    <button
                      type="button"
                      class="secondary"
                      (click)="speakEnglish(card.english_text)"
                      [disabled]="!speech.isSupported"
                      aria-label="Ouvir frase em inglês"
                      title="Ouvir frase em inglês"
                    >
                      🔊
                    </button>
                    <button type="button" class="secondary" (click)="startEdit(card)" aria-label="Editar cartão" title="Editar cartão">
                      ✎
                    </button>
                    <button type="button" class="danger" (click)="deleteCard(card.id)" aria-label="Excluir cartão" title="Excluir cartão">
                      🗑
                    </button>
                    @defer (on interaction) {
                      <app-pronunciation-practice
                        [referenceText]="card.english_text"
                        [assessmentEnabled]="pronunciationAssessmentEnabled"
                        [initiallyOpen]="true"
                      />
                    } @placeholder {
                      <button type="button" class="secondary practice-trigger" aria-label="Praticar pronúncia" title="Praticar pronúncia">
                        🎙
                      </button>
                    }
                  </div>
                }
              </article>
            }
          </div>
          <nav class="pagination" aria-label="Paginação da coleção">
            <span>{{ filteredCount }} {{ filteredCount === 1 ? 'cartão encontrado' : 'cartões encontrados' }}</span>
            <div>
              <button type="button" class="secondary" (click)="changePage(-1)" [disabled]="currentPage === 1">
                Anterior
              </button>
              <span>Página {{ currentPage }} de {{ totalPages }}</span>
              <button type="button" class="secondary" (click)="changePage(1)" [disabled]="currentPage === totalPages">
                Próxima
              </button>
            </div>
          </nav>
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
      grid-template-columns: repeat(3, minmax(0, 1fr));
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

    .toolbar input {
      grid-column: span 2;
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
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      min-width: 0;
      overflow-wrap: anywhere;
      border: 1px solid rgba(96, 165, 250, 0.22);
      border-radius: 14px;
      padding: 0.75rem 1rem;
      background: rgba(15, 23, 42, 0.7);
    }

    .item-head {
      display: block;
      min-width: 0;
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
      align-items: center;
      flex-wrap: wrap;
      gap: 0.4rem;
      font-size: 0.78rem;
      color: #cbd5e1;
      text-align: left;
    }

    .category-badge {
      padding: 0.22rem 0.6rem;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.15);
      color: #e2e8f0;
      font-weight: 750;
    }

    .learning-state {
      padding: 0.22rem 0.6rem;
      border-radius: 999px;
      background: rgba(96, 165, 250, 0.13);
      color: #bfdbfe;
      font-weight: 700;
    }

    .learning-state.new {
      background: rgba(148, 163, 184, 0.15);
      color: #e2e8f0;
    }

    .learning-state.mastered {
      background: rgba(52, 211, 153, 0.14);
      color: #a7f3d0;
    }

    .category-vocabulary {
      background: rgba(167, 139, 250, 0.16);
      color: #ddd6fe;
    }

    .category-sentence {
      background: rgba(56, 189, 248, 0.14);
      color: #bae6fd;
    }

    .category-cloze {
      background: rgba(251, 191, 36, 0.15);
      color: #fde68a;
    }

    .category-travel {
      background: rgba(52, 211, 153, 0.14);
      color: #a7f3d0;
    }

    .review-state {
      width: fit-content;
      padding: 0.2rem 0.5rem;
      border-radius: 999px;
      background: rgba(56, 189, 248, 0.12);
      color: #bae6fd;
      font-weight: 700;
    }

    .review-state.due {
      background: rgba(248, 113, 113, 0.14);
      color: #fecaca;
    }

    .review-state.learned {
      background: rgba(52, 211, 153, 0.12);
      color: #a7f3d0;
    }

    .item-actions,
    .editor-actions {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 0.45rem;
      margin-top: 0.5rem;
      flex-wrap: wrap;
    }

    .item-actions {
      grid-column: 2;
      grid-row: 1;
      margin: 0 0 0 0.75rem;
    }

    .editor {
      grid-column: 1 / -1;
    }

    .item-actions button {
      min-width: 42px;
      min-height: 42px;
      padding: 0.55rem;
    }

    .pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-top: 1.25rem;
      color: #cbd5e1;
      font-size: 0.9rem;
    }

    .pagination > div {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }

    .pagination button {
      padding: 0.55rem 0.75rem;
    }

    .pagination button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
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

      .toolbar input {
        grid-column: auto;
      }

      .pagination {
        align-items: flex-start;
        flex-direction: column;
      }

      .pagination > div {
        width: 100%;
        justify-content: space-between;
      }

      .collection-shell {
        padding: 1rem 0.75rem;
      }

      .panel {
        padding: 1.1rem;
      }

      .item-meta {
        text-align: left;
        align-items: flex-start;
      }

      .item-actions {
        justify-content: flex-start;
        margin-left: 0.5rem;
      }
    }
  `,
})
export class CardListComponent implements OnInit {
  cards: FlashcardRecord[] = [];
  categories: string[] = [];
  sources: string[] = [];
  private allCards: FlashcardRecord[] = [];
  searchTerm = '';
  categoryFilter = '';
  sourceFilter = '';
  levelFilter = '';
  reviewFilter = '';
  learningFilter = '';
  sortOrder: 'due' | 'newest' | 'alphabetical' = 'due';
  currentPage = 1;
  readonly pageSize = 20;
  filteredCount = 0;
  editingId: string | null = null;
  draftEnglish = '';
  draftPortuguese = '';
  draftCategory = '';
  draftSource = '';
  draftLevel = '';
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
      this.allCards = await this.cardService.listCards();
      this.categories = [
        ...new Set(
          this.allCards
            .map((card) => card.category?.trim().toLocaleLowerCase())
            .filter(Boolean),
        ),
      ] as string[];
      this.sources = [
        ...new Set(this.allCards.map((card) => card.source).filter(Boolean)),
      ] as string[];
      this.applyFilters();
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Não foi possível carregar a coleção.';
    } finally {
      this.isLoading = false;
      this.changeDetector.markForCheck();
    }
  }

  applyFilters() {
    this.currentPage = 1;
    const search = this.searchTerm.trim().toLocaleLowerCase();
    const filtered = this.allCards.filter((card) => {
      const matchesSearch =
        !search ||
        [card.english_text, card.portuguese_text, card.source ?? '']
          .some((value) => value.toLocaleLowerCase().includes(search));
      const matchesCategory =
        !this.categoryFilter ||
        card.category?.trim().toLocaleLowerCase() === this.categoryFilter;
      const matchesSource = !this.sourceFilter || card.source === this.sourceFilter;
      const matchesLevel = !this.levelFilter || card.level === this.levelFilter;
      const matchesReview = !this.reviewFilter || this.reviewState(card) === this.reviewFilter;
      const matchesLearning =
        !this.learningFilter || this.learningState(card) === this.learningFilter;
      return (
        matchesSearch &&
        matchesCategory &&
        matchesSource &&
        matchesLevel &&
        matchesReview &&
        matchesLearning
      );
    });
    this.filteredCount = filtered.length;
    this.sortCards(filtered);
    this.cards = filtered.slice(0, this.pageSize);
  }

  changePage(offset: -1 | 1) {
    const nextPage = this.currentPage + offset;
    if (nextPage < 1 || nextPage > this.totalPages) {
      return;
    }
    this.currentPage = nextPage;
    const filtered = this.getFilteredCards();
    this.sortCards(filtered);
    const start = (this.currentPage - 1) * this.pageSize;
    this.cards = filtered.slice(start, start + this.pageSize);
  }

  get totalPages() {
    return Math.max(1, Math.ceil(this.filteredCount / this.pageSize));
  }

  private getFilteredCards() {
    const search = this.searchTerm.trim().toLocaleLowerCase();
    return this.allCards.filter((card) => {
      const matchesSearch =
        !search ||
        [card.english_text, card.portuguese_text, card.source ?? '']
          .some((value) => value.toLocaleLowerCase().includes(search));
      return (
        matchesSearch &&
        (!this.categoryFilter ||
          card.category?.trim().toLocaleLowerCase() === this.categoryFilter) &&
        (!this.sourceFilter || card.source === this.sourceFilter) &&
        (!this.levelFilter || card.level === this.levelFilter) &&
        (!this.reviewFilter || this.reviewState(card) === this.reviewFilter) &&
        (!this.learningFilter || this.learningState(card) === this.learningFilter)
      );
    });
  }

  private sortCards(cards: FlashcardRecord[]) {
    if (this.sortOrder === 'newest') {
      cards.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    } else if (this.sortOrder === 'alphabetical') {
      cards.sort((a, b) => a.english_text.localeCompare(b.english_text, 'en'));
    } else {
      cards.sort(
        (a, b) =>
          new Date(a.next_review_at).getTime() - new Date(b.next_review_at).getTime(),
      );
    }
  }

  learningState(card: FlashcardRecord): 'new' | 'learning' | 'mastered' {
    const reviews = card.review_count ?? 0;
    return reviews === 0 ? 'new' : reviews >= 5 ? 'mastered' : 'learning';
  }

  learningStateLabel(card: FlashcardRecord) {
    const labels = { new: 'Novo', learning: 'Aprendendo', mastered: 'Dominado' };
    return labels[this.learningState(card)];
  }

  categoryClass(category: string | null | undefined) {
    const value = category?.trim().toLocaleLowerCase();
    if (value === 'vocabulary' || value === 'sentence' || value === 'cloze' || value === 'travel') {
      return `category-badge category-${value}`;
    }
    return 'category-badge';
  }

  reviewState(card: FlashcardRecord): 'due' | 'scheduled' | 'learned' {
    if (new Date(card.next_review_at).getTime() <= Date.now()) {
      return 'due';
    }
    return (card.review_count ?? 0) >= 5 ? 'learned' : 'scheduled';
  }

  reviewStateLabel(card: FlashcardRecord) {
    const labels = { due: 'Vencido', scheduled: 'Agendado', learned: 'Aprendido' };
    return labels[this.reviewState(card)];
  }

  categoryLabel(category: string | null | undefined) {
    if (!category) {
      return 'Sem tema';
    }
    const labels: Record<string, string> = {
      vocabulary: 'Vocabulário',
      sentence: 'Frase',
      cloze: 'Lacuna',
      travel: 'Viagem',
      work: 'Trabalho',
      food: 'Comida',
    };
    return labels[category.toLocaleLowerCase()] ?? category.trim().toLocaleLowerCase();
  }

  levelLabel(level: string) {
    const labels: Record<string, string> = {
      beginner: 'Iniciante',
      intermediate: 'Intermediário',
      advanced: 'Avançado',
    };
    return labels[level] ?? level;
  }

  startEdit(card: FlashcardRecord) {
    this.editingId = card.id;
    this.draftEnglish = card.english_text;
    this.draftPortuguese = card.portuguese_text;
    this.draftCategory = card.category ?? '';
    this.draftSource = card.source ?? '';
    this.draftLevel = card.level ?? '';
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
      source: this.draftSource,
      level: this.draftLevel,
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
