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
  templateUrl: './card-list.html',
  styleUrl: './card-list.scss',
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
  pendingDeleteCard: FlashcardRecord | null = null;
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

  requestDelete(card: FlashcardRecord) {
    this.pendingDeleteCard = card;
  }

  cancelDelete() {
    this.pendingDeleteCard = null;
  }

  async confirmDelete() {
    const card = this.pendingDeleteCard;
    if (!card) return;

    await this.cardService.deleteCard(card.id);
    this.pendingDeleteCard = null;
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
