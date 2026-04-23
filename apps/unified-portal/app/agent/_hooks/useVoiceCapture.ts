'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  requestMicrophonePermission,
  openNativeSettings,
} from '@/lib/capacitor-native';

const OFFLINE_QUEUE_KEY = 'oh.agent.voice.offlineQueue.v1';
const SILENCE_THRESHOLD = 0.012;
const SILENCE_TIMEOUT_MS = 2000;

const MIC_DENIED_MESSAGE =
  'Microphone access is needed for voice capture. Open Settings → OpenHouse → Microphone to enable.';
const MIC_UNAVAILABLE_MESSAGE =
  'Microphone is not available in this browser. Use the typing input instead.';

export interface VoiceCaptureState {
  status: 'idle' | 'recording' | 'transcribing' | 'offline-queued' | 'error';
  partialTranscript: string;
  waveform: number[];
  errorMessage: string | null;
  /** True when the error is a permission denial — UI can offer a Settings deep-link. */
  permissionDenied: boolean;
  queuedCount: number;
}

export interface VoiceCaptureAPI extends VoiceCaptureState {
  start: () => Promise<void>;
  stop: () => Promise<string | null>;
  cancel: () => void;
  flushQueue: () => Promise<void>;
  /** Opens the native Settings app (iOS). No-op on web/desktop. */
  openSettings: () => Promise<boolean>;
}

interface QueuedBlob {
  id: string;
  mimeType: string;
  dataUrl: string;
  createdAt: number;
}

interface UseVoiceCaptureArgs {
  onTranscriptReady?: (transcript: string) => void;
}

/**
 * Drives the microphone button on the Intelligence screen.
 * - Live partials come from the Web Speech API when the browser supports it.
 * - The authoritative final transcript comes from POST /api/agent/intelligence/transcribe
 *   which runs Deepgram first and falls back to Whisper.
 * - If the network is offline when recording stops the audio is queued in
 *   localStorage and flushed when the browser reports online.
 */
export function useVoiceCapture({ onTranscriptReady }: UseVoiceCaptureArgs = {}): VoiceCaptureAPI {
  const [status, setStatus] = useState<VoiceCaptureState['status']>('idle');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [waveform, setWaveform] = useState<number[]>(new Array(28).fill(0.08));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const stopResolveRef = useRef<((transcript: string | null) => void) | null>(null);

  const refreshQueueCount = useCallback(() => {
    setQueuedCount(readQueue().length);
  }, []);

  useEffect(() => {
    refreshQueueCount();
  }, [refreshQueueCount]);

  useEffect(() => {
    const handleOnline = () => {
      flushQueueInternal().then(refreshQueueCount);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [refreshQueueCount]);

  useEffect(() => () => cleanup(), []);

  const cleanup = () => {
    if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch { /* noop */ }
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* noop */ }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    animFrameRef.current = null;
    silenceTimerRef.current = null;
    speechRecognitionRef.current = null;
  };

  const start = useCallback(async () => {
    if (status === 'recording' || status === 'transcribing') return;
    setErrorMessage(null);
    setPermissionDenied(false);
    setPartialTranscript('');

    try {
      // Capacitor iOS: request mic permission via the plugin FIRST.
      // Without this, WKWebView rejects getUserMedia on cold start (and on
      // older iOS builds `navigator.mediaDevices` is undefined until the
      // plugin warms the path up). `unavailable` = not native; fall through
      // to the web path.
      const native = await requestMicrophonePermission();
      if (native.status === 'denied') {
        setPermissionDenied(true);
        setErrorMessage(MIC_DENIED_MESSAGE);
        setStatus('error');
        return;
      }

      // Guard against `navigator.mediaDevices` being undefined — seen on
      // older iOS WKWebView and on insecure-context browsers. Before this
      // guard the app crashed with "undefined is not an object
      // (evaluating 'navigator.mediaDevices.getUserMedia')".
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        setErrorMessage(MIC_UNAVAILABLE_MESSAGE);
        setStatus('error');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Waveform monitor + silence detection.
      const AudioCtx: typeof AudioContext =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioCtx();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      let lastLoudAt = performance.now();

      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          const v = (buffer[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buffer.length);

        setWaveform((prev) => {
          const next = prev.slice(1);
          next.push(Math.min(1, Math.max(0.08, rms * 3.2)));
          return next;
        });

        if (rms > SILENCE_THRESHOLD) {
          lastLoudAt = performance.now();
        } else if (performance.now() - lastLoudAt > SILENCE_TIMEOUT_MS) {
          // 2 seconds of silence triggers stop.
          stop().catch(() => {});
          return;
        }

        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);

      // MediaRecorder captures the blob for server transcription.
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;

      // Web Speech API gives us live partials for the UI. Not available everywhere —
      // gracefully no-op if absent; the server transcript is the source of truth.
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        try {
          const sr = new SR();
          sr.continuous = true;
          sr.interimResults = true;
          sr.lang = 'en-IE';
          sr.onresult = (event: any) => {
            let interim = '';
            let finalText = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const res = event.results[i];
              if (res.isFinal) finalText += res[0].transcript;
              else interim += res[0].transcript;
            }
            setPartialTranscript((prev) => {
              const base = finalText ? (prev + finalText).trim() : prev;
              return interim ? `${base} ${interim}`.trim() : base;
            });
          };
          sr.onerror = () => { /* silent — we fall back to server transcription */ };
          sr.start();
          speechRecognitionRef.current = sr;
        } catch {
          speechRecognitionRef.current = null;
        }
      }

      setStatus('recording');
    } catch (err: any) {
      // iOS `NotAllowedError` (permission revoked mid-session) and
      // `NotFoundError` (no mic hardware) surface here. Mark as
      // permission-denied when the browser clearly says so.
      const name: string = err?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setPermissionDenied(true);
        setErrorMessage(MIC_DENIED_MESSAGE);
      } else {
        setErrorMessage(err?.message || 'Microphone unavailable');
      }
      setStatus('error');
      cleanup();
    }
  }, [status]);

  const stop = useCallback(async (): Promise<string | null> => {
    if (status !== 'recording') return null;

    return new Promise<string | null>((resolve) => {
      stopResolveRef.current = resolve;

      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        cleanup();
        setStatus('idle');
        resolve(null);
        stopResolveRef.current = null;
        return;
      }

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        cleanup();
        setStatus('transcribing');

        const transcript = await uploadForTranscription(blob).catch(() => null);

        if (transcript == null) {
          // Offline or transcription failed — queue locally.
          await queueBlob(blob);
          refreshQueueCount();
          setStatus('offline-queued');
          resolve(null);
          stopResolveRef.current = null;
          return;
        }

        setStatus('idle');
        setPartialTranscript('');
        onTranscriptReady?.(transcript);
        resolve(transcript);
        stopResolveRef.current = null;
      };

      try { recorder.stop(); } catch {
        cleanup();
        setStatus('idle');
        resolve(null);
        stopResolveRef.current = null;
      }
    });
  }, [status, onTranscriptReady, refreshQueueCount]);

  const cancel = useCallback(() => {
    cleanup();
    chunksRef.current = [];
    setStatus('idle');
    setPartialTranscript('');
    setErrorMessage(null);
    setPermissionDenied(false);
    if (stopResolveRef.current) {
      stopResolveRef.current(null);
      stopResolveRef.current = null;
    }
  }, []);

  const flushQueue = useCallback(async () => {
    await flushQueueInternal(onTranscriptReady);
    refreshQueueCount();
  }, [onTranscriptReady, refreshQueueCount]);

  const openSettings = useCallback(() => openNativeSettings(), []);

  return {
    status,
    partialTranscript,
    waveform,
    errorMessage,
    permissionDenied,
    queuedCount,
    start,
    stop,
    cancel,
    flushQueue,
    openSettings,
  };
}

// ────────────────────────────── helpers ──────────────────────────────

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const mt of candidates) {
    if (MediaRecorder.isTypeSupported?.(mt)) return mt;
  }
  return undefined;
}

async function uploadForTranscription(blob: Blob): Promise<string | null> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;

  const form = new FormData();
  form.append('audio', blob, `capture.${mimeExtension(blob.type)}`);

  try {
    const res = await fetch('/api/agent/intelligence/transcribe', {
      method: 'POST',
      body: form,
    });
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json.transcript === 'string' ? json.transcript : null;
  } catch {
    return null;
  }
}

function mimeExtension(mime: string): string {
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}

function readQueue(): QueuedBlob[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(next: QueuedBlob[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(next));
  } catch {
    // Quota exceeded — drop silently; the audio will be lost but the UI stays usable.
  }
}

async function queueBlob(blob: Blob): Promise<void> {
  const dataUrl = await blobToDataUrl(blob);
  const queue = readQueue();
  queue.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    mimeType: blob.type,
    dataUrl,
    createdAt: Date.now(),
  });
  writeQueue(queue);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string, mimeType: string): Blob {
  const base64 = dataUrl.split(',')[1] || '';
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

async function flushQueueInternal(onTranscript?: (t: string) => void): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  const queue = readQueue();
  if (queue.length === 0) return;

  const remaining: QueuedBlob[] = [];
  for (const entry of queue) {
    const blob = dataUrlToBlob(entry.dataUrl, entry.mimeType);
    const transcript = await uploadForTranscription(blob).catch(() => null);
    if (transcript) {
      onTranscript?.(transcript);
    } else {
      remaining.push(entry);
    }
  }
  writeQueue(remaining);
}
