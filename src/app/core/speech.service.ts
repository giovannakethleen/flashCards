import { Injectable } from '@angular/core';

export type EnglishLocale = 'en-US' | 'en-GB';

interface RecognitionAlternative {
  transcript: string;
}

interface RecognitionResult extends ArrayLike<RecognitionAlternative> {
  isFinal: boolean;
}

interface RecognitionEvent {
  results: ArrayLike<RecognitionResult>;
}

interface RecognitionErrorEvent {
  error: string;
}

interface RecognitionController {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechWindow extends Window {
  SpeechRecognition?: new () => RecognitionController;
  webkitSpeechRecognition?: new () => RecognitionController;
}

export interface SpeechMatch {
  score: number;
  matchedWords: number;
  totalWords: number;
}

@Injectable({ providedIn: 'root' })
export class SpeechService {
  get isSupported() {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance !== 'undefined'
    );
  }

  get isRecognitionSupported() {
    if (typeof window === 'undefined') {
      return false;
    }

    const speechWindow = window as SpeechWindow;
    return Boolean(speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition);
  }

  startRecognition(
    locale: EnglishLocale,
    onTranscript: (transcript: string) => void,
    onError: (error: string) => void,
    onEnd: () => void,
  ): { stop: () => void } | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const speechWindow = window as SpeechWindow;
    const Recognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      return null;
    }

    const recognition = new Recognition();
    recognition.lang = locale;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .filter((result) => result.isFinal)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();

      if (transcript) {
        onTranscript(transcript);
      }
    };
    recognition.onerror = (event) => onError(event.error);
    recognition.onend = onEnd;
    recognition.start();

    return { stop: () => recognition.stop() };
  }

  compareTranscript(reference: string, transcript: string): SpeechMatch {
    const referenceWords = this.normalizeForComparison(reference);
    const spokenWords = this.normalizeForComparison(transcript);

    if (!referenceWords.length) {
      return { score: 0, matchedWords: 0, totalWords: 0 };
    }

    const previous = Array.from({ length: spokenWords.length + 1 }, (_, index) => index);
    const matchedWords = Array.from({ length: spokenWords.length + 1 }, () => 0);
    for (let referenceIndex = 1; referenceIndex <= referenceWords.length; referenceIndex += 1) {
      let diagonal = previous[0];
      let matchedDiagonal = matchedWords[0];
      previous[0] = referenceIndex;
      matchedWords[0] = 0;
      for (let spokenIndex = 1; spokenIndex <= spokenWords.length; spokenIndex += 1) {
        const above = previous[spokenIndex];
        const matchedAbove = matchedWords[spokenIndex];
        const substitutionCost =
          referenceWords[referenceIndex - 1] === spokenWords[spokenIndex - 1] ? 0 : 1;
        previous[spokenIndex] = Math.min(
          previous[spokenIndex] + 1,
          previous[spokenIndex - 1] + 1,
          diagonal + substitutionCost,
        );
        matchedWords[spokenIndex] =
          referenceWords[referenceIndex - 1] === spokenWords[spokenIndex - 1]
            ? matchedDiagonal + 1
            : Math.max(matchedWords[spokenIndex - 1], matchedAbove);
        diagonal = above;
        matchedDiagonal = matchedAbove;
      }
    }

    const editDistance = previous[spokenWords.length];
    const denominator = Math.max(referenceWords.length, spokenWords.length);
    const score = denominator ? Math.max(0, 1 - editDistance / denominator) : 0;

    return {
      score: Math.round(score * 100),
      matchedWords: matchedWords[spokenWords.length],
      totalWords: referenceWords.length,
    };
  }

  recognitionErrorMessage(error: string) {
    const messages: Record<string, string> = {
      'not-allowed': 'Permita o acesso ao microfone nas configurações do navegador para praticar.',
      'audio-capture': 'Nenhum microfone foi encontrado neste dispositivo.',
      'no-speech': 'Nenhuma fala foi detectada. Tente novamente quando estiver pronto.',
      network: 'O reconhecimento não está disponível no momento. Tente novamente mais tarde.',
      aborted: 'A prática de pronúncia foi interrompida.',
    };
    return messages[error] ?? 'Não foi possível reconhecer sua fala. Tente novamente.';
  }

  private normalizeForComparison(text: string) {
    const normalized = text
      .toLowerCase()
      .replace(/[^a-z0-9'\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return normalized ? normalized.split(' ') : [];
  }

  speak(text: string, locale: EnglishLocale = 'en-US', onError?: () => void): boolean {
    const phrase = text.trim();

    if (!phrase || !this.isSupported) {
      return false;
    }

    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.lang = locale;
    utterance.rate = 0.9;
    utterance.onerror = () => onError?.();

    const matchingVoice = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.lang.toLowerCase() === locale.toLowerCase());

    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return true;
  }
}
