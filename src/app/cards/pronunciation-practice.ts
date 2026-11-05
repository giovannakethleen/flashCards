import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { PronunciationService, type PronunciationResult } from '../core/pronunciation.service';
import {
  SpeechService,
  type EnglishLocale,
  type SpeechMatch,
} from '../core/speech.service';

const MAX_RECORDING_SECONDS = 15;
const MAX_WAV_BYTES = 512 * 1024;
const TARGET_SAMPLE_RATE = 16_000;

@Component({
  selector: 'app-pronunciation-practice',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pronunciation-practice.html',
  styleUrl: './pronunciation-practice.scss',
})
export class PronunciationPracticeComponent implements OnInit, OnDestroy {
  @Input({ required: true }) referenceText = '';
  @Input() assessmentEnabled = false;
  @Input() initiallyOpen = false;
  @Input() compact = false;

  readonly maxSeconds = MAX_RECORDING_SECONDS;
  locale: EnglishLocale = 'en-US';
  isOpen = false;
  isRecording = false;
  isPreparing = false;
  isFinalizingRecording = false;
  isProcessing = false;
  consentGiven = false;
  secondsLeft = MAX_RECORDING_SECONDS;
  audioUrl: string | null = null;
  errorMessage = '';
  result: PronunciationResult | null = null;
  isRecognizingSpeech = false;
  recognizedTranscript = '';
  recognitionError = '';
  speechMatch: SpeechMatch | null = null;

  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private recordedAudio: Blob | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownTimer: ReturnType<typeof setTimeout> | null = null;
  private discardWhenStopped = false;
  private destroyed = false;
  private recordingRequest = 0;
  private recognitionSession: { stop: () => void } | null = null;

  constructor(
    private readonly pronunciation: PronunciationService,
    public readonly speech: SpeechService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.isOpen = this.initiallyOpen;
  }

  togglePanel() {
    this.isOpen = !this.isOpen;
    if (!this.isOpen) {
      this.recordingRequest += 1;
      this.isPreparing = false;
      this.discardWhenStopped = true;
      this.stopRecording();
      this.discardRecording();
      this.result = null;
      this.errorMessage = '';
      this.recognitionSession?.stop();
      this.recognitionSession = null;
      this.isRecognizingSpeech = false;
    }
  }

  toggleSpeechRecognition() {
    if (this.isRecognizingSpeech) {
      this.recognitionSession?.stop();
      return;
    }

    this.recognizedTranscript = '';
    this.speechMatch = null;
    this.recognitionError = '';
    try {
      this.recognitionSession = this.speech.startRecognition(
        this.locale,
        (transcript) => {
          this.recognizedTranscript = transcript;
          this.speechMatch = this.speech.compareTranscript(this.referenceText, transcript);
          this.changeDetector.markForCheck();
        },
        (error) => {
          this.recognitionError = this.speech.recognitionErrorMessage(error);
          this.changeDetector.markForCheck();
        },
        () => {
          this.isRecognizingSpeech = false;
          this.recognitionSession = null;
          this.changeDetector.markForCheck();
        },
      );
      if (!this.recognitionSession) {
        this.recognitionError = 'O reconhecimento de fala não está disponível neste navegador.';
        return;
      }
      this.isRecognizingSpeech = true;
    } catch (error) {
      this.recognitionSession = null;
      const errorCode =
        error instanceof Error && error.name === 'NotAllowedError' ? 'not-allowed' : 'unknown';
      this.recognitionError = this.speech.recognitionErrorMessage(errorCode);
    }
  }

  get speechMatchFeedback() {
    if (!this.speechMatch) {
      return '';
    }
    if (this.speechMatch.score >= 90) {
      return 'Ótimo resultado — continue praticando!';
    }
    if (this.speechMatch.score >= 70) {
      return 'Está chegando lá. Tente mais uma vez no seu ritmo.';
    }
    return 'Ouça a frase novamente e tente repetir com calma.';
  }

  async startRecording() {
    const requestId = ++this.recordingRequest;
    this.errorMessage = '';
    this.result = null;
    this.discardWhenStopped = false;
    this.discardRecording();

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      this.errorMessage = 'Este navegador não oferece suporte à gravação de áudio.';
      return;
    }

    this.isPreparing = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (this.destroyed || !this.isOpen || requestId !== this.recordingRequest) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      this.stream = stream;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((candidate) =>
        MediaRecorder.isTypeSupported(candidate),
      );
      this.recorder = mimeType
        ? new MediaRecorder(this.stream, { mimeType })
        : new MediaRecorder(this.stream);
      this.chunks = [];
      this.recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size) {
          this.chunks.push(event.data);
        }
      });
      this.recorder.addEventListener('stop', () => this.finishRecording(), { once: true });
      this.recorder.start();
      this.isRecording = true;
      this.secondsLeft = MAX_RECORDING_SECONDS;
      this.stopTimer = setTimeout(() => this.stopRecording(), MAX_RECORDING_SECONDS * 1000);
      this.tickCountdown();
    } catch (error) {
      if (this.destroyed || requestId !== this.recordingRequest) {
        return;
      }
      this.releaseMicrophone();
      this.errorMessage =
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'A permissão do microfone foi negada. Você pode permitir o acesso nas configurações do navegador.'
          : 'Não foi possível iniciar a gravação. Verifique o microfone e tente novamente.';
    } finally {
      if (requestId === this.recordingRequest) {
        this.isPreparing = false;
      }
    }
  }

  stopRecording() {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }

    const recorder = this.recorder;
    const wasRecording = recorder?.state === 'recording';
    if (wasRecording && recorder) {
      this.isFinalizingRecording = true;
      recorder.stop();
    } else {
      this.discardWhenStopped = false;
    }

    this.isRecording = false;
    if (this.countdownTimer) {
      clearTimeout(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.releaseMicrophone();
  }

  async submitForAssessment() {
    if (!this.recordedAudio || !this.consentGiven || !this.assessmentEnabled) {
      return;
    }

    this.errorMessage = '';
    this.isProcessing = true;

    try {
      const wav = await convertToWav(this.recordedAudio);
      if (wav.size > MAX_WAV_BYTES) {
        throw new Error('A gravação ficou grande demais. Grave uma frase mais curta.');
      }
      this.result = await this.pronunciation.assess(wav, this.referenceText, this.locale);
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Não foi possível processar a gravação.';
    } finally {
      this.isProcessing = false;
      this.discardRecording();
      this.consentGiven = false;
    }
  }

  describeError(errorType: string) {
    const descriptions: Record<string, string> = {
      None: 'sem apontamento',
      Omission: 'som possivelmente omitido',
      Insertion: 'som possivelmente acrescentado',
      Mispronunciation: 'som para praticar',
    };
    return descriptions[errorType] ?? 'verifique este trecho';
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.recognitionSession?.stop();
    this.recognitionSession = null;
    this.recordingRequest += 1;
    this.isPreparing = false;
    this.discardWhenStopped = true;
    this.stopRecording();
    this.discardRecording();
  }

  private finishRecording() {
    if (this.destroyed || this.discardWhenStopped) {
      this.discardWhenStopped = false;
      this.isFinalizingRecording = false;
      this.chunks = [];
      this.recorder = null;
      this.releaseMicrophone();
      return;
    }

    const blob = new Blob(this.chunks, { type: this.recorder?.mimeType || 'audio/webm' });
    this.chunks = [];
    this.recorder = null;
    this.isFinalizingRecording = false;

    if (blob.size === 0) {
      this.errorMessage = 'A gravação ficou vazia. Tente novamente.';
      this.releaseMicrophone();
      return;
    }

    this.recordedAudio = blob;
    this.audioUrl = URL.createObjectURL(blob);
    this.consentGiven = false;
    this.releaseMicrophone();
  }

  private tickCountdown() {
    if (!this.isRecording) {
      return;
    }

    this.secondsLeft = Math.max(0, this.secondsLeft - 1);
    this.countdownTimer = setTimeout(() => this.tickCountdown(), 1000);
  }

  private releaseMicrophone() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  private discardRecording() {
    if (this.audioUrl) {
      URL.revokeObjectURL(this.audioUrl);
    }
    this.audioUrl = null;
    this.recordedAudio = null;
    this.chunks = [];
  }
}

async function convertToWav(source: Blob): Promise<Blob> {
  const audioContext = new AudioContext();

  try {
    const decoded = await audioContext.decodeAudioData(await source.arrayBuffer());
    const samples = resampleMono(decoded, TARGET_SAMPLE_RATE);

    if (
      samples.length < TARGET_SAMPLE_RATE / 2 ||
      samples.length > TARGET_SAMPLE_RATE * MAX_RECORDING_SECONDS
    ) {
      throw new Error('A gravação deve ter entre meio segundo e 15 segundos.');
    }

    return encodeWav(samples, TARGET_SAMPLE_RATE);
  } finally {
    await audioContext.close();
  }
}

function resampleMono(audio: AudioBuffer, targetRate: number): Float32Array {
  const ratio = audio.sampleRate / targetRate;
  const outputLength = Math.floor(audio.length / ratio);
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(Math.floor((index + 1) * ratio), audio.length);
    let total = 0;
    for (let sample = start; sample < end; sample += 1) {
      for (let channel = 0; channel < audio.numberOfChannels; channel += 1) {
        total += audio.getChannelData(channel)[sample] ?? 0;
      }
    }
    output[index] = total / Math.max(1, (end - start) * audio.numberOfChannels);
  }

  return output;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  writeText(0, 'RIFF');
  view.setUint32(4, buffer.byteLength - 8, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
