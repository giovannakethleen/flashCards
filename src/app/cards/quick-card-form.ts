import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CardService } from './card.service';
import { SpeechService, type EnglishLocale } from '../core/speech.service';
import { TranslationService } from '../core/translation.service';

@Component({
  selector: 'app-quick-card-form',
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="form-shell">
      <section class="card">
        <div class="header">
          <h1>Adicionar frase</h1>
        </div>

        @if (errorMessage) {
          <p class="message error">{{ errorMessage }}</p>
        }

        @if (successMessage) {
          <p class="message success">{{ successMessage }}</p>
        }

        <label>
          <span>Frase em inglês *</span>
          <textarea
            [(ngModel)]="englishText"
            rows="4"
            placeholder="She has been studying a lot."
          ></textarea>
        </label>

        <div class="capture-row">
          <button type="button" class="soft" (click)="readClipboardText()">
            Ler área de transferência
          </button>
          <button
            type="button"
            class="soft"
            (click)="speakEnglishPreview()"
            [disabled]="!speech.isSupported"
            aria-label="Ouvir frase em inglês"
          >
            🔊 Ouvir frase
          </button>
        </div>

        @if (speechMessage) {
          <p class="message" role="status">{{ speechMessage }}</p>
        }

        <label>
          <span>Voz de áudio</span>
          <select [(ngModel)]="voiceLocale">
            <option value="en-US">Inglês americano</option>
            <option value="en-GB">Inglês britânico</option>
          </select>
        </label>

        <label>
          <span>Tradução em português *</span>
          <textarea
            [(ngModel)]="portugueseText"
            rows="4"
            placeholder="Ela tem estudado bastante."
          ></textarea>
        </label>
        <button
          type="button"
          class="soft translation-button"
          (click)="translateToPortuguese()"
          [disabled]="isTranslating || !translation.enabled"
        >
          {{ isTranslating ? 'Traduzindo...' : 'Traduzir para português' }}
        </button>
        @if (translationMessage) {
          <p class="message" [class.error]="translationError" role="status">
            {{ translationMessage }}
          </p>
        } @else if (!translation.enabled) {
          <p class="translation-hint">
            Tradução automática indisponível no momento. Você pode preencher o campo manualmente.
          </p>
        }

        <div class="grid">
          <label>
            <span>Palavra ou expressão em foco</span>
            <input [(ngModel)]="focusWord" type="text" placeholder="study" />
          </label>

          <label>
            <span>Tema / categoria</span>
            <input [(ngModel)]="category" type="text" placeholder="work / travel / food" />
          </label>
        </div>

        <div class="grid">
          <label>
            <span>Origem da frase</span>
            <input [(ngModel)]="source" type="text" placeholder="Livro / podcast / app" />
          </label>

          <label>
            <span>Informações para áudio</span>
            <input [(ngModel)]="audioInfo" type="text" placeholder="Pronúncia ou URL" />
          </label>
        </div>

        <div class="actions">
          <button
            type="button"
            class="primary"
            (click)="saveCard()"
            [disabled]="isSubmitting || isTranslating"
          >
            {{ isSubmitting ? 'Salvando...' : 'Salvar cartão' }}
          </button>
        </div>
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

    .form-shell {
      min-height: calc(100vh - 72px);
      padding: 1.5rem clamp(1rem, 4vw, 3.5rem);
      box-sizing: border-box;
    }

    .card {
      width: min(100%, 760px);
      margin: 0 auto;
      background: rgba(15, 23, 42, 0.94);
      border: 1px solid rgba(96, 165, 250, 0.22);
      padding: 2rem;
      border-radius: 18px;
      box-shadow: 0 18px 45px rgba(2, 6, 23, 0.42);
    }

    .header {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      margin-bottom: 1.25rem;
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
      font-size: clamp(1.9rem, 3vw, 2.6rem);
      color: #e5e7eb;
    }

    label {
      display: block;
      margin-top: 1rem;
      font-weight: 600;
      color: #dbeafe;
    }

    input,
    textarea,
    select {
      width: 100%;
      box-sizing: border-box;
      margin-top: 0.5rem;
      padding: 0.85rem 0.9rem;
      border: 1px solid rgba(96, 165, 250, 0.3);
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.7);
      color: #e5e7eb;
      font: inherit;
      resize: vertical;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }

    .capture-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-top: 0.75rem;
    }

    .actions {
      margin-top: 1.25rem;
      display: flex;
      justify-content: flex-end;
    }

    button {
      border: none;
      border-radius: 12px;
      font: inherit;
      cursor: pointer;
    }

    .soft {
      background: rgba(96, 165, 250, 0.12);
      color: #dbeafe;
      border: 1px solid rgba(96, 165, 250, 0.25);
      padding: 0.7rem 1rem;
      font-weight: 600;
    }

    .translation-button {
      margin-top: 0.65rem;
    }

    .translation-hint {
      margin: 0.55rem 0 0;
      color: #94a3b8;
      font-size: 0.82rem;
    }

    select {
      background: rgba(15, 23, 42, 0.7);
      color: #e5e7eb;
    }

    .primary {
      background: linear-gradient(135deg, #60a5fa 0%, #38bdf8 100%);
      color: #0b1220;
      padding: 0.9rem 1.3rem;
      font-weight: 700;
    }

    .secondary {
      background: rgba(96, 165, 250, 0.12);
      color: #e5e7eb;
      border: 1px solid rgba(96, 165, 250, 0.25);
      padding: 0.7rem 1rem;
      font-weight: 600;
    }

    .primary:disabled {
      opacity: 0.7;
      cursor: wait;
    }

    .message {
      margin: 0 0 0.75rem;
      padding: 0.75rem 0.9rem;
      border-radius: 10px;
      font-size: 0.95rem;
    }

    .error {
      background: #fef2f2;
      color: #b91c1c;
    }

    .success {
      background: #ecfdf5;
      color: #166534;
    }

    @media (max-width: 640px) {
      .grid {
        grid-template-columns: 1fr;
      }

      .header {
        flex-direction: column;
        align-items: stretch;
      }
    }
  `,
})
export class QuickCardFormComponent {
  englishText = '';
  portugueseText = '';
  focusWord = '';
  category = '';
  source = '';
  audioInfo = '';
  voiceLocale = 'en-US';
  speechMessage = '';
  errorMessage = '';
  successMessage = '';
  isSubmitting = false;
  isTranslating = false;
  translationMessage = '';
  translationError = false;

  constructor(
    private readonly cardService: CardService,
    public readonly speech: SpeechService,
    public readonly translation: TranslationService,
  ) {}

  async readClipboardText() {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      this.errorMessage = 'Leitura da área de transferência não está disponível neste navegador.';
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      this.englishText = text.trim();
      this.successMessage = 'Texto da área de transferência carregado para revisão.';
      this.errorMessage = '';
    } catch {
      this.errorMessage =
        'Não foi possível acessar a área de transferência. Cole o texto manualmente.';
    }
  }

  speakEnglishPreview() {
    this.speechMessage = '';
    const started = this.speech.speak(
      this.englishText,
      this.voiceLocale as EnglishLocale,
      () => (this.speechMessage = 'Não foi possível reproduzir o áudio. Tente novamente.'),
    );

    if (!started) {
      this.speechMessage = 'Digite uma frase e verifique se o navegador oferece reprodução de voz.';
    }
  }

  async translateToPortuguese() {
    const text = this.englishText.trim();
    if (!text) {
      this.translationError = true;
      this.translationMessage = 'Digite a frase em inglês antes de solicitar a tradução.';
      return;
    }

    if (
      this.portugueseText.trim() &&
      !window.confirm('Substituir a tradução que você já escreveu?')
    ) {
      return;
    }

    this.isTranslating = true;
    this.translationMessage = '';
    this.translationError = false;

    try {
      const result = await this.translation.translateToPortuguese(text);
      if (this.englishText.trim() !== text) {
        this.translationError = true;
        this.translationMessage =
          'A frase em inglês mudou durante a tradução. Solicite uma nova tradução para evitar usar um resultado desatualizado.';
        return;
      }
      this.portugueseText = result.text;
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

  async saveCard() {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.englishText.trim() || !this.portugueseText.trim()) {
      this.errorMessage = 'Frase em inglês e tradução em português são obrigatórias.';
      return;
    }

    this.isSubmitting = true;

    try {
      await this.cardService.createCard({
        english_text: this.englishText,
        portuguese_text: this.portugueseText,
        focus_word: this.focusWord,
        category: this.category,
        source: this.source,
        audio_info: this.audioInfo,
      });

      this.successMessage = 'Cartão salvo com sucesso.';
      this.englishText = '';
      this.portugueseText = '';
      this.translationMessage = '';
      this.translationError = false;
      this.focusWord = '';
      this.category = '';
      this.source = '';
      this.audioInfo = '';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar o cartão.';
      this.errorMessage = message;
    } finally {
      this.isSubmitting = false;
    }
  }
}
