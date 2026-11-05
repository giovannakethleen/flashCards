import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CardService } from './card.service';
import { SpeechService, type EnglishLocale } from '../core/speech.service';
import { TranslationService } from '../core/translation.service';

@Component({
  selector: 'app-quick-card-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './quick-card-form.html',
  styleUrl: './quick-card-form.scss',
})
export class QuickCardFormComponent implements OnInit {
  englishText = '';
  portugueseText = '';
  focusWord = '';
  category = '';
  batchText = '';
  duplicateMessage = '';
  private existingPhrases: Array<{ normalized: string; original: string }> = [];
  source = '';
  audioInfo = '';
  level = '';
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

  ngOnInit() {
    void this.loadExistingPhrases();
  }

  private async loadExistingPhrases() {
    try {
      const cards = await this.cardService.listCards();
      this.existingPhrases = cards.map((card) => ({
        normalized: this.normalizePhrase(card.english_text),
        original: card.english_text,
      }));
      this.checkForDuplicate();
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Não foi possível verificar frases duplicadas.';
    }
  }

  checkForDuplicate() {
    const phrase = this.normalizePhrase(this.englishText);
    this.duplicateMessage = '';
    if (phrase.length < 8) {
      return;
    }

    const match = this.existingPhrases.find(
      ({ normalized }) =>
        normalized.length > 0 &&
        normalized === phrase ||
        (normalized.length > 0 &&
          phrase.length >= 24 &&
          (normalized.includes(phrase) || phrase.includes(normalized))),
    );
    if (match) {
      this.duplicateMessage = `Você já tem uma frase parecida: “${match.original}”. Confira antes de salvar.`;
    }
  }

  private normalizePhrase(value: string) {
    return value.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ');
  }

  @HostListener('document:keydown', ['$event'])
  handleSaveShortcut(event: KeyboardEvent) {
    if (
      event.target instanceof HTMLElement &&
      event.target.closest('.batch-details')
    ) {
      return;
    }
    if (event.ctrlKey && event.key === 'Enter' && !this.isSubmitting && !this.isTranslating) {
      event.preventDefault();
      void this.saveCard(false);
    }
  }

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

  async saveCard(addAnother = false) {
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
        category: this.category || 'sentence',
        source: this.source,
        audio_info: this.audioInfo,
        level: this.level || null,
      });
      this.existingPhrases.push({
        normalized: this.normalizePhrase(this.englishText),
        original: this.englishText.trim(),
      });

      this.successMessage = addAnother
        ? 'Cartão salvo. Você já pode adicionar outra frase.'
        : 'Cartão salvo com sucesso.';
      this.englishText = '';
      this.portugueseText = '';
      this.translationMessage = '';
      this.translationError = false;
      this.focusWord = '';
      this.category = '';
      this.source = '';
      this.audioInfo = '';
      this.level = '';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar o cartão.';
      this.errorMessage = message;
    } finally {
      this.isSubmitting = false;
    }
  }

  async saveBatch() {
    this.errorMessage = '';
    this.successMessage = '';
    const lines = this.batchText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length || lines.length > 10) {
      this.errorMessage = 'Informe de 1 a 10 frases, uma por linha.';
      return;
    }

    this.isSubmitting = true;
    try {
      const inputs = [];
      for (const [index, line] of lines.entries()) {
        const separator = line.indexOf('|');
        const english = (separator >= 0 ? line.slice(0, separator) : line).trim();
        let portuguese = separator >= 0 ? line.slice(separator + 1).trim() : '';
        if (!english) {
          throw new Error(`A frase da linha ${index + 1} está vazia.`);
        }
        if (!portuguese) {
          if (!this.translation.enabled) {
            throw new Error(
              `A linha ${index + 1} não tem tradução e a tradução automática não está configurada.`,
            );
          }
          portuguese = (await this.translation.translateToPortuguese(english)).text;
        }
        inputs.push({
          english_text: english,
          portuguese_text: portuguese,
          category: this.category || 'sentence',
        });
      }

      await this.cardService.createCards(inputs);
      this.successMessage = `${inputs.length} cartões salvos com sucesso.`;
      this.batchText = '';
      this.existingPhrases.push(
        ...inputs.map((input) => ({
          normalized: this.normalizePhrase(input.english_text),
          original: input.english_text,
        })),
      );
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Não foi possível salvar as frases do lote.';
    } finally {
      this.isSubmitting = false;
    }
  }
}
