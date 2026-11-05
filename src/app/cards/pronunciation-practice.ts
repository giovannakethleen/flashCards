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
  template: `
    <section class="practice">
      <button type="button" class="secondary" (click)="togglePanel()">
        {{ isOpen ? 'Fechar prática' : 'Praticar pronúncia' }}
      </button>

      @if (isOpen) {
        <div class="practice-panel">
          <label class="locale">
            Variante do inglês
            <select
              [(ngModel)]="locale"
              [disabled]="isRecording || isProcessing || isPreparing || isRecognizingSpeech"
            >
              <option value="en-US">Inglês americano (en-US)</option>
              <option value="en-GB">Inglês britânico (en-GB)</option>
            </select>
          </label>

          <p class="notice">
            Grave e ouça sua fala neste navegador. O áudio só será enviado para avaliação depois da
            sua confirmação. A avaliação é uma orientação para praticar, não uma nota definitiva nem
            uma exigência de imitar um falante nativo.
          </p>

          <section class="speech-match" aria-label="Feedback rápido de pronúncia">
            <h3>Feedback rápido de pronúncia</h3>
            <p class="notice">
              A nota compara a transcrição com a frase, não avalia fonemas. O reconhecimento pode
              processar áudio conforme as configurações do navegador.
            </p>
            <button
              type="button"
              class="secondary"
              (click)="toggleSpeechRecognition()"
              [disabled]="!speech.isRecognitionSupported || isRecording || isPreparing || isProcessing"
            >
              {{ isRecognizingSpeech ? 'Parar prática' : 'Falar a frase' }}
            </button>
            @if (!speech.isRecognitionSupported) {
              <p class="notice">O reconhecimento de fala não está disponível neste navegador.</p>
            } @else if (isRecognizingSpeech) {
              <p class="notice" role="status">Fale a frase em voz alta.</p>
            }
            @if (recognitionError) {
              <p class="error" role="alert">{{ recognitionError }}</p>
            }
            @if (recognizedTranscript && speechMatch) {
              <div class="speech-match-result" aria-live="polite">
                <p><strong>Você disse:</strong> {{ recognizedTranscript }}</p>
                <strong>Correspondência aproximada: {{ speechMatch.score }}%</strong>
                <p>
                  {{ speechMatch.matchedWords }} de {{ speechMatch.totalWords }} palavras
                  correspondidas. {{ speechMatchFeedback }}
                </p>
              </div>
            }
          </section>

          <div class="actions">
            @if (!isRecording) {
              <button
                type="button"
                class="primary"
                (click)="startRecording()"
                [disabled]="isProcessing || isPreparing || isFinalizingRecording || isRecognizingSpeech"
              >
                {{ isPreparing ? 'Solicitando microfone…' : 'Gravar (máx. ' + maxSeconds + ' s)' }}
              </button>
            } @else {
              <button type="button" class="danger" (click)="stopRecording()">Parar gravação</button>
              <span role="status">Gravando… {{ secondsLeft }} s restantes</span>
            }
          </div>

          @if (audioUrl) {
            <div class="recorded">
              <p>
                Gravação temporária — ela será descartada ao fechar esta prática ou sair da página.
              </p>
              <audio [src]="audioUrl" controls></audio>
            </div>
          }

          @if (audioUrl && assessmentEnabled) {
            <label class="consent">
              <input type="checkbox" [(ngModel)]="consentGiven" [disabled]="isProcessing" />
              <span>
                Entendo que, ao enviar, esta gravação e a frase de referência serão processadas pelo
                Azure Speech, na região configurada, para avaliar a pronúncia. O app não salva o
                áudio nem os detalhes do resultado; a retenção no Azure depende das configurações de
                logging. Consulte a
                <a
                  href="https://learn.microsoft.com/en-us/azure/ai-services/speech-service/logging-audio-transcription"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  documentação de retenção do Azure Speech
                </a>
                antes de consentir.
              </span>
            </label>
            <button
              type="button"
              class="primary"
              (click)="submitForAssessment()"
              [disabled]="!consentGiven || isProcessing"
            >
              {{ isProcessing ? 'Avaliando…' : 'Enviar para avaliação' }}
            </button>
          } @else if (audioUrl) {
            <p class="notice">
              A avaliação automática está desativada. Você ainda pode ouvir sua gravação; nenhum
              áudio será enviado.
            </p>
          }

          @if (errorMessage) {
            <p class="error" role="alert">{{ errorMessage }}</p>
          }

          @if (result) {
            <div class="result" aria-live="polite">
              <h3>Orientação para praticar</h3>
              <p>Os indicadores são estimativas automáticas e podem variar entre tentativas.</p>
              <ul>
                @if (result.accuracy !== null) {
                  <li>Precisão: {{ result.accuracy | number: '1.0-0' }}%</li>
                }
                @if (result.fluency !== null) {
                  <li>Fluência: {{ result.fluency | number: '1.0-0' }}%</li>
                }
                @if (result.completeness !== null) {
                  <li>Completude: {{ result.completeness | number: '1.0-0' }}%</li>
                }
                @if (result.pronunciation !== null) {
                  <li>Pronúncia geral: {{ result.pronunciation | number: '1.0-0' }}%</li>
                }
              </ul>

              @if (result.words.length) {
                <h4>Palavras e sons para revisar</h4>
                <ul class="word-list">
                  @for (word of result.words; track $index) {
                    <li>
                      <strong>{{ word.word }}</strong>
                      @if (word.accuracy !== null) {
                        <span> — {{ word.accuracy | number: '1.0-0' }}%</span>
                      }
                      @if (word.errorType) {
                        <span> ({{ describeError(word.errorType) }})</span>
                      }
                      @if (word.phonemes.length) {
                        <ul>
                          @for (phoneme of word.phonemes; track $index) {
                            <li>
                              /{{ phoneme.phoneme }}/
                              @if (phoneme.accuracy !== null) {
                                <span> — {{ phoneme.accuracy | number: '1.0-0' }}%</span>
                              }
                              @if (phoneme.errorType) {
                                <span> ({{ describeError(phoneme.errorType) }})</span>
                              }
                            </li>
                          }
                        </ul>
                      }
                    </li>
                  }
                </ul>
              } @else {
                <p>
                  Não houve apontamentos por palavra nesta tentativa. Continue praticando no seu
                  ritmo.
                </p>
              }
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .practice {
      margin-top: 0.8rem;
    }
    .practice-panel {
      display: grid;
      gap: 0.75rem;
      margin-top: 0.8rem;
      padding: 1rem;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.55);
    }
    .locale {
      display: grid;
      gap: 0.4rem;
      max-width: 360px;
    }
    select {
      padding: 0.65rem;
      border-radius: 8px;
      background: #0f172a;
      color: #e5e7eb;
      border: 1px solid rgba(96, 165, 250, 0.3);
      font: inherit;
    }
    .notice,
    .recorded p,
    .result p {
      margin: 0;
      color: #cbd5e1;
      line-height: 1.5;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    button {
      border: 0;
      border-radius: 10px;
      padding: 0.7rem 0.9rem;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .primary {
      background: #60a5fa;
      color: #0b1220;
    }
    .secondary {
      background: rgba(96, 165, 250, 0.12);
      color: #e5e7eb;
      border: 1px solid rgba(96, 165, 250, 0.25);
    }
    .danger {
      background: #991b1b;
      color: #fff;
    }
    .recorded {
      display: grid;
      gap: 0.5rem;
    }
    audio {
      width: min(100%, 420px);
    }
    .consent {
      display: flex;
      align-items: flex-start;
      gap: 0.6rem;
      color: #e5e7eb;
      line-height: 1.5;
    }
    .consent input {
      margin-top: 0.3rem;
    }
    .error {
      margin: 0;
      color: #fecaca;
    }
    .result {
      border-top: 1px solid rgba(96, 165, 250, 0.25);
      padding-top: 0.8rem;
    }
    .result h3,
    .result h4 {
      margin: 0.2rem 0 0.5rem;
    }
    .result ul {
      padding-left: 1.3rem;
      line-height: 1.6;
    }
    .speech-match {
      display: grid;
      gap: 0.55rem;
      padding: 0.9rem;
      border: 1px solid rgba(96, 165, 250, 0.2);
      border-radius: 10px;
      background: rgba(96, 165, 250, 0.05);
    }
    .speech-match h3,
    .speech-match-result p {
      margin: 0;
    }
    .speech-match-result {
      display: grid;
      gap: 0.35rem;
      color: #d1fae5;
      line-height: 1.5;
    }
    .word-list > li {
      margin-bottom: 0.45rem;
    }
  `,
})
export class PronunciationPracticeComponent implements OnInit, OnDestroy {
  @Input({ required: true }) referenceText = '';
  @Input() assessmentEnabled = false;
  @Input() initiallyOpen = false;

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
