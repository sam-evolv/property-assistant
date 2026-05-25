/**
 * Voice-input controller — framework-agnostic record→transcribe core for the
 * homeowner assistant composer (PurchaserChatTab).
 *
 * This is the portable subset of app/agent/_hooks/useVoiceCapture.ts: capture
 * audio, animate a waveform, auto-stop on 2s of silence, post to
 * /api/agent/intelligence/transcribe, and surface the transcript. It deliberately
 * DROPS useVoiceCapture's offline localStorage queue and its silent-queue-on-
 * failure behaviour: on the homeowner surface a failed transcription must show an
 * error (status 'error'), never silently queue a blob to replay out of context.
 *
 * It is PURE and dependency-injected (no React, no DOM globals at import time, no
 * Capacitor): the browser wiring lives in use-voice-input.ts. That split is what
 * lets the smoke test drive record / transcribe / error / silence-stop under tsx
 * with mocked deps, matching the repo's "inject for tests" pattern (cf.
 * callAgent(input, { client })).
 */

export type VoiceInputStatus = 'idle' | 'recording' | 'transcribing' | 'error';

export type MicPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unavailable';

export interface VoiceInputSnapshot {
  status: VoiceInputStatus;
  /** Rolling RMS levels (0..1), oldest→newest, for the recording waveform. */
  waveform: number[];
  /** Elapsed recording time in ms (for the mm:ss timer). */
  durationMs: number;
  errorMessage: string | null;
  /** True when the mic was explicitly denied — the UI can offer a Settings link. */
  permissionDenied: boolean;
}

/**
 * The slice of the native MediaRecorder surface the controller uses. Native
 * MediaRecorder is structurally compatible, so the browser layer passes it
 * through with a cast; the smoke test passes a hand-rolled fake.
 */
export interface RecorderHandle {
  start(): void;
  stop(): void;
  readonly state: string;
  readonly mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
}

export interface MicSession {
  recorder: RecorderHandle;
  /** Instantaneous input level (RMS 0..1), polled each tick for waveform + silence. */
  sampleLevel: () => number;
  /** Release the media stream and audio graph. */
  release: () => void;
}

export interface VoiceInputDeps {
  /** Ask for mic permission (native iOS path). Web returns 'unavailable' and we proceed. */
  requestPermission: () => Promise<MicPermissionStatus>;
  /** Acquire the mic and build a recorder + level sampler. Rejects on getUserMedia failure. */
  openMic: () => Promise<MicSession>;
  /** POST the recorded audio; resolve the transcript or throw. */
  transcribe: (audio: Blob, languageHint?: string | null) => Promise<string>;
  /** Schedule a repeating ~animation-frame tick. Returns a cancel fn. */
  scheduleTicks: (tick: () => void) => () => void;
  /** Monotonic-ish clock in ms. */
  now: () => number;
}

export interface VoiceInputCallbacks {
  onChange?: (snapshot: VoiceInputSnapshot) => void;
  onTranscriptReady?: (transcript: string) => void;
}

export const SILENCE_THRESHOLD = 0.012;
export const SILENCE_TIMEOUT_MS = 2000;
export const WAVEFORM_BARS = 28;
const WAVEFORM_FLOOR = 0.08;
const MIN_EMIT_INTERVAL_MS = 50; // cap UI updates at ~20fps so the host component doesn't re-render per frame

export const MIC_DENIED_MESSAGE =
  'Microphone access is off. Turn it on in Settings to use voice input.';
export const MIC_UNAVAILABLE_MESSAGE =
  "Microphone isn't available here. You can type your message instead.";
export const MIC_NO_HARDWARE_MESSAGE =
  'No microphone was found. You can type your message instead.';
export const TRANSCRIBE_FAILED_MESSAGE = "Couldn't transcribe that. Please try again.";

export class VoiceTranscribeError extends Error {
  constructor(message: string, public readonly status: number | null = null) {
    super(message);
    this.name = 'VoiceTranscribeError';
  }
}

/** Map a getUserMedia rejection to a resident-facing message (mirrors useVoiceCapture). */
export function micErrorMessage(err: unknown): string {
  const name = (err as { name?: string } | null)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
    return MIC_DENIED_MESSAGE;
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return MIC_NO_HARDWARE_MESSAGE;
  }
  // iOS throws TypeError/NotSupportedError on the insecure-context / missing-mediaDevices path.
  return MIC_UNAVAILABLE_MESSAGE;
}

function micErrorIsPermission(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name ?? '';
  return name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError';
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function freshWaveform(): number[] {
  return new Array(WAVEFORM_BARS).fill(WAVEFORM_FLOOR);
}

export class VoiceInputController {
  private status: VoiceInputStatus = 'idle';
  private waveform: number[] = freshWaveform();
  private durationMs = 0;
  private errorMessage: string | null = null;
  private permissionDenied = false;

  private session: MicSession | null = null;
  private chunks: Blob[] = [];
  private cancelTicks: (() => void) | null = null;
  private startedAt = 0;
  private lastLoudAt = 0;
  private lastEmitAt = 0;
  private stopping = false;
  private languageHint: string | null;

  constructor(
    private readonly deps: VoiceInputDeps,
    private readonly callbacks: VoiceInputCallbacks = {},
    options: { languageHint?: string | null } = {},
  ) {
    this.languageHint = options.languageHint ?? null;
  }

  getSnapshot(): VoiceInputSnapshot {
    return {
      status: this.status,
      waveform: this.waveform,
      durationMs: this.durationMs,
      errorMessage: this.errorMessage,
      permissionDenied: this.permissionDenied,
    };
  }

  setLanguageHint(hint: string | null | undefined): void {
    this.languageHint = hint ?? null;
  }

  private emit(): void {
    this.callbacks.onChange?.(this.getSnapshot());
  }

  async start(): Promise<void> {
    if (this.status === 'recording' || this.status === 'transcribing') return;

    this.errorMessage = null;
    this.permissionDenied = false;
    this.waveform = freshWaveform();
    this.durationMs = 0;

    const permission = await this.deps.requestPermission();
    if (permission === 'denied') {
      this.permissionDenied = true;
      this.errorMessage = MIC_DENIED_MESSAGE;
      this.status = 'error';
      this.emit();
      return;
    }

    let session: MicSession;
    try {
      session = await this.deps.openMic();
    } catch (err) {
      this.permissionDenied = micErrorIsPermission(err);
      this.errorMessage = micErrorMessage(err);
      this.status = 'error';
      this.emit();
      return;
    }

    this.session = session;
    this.chunks = [];
    session.recorder.ondataavailable = (event) => {
      const data = event?.data;
      if (data && data.size > 0) this.chunks.push(data);
    };

    this.startedAt = this.deps.now();
    this.lastLoudAt = this.startedAt;
    this.lastEmitAt = this.startedAt;
    this.cancelTicks = this.deps.scheduleTicks(() => this.tick());

    session.recorder.start();
    this.status = 'recording';
    this.emit();
  }

  private tick(): void {
    const session = this.session;
    if (!session || this.status !== 'recording') return;

    const now = this.deps.now();
    const level = clamp01(session.sampleLevel());
    this.durationMs = now - this.startedAt;

    if (level > SILENCE_THRESHOLD) {
      this.lastLoudAt = now;
    } else if (now - this.lastLoudAt > SILENCE_TIMEOUT_MS) {
      // 2s of silence ends the take, same as useVoiceCapture.
      void this.stop();
      return;
    }

    if (now - this.lastEmitAt >= MIN_EMIT_INTERVAL_MS) {
      this.lastEmitAt = now;
      const next = this.waveform.slice(1);
      next.push(Math.max(WAVEFORM_FLOOR, Math.min(1, level * 3.2)));
      this.waveform = next;
      this.emit();
    }
  }

  async stop(): Promise<string | null> {
    if (this.status !== 'recording' || this.stopping) return null;
    this.stopping = true;

    const session = this.session;
    if (!session || session.recorder.state === 'inactive') {
      this.teardownStream();
      this.status = 'idle';
      this.stopping = false;
      this.emit();
      return null;
    }

    return new Promise<string | null>((resolve) => {
      session.recorder.onstop = async () => {
        const mimeType = session.recorder.mimeType || 'audio/webm';
        const blob = new Blob(this.chunks, { type: mimeType });
        this.stopTicks();
        session.release();
        this.session = null;

        this.status = 'transcribing';
        this.emit();

        let transcript: string | null = null;
        try {
          transcript = await this.deps.transcribe(blob, this.languageHint);
        } catch {
          transcript = null;
        }

        this.stopping = false;

        if (!transcript) {
          // No silent queue: a failed transcription surfaces an error and the
          // homeowner keeps the keyboard.
          this.status = 'error';
          this.errorMessage = TRANSCRIBE_FAILED_MESSAGE;
          this.emit();
          resolve(null);
          return;
        }

        this.status = 'idle';
        this.emit();
        this.callbacks.onTranscriptReady?.(transcript);
        resolve(transcript);
      };

      try {
        session.recorder.stop();
      } catch {
        this.stopTicks();
        session.release();
        this.session = null;
        this.status = 'idle';
        this.stopping = false;
        this.emit();
        resolve(null);
      }
    });
  }

  /** Discard the in-progress recording without transcribing. */
  cancel(): void {
    this.teardownStream();
    this.chunks = [];
    this.stopping = false;
    this.status = 'idle';
    this.durationMs = 0;
    this.errorMessage = null;
    this.permissionDenied = false;
    this.waveform = freshWaveform();
    this.emit();
  }

  /** Release everything on unmount. No state emit (the component is gone). */
  dispose(): void {
    this.teardownStream();
    this.chunks = [];
  }

  private stopTicks(): void {
    if (this.cancelTicks) {
      this.cancelTicks();
      this.cancelTicks = null;
    }
  }

  private teardownStream(): void {
    this.stopTicks();
    if (this.session) {
      this.session.release();
      this.session = null;
    }
  }
}

function mimeExtension(mime: string): string {
  if (mime.includes('mp4') || mime.includes('m4a')) return 'mp4';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mp3') || mime.includes('mpeg')) return 'mp3';
  return 'webm';
}

/**
 * Default `transcribe` dep: POST the audio blob to the shared transcription
 * endpoint as multipart (field `audio`), optionally hinting the spoken language
 * (field `language`). Throws VoiceTranscribeError on a non-2xx or empty result so
 * the controller transitions to 'error'. fetchImpl is injectable for tests.
 */
export async function transcribeAudioBlob(
  audio: Blob,
  options: {
    languageHint?: string | null;
    fetchImpl?: typeof fetch;
    endpoint?: string;
  } = {},
): Promise<string> {
  const {
    languageHint,
    fetchImpl = fetch,
    endpoint = '/api/agent/intelligence/transcribe',
  } = options;

  const form = new FormData();
  form.append('audio', audio, `voice-note.${mimeExtension(audio.type || '')}`);
  if (languageHint) form.append('language', languageHint);

  const res = await fetchImpl(endpoint, { method: 'POST', body: form });
  if (!res.ok) {
    throw new VoiceTranscribeError(`transcription failed (${res.status})`, res.status);
  }

  const json = await res.json();
  const transcript = typeof json?.transcript === 'string' ? json.transcript.trim() : '';
  if (!transcript) {
    throw new VoiceTranscribeError('empty transcript', res.status);
  }
  return transcript;
}
