import { Injectable } from '@angular/core';

export type EnglishLocale = 'en-US' | 'en-GB';

@Injectable({ providedIn: 'root' })
export class SpeechService {
  get isSupported() {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance !== 'undefined'
    );
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
