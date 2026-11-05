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
  template: `
    <main class="generator-page">
      <header class="page-heading">
        <p class="eyebrow">ESTUDO COM INTELIGÊNCIA ARTIFICIAL</p>
        <h1>Criar flashcards com IA</h1>
        <p class="intro">
          Gere cartões a partir do conteúdo de uma lição, vídeo, exercício, conversa ou qualquer
          outro material que você estudou.
        </p>
      </header>

      <section class="generator-panel" aria-labelledby="generator-form-heading">
        <h2 id="generator-form-heading">Conteúdo estudado</h2>
        <label for="lesson-summary">Resumo, vocabulário ou exemplos da atividade</label>
        <textarea
          id="lesson-summary"
          [(ngModel)]="summary"
          [ngModelOptions]="{ standalone: true }"
          maxlength="5000"
          rows="8"
          placeholder="Cole suas anotações ou escreva frases e palavras que estudou. Quanto mais contexto, melhores serão as sugestões."
          [disabled]="generating || saving"
        ></textarea>
        <div class="field-meta">
          <label for="learner-level">Nível de inglês</label>
          <select
            id="learner-level"
            [(ngModel)]="level"
            [ngModelOptions]="{ standalone: true }"
            [disabled]="generating || saving"
          >
            <option value="beginner">Iniciante</option>
            <option value="intermediate">Intermediário</option>
            <option value="advanced">Avançado</option>
          </select>
          <label for="card-source">Origem <span>(opcional)</span></label>
          <input
            id="card-source"
            [(ngModel)]="source"
            [ngModelOptions]="{ standalone: true }"
            maxlength="160"
            placeholder="Ex.: livro, vídeo ou lição"
            [disabled]="generating || saving"
          />
          <span class="character-count">{{ summary.length }}/5000</span>
        </div>

        <p class="privacy-notice">
          O resumo só será enviado ao Gemini quando você solicitar a geração. Na camada gratuita, o
          Google pode usar o conteúdo para melhorar seus produtos. Não envie dados pessoais ou
          conteúdo que não queira compartilhar. As traduções e respostas em português são geradas
          automaticamente e podem ser editadas antes de salvar.
        </p>

        @if (errorMessage) {
          <p class="message error" role="alert">{{ errorMessage }}</p>
        }
        @if (infoMessage) {
          <p class="message info" role="status">{{ infoMessage }}</p>
        }
        @if (needsMoreContext) {
          <p class="message info" role="status">{{ needsMoreContext }}</p>
        }

        <button
          type="button"
          class="primary-button"
          (click)="generate()"
          [disabled]="generating || saving || !summary.trim() || summary.length > 5000"
        >
          {{ generating ? 'Gerando sugestões...' : 'Gerar flashcards' }}
        </button>
      </section>

      @if (drafts.length) {
        <section class="draft-section" aria-labelledby="draft-heading">
          <div class="draft-heading">
            <div>
              <p class="eyebrow">REVISE ANTES DE SALVAR</p>
              <h2 id="draft-heading">Sugestões geradas</h2>
            </div>
            <span>{{ selectedCount }} selecionados</span>
          </div>

          <div class="draft-list">
            @for (draft of drafts; track draft.id) {
              <article class="draft-card">
                <label class="draft-select">
                  <input
                    type="checkbox"
                    [(ngModel)]="draft.selected"
                    [ngModelOptions]="{ standalone: true }"
                    [disabled]="saving"
                  />
                  Incluir este cartão
                </label>
                <button
                  type="button"
                  class="remove-button"
                  (click)="removeDraft(draft.id)"
                  [disabled]="saving"
                >
                  Remover
                </button>
                <label>
                  Frente em inglês
                  <textarea
                    [(ngModel)]="draft.front"
                    [ngModelOptions]="{ standalone: true }"
                    maxlength="500"
                    rows="2"
                    [disabled]="saving"
                  ></textarea>
                </label>
                <label>
                  {{
                    draft.type === 'cloze'
                      ? 'Resposta em português'
                      : 'Tradução em português'
                  }}
                  <textarea
                    [(ngModel)]="draft.back"
                    [ngModelOptions]="{ standalone: true }"
                    maxlength="500"
                    rows="2"
                    [disabled]="saving"
                  ></textarea>
                </label>
                <div class="draft-fields">
                  <label>
                    Palavra ou expressão em foco
                    <input
                      [(ngModel)]="draft.focus"
                      [ngModelOptions]="{ standalone: true }"
                      maxlength="120"
                      [disabled]="saving"
                    />
                  </label>
                  <label>
                    Tipo
                    <select
                      [(ngModel)]="draft.type"
                      [ngModelOptions]="{ standalone: true }"
                      [disabled]="saving"
                    >
                      <option value="vocabulary">Vocabulário</option>
                      <option value="sentence">Frase</option>
                      <option value="cloze">Lacuna</option>
                    </select>
                  </label>
                </div>
                <small>Origem: {{ draft.source || 'Não informada' }}</small>
              </article>
            }
          </div>

          <button
            type="button"
            class="primary-button"
            (click)="saveSelected()"
            [disabled]="saving || !selectedDraftsValid"
          >
            {{ saving ? 'Salvando...' : 'Salvar ' + selectedCount + ' cartões selecionados' }}
          </button>
        </section>
      }

      <footer class="page-footer">
        <a routerLink="/study-plan">Voltar ao plano de estudos</a>
        <a routerLink="/cards">Ver minha coleção</a>
      </footer>
    </main>
  `,
  styles: `
    :host {
      display: block;
      color: #e2e8f0;
      font-family: Inter, 'Segoe UI', sans-serif;
    }

    .generator-page {
      display: grid;
      width: min(100%, 980px);
      gap: 1.2rem;
      margin: 0 auto;
      padding: clamp(1.1rem, 3vw, 2.4rem);
    }

    .page-heading h1,
    h2,
    p {
      overflow-wrap: anywhere;
    }

    .eyebrow {
      margin: 0 0 0.4rem;
      color: #38bdf8;
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.14em;
    }

    h1 {
      margin: 0;
      color: #f1f5f9;
      font-size: clamp(1.6rem, 4vw, 2.15rem);
      letter-spacing: -0.035em;
    }

    .intro {
      max-width: 70ch;
      margin: 0.5rem 0 0;
      color: #94a3b8;
      font-size: 0.85rem;
      line-height: 1.6;
    }

    .generator-panel,
    .draft-section {
      display: grid;
      gap: 0.8rem;
      padding: clamp(1rem, 2.5vw, 1.4rem);
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.76);
    }

    h2 {
      margin: 0;
      color: #e2e8f0;
      font-size: 1rem;
    }

    label {
      display: grid;
      gap: 0.35rem;
      color: #cbd5e1;
      font-size: 0.72rem;
      font-weight: 650;
    }

    label span {
      color: #94a3b8;
      font-weight: 400;
    }

    textarea,
    input,
    select {
      width: 100%;
      min-width: 0;
      min-height: 40px;
      padding: 0.6rem 0.7rem;
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 7px;
      background: #0b1220;
      color: #e2e8f0;
      color-scheme: dark;
      font: inherit;
      font-size: 0.75rem;
    }

    textarea {
      resize: vertical;
    }

    textarea:focus,
    input:focus,
    select:focus {
      border-color: #38bdf8;
      outline: 2px solid rgba(56, 189, 248, 0.15);
    }

    .field-meta {
      display: grid;
      grid-template-columns: auto minmax(150px, 0.7fr) auto minmax(180px, 1fr) auto;
      align-items: center;
      gap: 0.65rem;
    }

    .field-meta label {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .field-meta select,
    .field-meta input {
      margin: 0;
    }

    .character-count {
      justify-self: end;
      color: #94a3b8;
      font-size: 0.68rem;
    }

    .privacy-notice {
      margin: 0;
      padding: 0.7rem;
      border: 1px solid rgba(251, 191, 36, 0.22);
      border-radius: 8px;
      background: rgba(120, 53, 15, 0.16);
      color: #fde68a;
      font-size: 0.72rem;
      line-height: 1.55;
    }

    .primary-button {
      justify-self: start;
      min-height: 40px;
      padding: 0.65rem 0.9rem;
      border: 1px solid rgba(56, 189, 248, 0.38);
      border-radius: 9px;
      background: #0e7490;
      color: #ecfeff;
      font: inherit;
      font-size: 0.78rem;
      font-weight: 750;
      cursor: pointer;
    }

    .primary-button:hover:not(:disabled) {
      background: #0891b2;
    }

    .primary-button:disabled,
    .remove-button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .message {
      margin: 0;
      font-size: 0.75rem;
      line-height: 1.5;
    }

    .message.error {
      color: #fecaca;
    }

    .message.info {
      color: #fde68a;
    }

    .draft-heading,
    .draft-card {
      position: relative;
    }

    .draft-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .draft-heading > span {
      color: #94a3b8;
      font-size: 0.72rem;
    }

    .draft-list {
      display: grid;
      gap: 0.75rem;
    }

    .draft-card {
      display: grid;
      gap: 0.7rem;
      padding: 0.9rem;
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 9px;
      background: rgba(2, 6, 23, 0.28);
    }

    .draft-card .draft-select {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      padding-right: 5rem;
    }

    .draft-select input {
      width: auto;
      min-height: auto;
      accent-color: #0891b2;
    }

    .remove-button {
      position: absolute;
      top: 0.7rem;
      right: 0.7rem;
      border: 0;
      background: transparent;
      color: #7dd3fc;
      font: inherit;
      font-size: 0.7rem;
      font-weight: 700;
      cursor: pointer;
    }

    .draft-fields {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.7rem;
    }

    .draft-card small {
      color: #94a3b8;
      font-size: 0.68rem;
    }

    .page-footer {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      font-size: 0.75rem;
    }

    .page-footer a {
      color: #7dd3fc;
      text-decoration: none;
    }

    .page-footer a:hover {
      text-decoration: underline;
    }

    @media (max-width: 700px) {
      .field-meta {
        grid-template-columns: auto 1fr;
      }

      .field-meta select,
      .field-meta input {
        grid-column: 1 / -1;
      }

      .character-count {
        grid-column: 2;
      }

      .draft-fields {
        grid-template-columns: 1fr;
      }
    }
  `,
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
