'use client';

/**
 * useVoiceInput — homeowner-composer voice input (PurchaserChatTab).
 *
 * Thin React wrapper over VoiceInputController (lib/assistant/voice-input-
 * controller.ts). This file owns the browser/Capacitor wiring; the controller
 * owns the record→transcribe state machine. Tap to record, tap to stop (or 2s of
 * silence auto-stops), the audio posts to /api/agent/intelligence/transcribe, and
 * the transcript is handed back via onTranscriptReady. No offline queue, and a
 * failed transcription surfaces as status 'error' (never a silent re-queue).
 *
 * Replaces the old Web Speech API path: MediaRecorder is supported on iOS Safari
 * 14.1+ where webkitSpeechRecognition is not, so the homeowner mic now works on
 * iOS, and the native permission prompt is primed via requestMicrophonePermission.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { requestMicrophonePermission, openNativeSettings } from '@/lib/capacitor-native';
import { lightImpact } from '@/lib/agent/haptics';
import {
  VoiceInputController,
  transcribeAudioBlob,
  WAVEFORM_BARS,
  type MicPermissionStatus,
  type MicSession,
  type RecorderHandle,
  type VoiceInputDeps,
  type VoiceInputSnapshot,
} from './voice-input-controller';

export interface VoiceInputAPI extends VoiceInputSnapshot {
  start: () => Promise<void>;
  stop: () => Promise<string | null>;
  cancel: () => void;
  /** Opens the native Settings app (iOS) so a denied mic can be re-enabled. */
  openSettings: () => Promise<boolean>;
}

interface UseVoiceInputArgs {
  onTranscriptReady?: (transcript: string) => void;
  /** Optional spoken-language hint (the homeowner's selected UI language). */
  languageHint?: string | null;
}

const IDLE_SNAPSHOT: VoiceInputSnapshot = {
  status: 'idle',
  waveform: new Array(WAVEFORM_BARS).fill(0.08),
  durationMs: 0,
  errorMessage: null,
  permissionDenied: false,
};

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

async function buildMicSession(): Promise<MicSession> {
  const getUserMedia: MediaDevices['getUserMedia'] | undefined =
    typeof navigator !== 'undefined'
      ? navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices)
      : undefined;
  if (!getUserMedia) {
    // Mirror the DOMException shape micErrorMessage() branches on.
    throw Object.assign(new Error('mediaDevices unavailable'), { name: 'NotSupportedError' });
  }

  const stream = await getUserMedia({ audio: true });

  // Waveform monitor. Optional — if AudioContext is missing we still record, the
  // bars just stay flat. sampleLevel closes over a const buffer (inferred type)
  // so it satisfies getByteTimeDomainData across TS versions.
  let audioContext: AudioContext | null = null;
  let sampleLevel: () => number = () => 0;
  const AudioCtx: typeof AudioContext | undefined =
    (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (AudioCtx) {
    audioContext = new AudioCtx();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const buffer = new Uint8Array(analyser.frequencyBinCount);
    sampleLevel = () => {
      analyser.getByteTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        const v = (buffer[i] - 128) / 128;
        sum += v * v;
      }
      return Math.sqrt(sum / buffer.length);
    };
  }

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

  return {
    recorder: recorder as unknown as RecorderHandle,
    sampleLevel,
    release: () => {
      stream.getTracks().forEach((t) => t.stop());
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
      }
    },
  };
}

function browserVoiceInputDeps(): VoiceInputDeps {
  return {
    requestPermission: async (): Promise<MicPermissionStatus> => {
      try {
        const native = await requestMicrophonePermission();
        return native.status;
      } catch {
        return 'unavailable';
      }
    },
    openMic: buildMicSession,
    transcribe: (audio, languageHint) => transcribeAudioBlob(audio, { languageHint }),
    scheduleTicks: (tick) => {
      let cancelled = false;
      let raf = 0;
      const loop = () => {
        if (cancelled) return;
        tick();
        if (!cancelled) raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
      };
    },
    now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  };
}

export function useVoiceInput({ onTranscriptReady, languageHint }: UseVoiceInputArgs = {}): VoiceInputAPI {
  const [snapshot, setSnapshot] = useState<VoiceInputSnapshot>(IDLE_SNAPSHOT);

  // Keep the callback current without re-creating the controller.
  const onTranscriptReadyRef = useRef(onTranscriptReady);
  onTranscriptReadyRef.current = onTranscriptReady;

  const controllerRef = useRef<VoiceInputController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new VoiceInputController(
      browserVoiceInputDeps(),
      {
        onChange: setSnapshot,
        onTranscriptReady: (t) => onTranscriptReadyRef.current?.(t),
      },
      { languageHint },
    );
  }

  useEffect(() => {
    controllerRef.current?.setLanguageHint(languageHint ?? null);
  }, [languageHint]);

  useEffect(() => () => controllerRef.current?.dispose(), []);

  const start = useCallback(async () => {
    void lightImpact();
    await controllerRef.current?.start();
  }, []);

  const stop = useCallback(async () => {
    void lightImpact();
    return (await controllerRef.current?.stop()) ?? null;
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.cancel();
  }, []);

  const openSettings = useCallback(() => openNativeSettings(), []);

  return { ...snapshot, start, stop, cancel, openSettings };
}
