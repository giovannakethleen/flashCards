import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { CardService } from './card.service';
import {
  FlashcardGenerationService,
  type GeneratedFlashcard,
} from '../core/flashcard-generation.service';

type LearnerLevel = 'beginner' | 'intermediate' | 'advanced';
type FlashcardDraft = GeneratedFlashcard & { id: number; selected: boolean };

@Component({
  selector: 'app-flashcard-generator',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './flashcard-generator.html',
  styleUrl: './flashcard-generator.scss',
})
export class FlashcardGeneratorComponent implements OnInit {
  summary = '';
  level: LearnerLevel = 'beginner';
  source = '';
  drafts: FlashcardDraft[] = [];
  generating = false;
  saving = false;
  errorMessage = '';
  infoMessage = '';
  needsMoreContext = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly generation: FlashcardGenerationService,
    private readonly cards: CardService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.source = this.route.snapshot.queryParamMap.get('source')?.slice(0, 160) ?? '';
    let summary = '';
    try {
      if (typeof window !== 'undefined') {
        summary = window.sessionStorage.getItem('flashcards-ai-note-draft') ?? '';
        window.sessionStorage.removeItem('flashcards-ai-note-draft');
      }
    } catch {
      this.errorMessage = 'Não foi possível carregar o texto da nota neste navegador.';
      return;
    }
    if (Array.from(summary).length > 5000) {
      this.errorMessage = 'A nota ultrapassa o limite de 5.000 caracteres para a geração com IA.';
      return;
    }
    this.summary = summary;
  }

  async generate() {
    const summary = this.summary.trim();
    if (!summary || Array.from(summary).length > 5000) {
      this.errorMessage = 'Informe um resumo com até 5.000 caracteres.';
      return;
    }

    this.generating = true;
    this.errorMessage = '';
    this.infoMessage = '';
    this.needsMoreContext = '';
    this.drafts = [];

    try {
      const result = await this.generation.generate(summary, this.level, this.source.trim());
      if (result.needsMoreContext) {
        this.needsMoreContext = result.message;
      } else {
        this.drafts = result.cards.map((card, id) => ({ ...card, id, selected: true }));
      }
    } catch (error) {
      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'Não foi possível gerar sugestões. Tente novamente mais tarde.';
    } finally {
      this.generating = false;
      this.changeDetector.markForCheck();
    }
  }

  async saveSelected() {
    const selected = this.drafts.filter((draft) => draft.selected);
    if (!selected.length || !this.selectedDraftsValid) {
      this.errorMessage = 'Selecione e complete pelo menos um cartão antes de salvar.';
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.infoMessage = '';
    try {
      await this.cards.createCards(
        selected.map((draft) => ({
          english_text: draft.front,
          portuguese_text: draft.back,
          focus_word: draft.focus,
          category: draft.type,
          source: draft.source,
          level: this.level,
        })),
      );
      this.drafts = [];
      this.infoMessage = `${selected.length} ${selected.length === 1 ? 'cartão salvo' : 'cartões salvos'} na sua coleção.`;
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Não foi possível salvar os cartões selecionados.';
    } finally {
      this.saving = false;
      this.changeDetector.markForCheck();
    }
  }

  removeDraft(id: number) {
    this.drafts = this.drafts.filter((draft) => draft.id !== id);
  }

  get selectedCount() {
    return this.drafts.filter((draft) => draft.selected).length;
  }

  get selectedDraftsValid() {
    const selected = this.drafts.filter((draft) => draft.selected);
    return (
      selected.length > 0 &&
      selected.every(
        (draft) =>
          draft.front.trim() &&
          draft.back.trim() &&
          draft.focus.trim() &&
          draft.front.length <= 500 &&
          draft.back.length <= 500 &&
          draft.focus.length <= 120,
      )
    );
  }
}
