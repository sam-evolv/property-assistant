'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Mic, Send, Square } from 'lucide-react';
import type { VoiceCaptureState } from '../_hooks/useVoiceCapture';

interface VoiceInputBarProps {
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  isTyping: boolean;
  voice: VoiceCaptureState;
  onStart: () => void;
  onStop: () => void;
  isDesktop?: boolean;
  /**
   * Deep-link into the OS Settings app so the agent can enable the mic
   * without hunting for the toggle. Only shown on native when
   * `voice.permissionDenied` is true.
   */
  onOpenSettings?: () => Promise<boolean> | void;
  /** Session 7 — the carousel above pauses rotation while the input
      has focus so chips don't rotate under the user's typing cursor. */
  onFocus?: () => void;
  onBlur?: () => void;
}

/**
 * Unified input bar. In idle mode it behaves like the existing typed Intelligence
 * input. Tapping the mic transforms it into a live waveform + partial transcript.
 *
 * Exposes its underlying `<input>` via `ref` so callers can imperatively
 * focus it after a chip tap (Session 7 — CapabilityChipsCarousel).
 */
const VoiceInputBar = forwardRef<HTMLInputElement, VoiceInputBarProps>(function VoiceInputBar({
  input,
  onInputChange,
  onSend,
  isTyping,
  voice,
  onStart,
  onStop,
  isDesktop,
  onOpenSettings,
  onFocus,
  onBlur,
}, ref) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);
  const recording = voice.status === 'recording' || voice.status === 'transcribing';
  const micSize = isDesktop ? 40 : 34;
  const sendSize = 34;

  return (
    <div
      style={{
        background: 'rgba(250,250,248,0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '0.5px solid rgba(0,0,0,0.08)',
        padding: '12px 20px 16px',
        flexShrink: 0,
      }}
    >
      <div
        data-testid="voice-input-bar"
        data-recording={recording ? 'true' : 'false'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#F5F5F3',
          borderRadius: 28,
          border: recording
            ? '0.5px solid rgba(196,155,42,0.45)'
            : '0.5px solid rgba(0,0,0,0.08)',
          padding: '6px 6px 6px 14px',
          boxShadow: recording
            ? '0 0 0 3px rgba(196,155,42,0.12), 0 1px 2px rgba(0,0,0,0.04) inset'
            : '0 1px 2px rgba(0,0,0,0.04) inset',
          transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
          animation: recording ? 'oh-voice-pulse 1.6s ease-in-out infinite' : undefined,
        }}
      >
        {/* Mic toggle on the left */}
        <button
          data-testid="voice-mic-button"
          onClick={recording ? onStop : onStart}
          aria-label={recording ? 'Stop recording' : 'Start voice capture'}
          aria-pressed={recording}
          className="agent-tappable"
          style={{
            width: micSize,
            height: micSize,
            borderRadius: micSize / 2,
            border: 'none',
            background: recording
              ? 'linear-gradient(135deg, #C49B2A, #E8C84A)'
              : 'rgba(0,0,0,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 0.15s ease',
          }}
        >
          {recording ? (
            <Square size={14} color="#fff" fill="#fff" />
          ) : (
            <Mic size={isDesktop ? 17 : 15} color="#6B7280" />
          )}
        </button>

        {recording ? (
          <WaveformDisplay samples={voice.waveform} />
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder="Ask Intelligence anything..."
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: 14,
              fontWeight: 400,
              color: '#0D0D12',
              fontFamily: 'inherit',
              letterSpacing: '-0.01em',
            }}
          />
        )}

        {!recording && (
          <button
            onClick={onSend}
            disabled={!input.trim() || isTyping}
            aria-label="Send"
            style={{
              width: sendSize,
              height: sendSize,
              borderRadius: sendSize / 2,
              background: input.trim()
                ? 'linear-gradient(135deg, #C49B2A, #E8C84A)'
                : 'rgba(0,0,0,0.06)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: input.trim() ? 'pointer' : 'default',
              transition: 'background 0.15s ease',
              flexShrink: 0,
            }}
          >
            <Send size={15} color={input.trim() ? '#fff' : '#C0C8D4'} />
          </button>
        )}
      </div>

      {recording && voice.partialTranscript && (
        <p
          data-testid="voice-partial-transcript"
          style={{
            marginTop: 8,
            fontSize: 12.5,
            color: '#9CA3AF',
            letterSpacing: '0.005em',
            lineHeight: 1.45,
            padding: '0 6px',
          }}
        >
          {voice.partialTranscript}
        </p>
      )}

      {voice.status === 'transcribing' && (
        <p
          style={{
            marginTop: 8,
            fontSize: 12,
            color: '#9CA3AF',
            letterSpacing: '0.005em',
            textAlign: 'center',
          }}
        >
          Transcribing...
        </p>
      )}

      {voice.status === 'offline-queued' && voice.queuedCount > 0 && (
        <div
          data-testid="voice-offline-pill"
          style={{
            marginTop: 8,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 500,
              color: '#92400E',
              background: 'rgba(251,191,36,0.14)',
              border: '0.5px solid rgba(251,191,36,0.3)',
              padding: '4px 10px',
              borderRadius: 999,
              letterSpacing: '0.01em',
            }}
          >
            Will send when back online
            {voice.queuedCount > 1 ? ` · ${voice.queuedCount} queued` : ''}
          </span>
        </div>
      )}

      {voice.status === 'error' && voice.errorMessage && (
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <p
            style={{
              fontSize: 11.5,
              color: '#DC2626',
              textAlign: 'center',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {voice.errorMessage}
          </p>
          {voice.permissionDenied && onOpenSettings && (
            <button
              type="button"
              onClick={() => onOpenSettings()}
              className="agent-tappable"
              data-testid="voice-open-settings"
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: '#C49B2A',
                background: 'rgba(196,155,42,0.10)',
                border: '0.5px solid rgba(196,155,42,0.3)',
                padding: '4px 12px',
                borderRadius: 999,
                cursor: 'pointer',
              }}
            >
              Open Settings
            </button>
          )}
        </div>
      )}

      {!recording && voice.status !== 'offline-queued' && voice.status !== 'error' && (
        <p
          style={{
            textAlign: 'center',
            fontSize: 10,
            color: '#C0C8D4',
            marginTop: 8,
            letterSpacing: '0.01em',
          }}
        >
          Powered by AI. Information for reference only.
        </p>
      )}

      <style>{`
        @keyframes oh-voice-pulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(196,155,42,0.10), 0 1px 2px rgba(0,0,0,0.04) inset; }
          50% { box-shadow: 0 0 0 5px rgba(196,155,42,0.18), 0 1px 2px rgba(0,0,0,0.04) inset; }
        }
      `}</style>
    </div>
  );
});

export default VoiceInputBar;

function WaveformDisplay({ samples }: { samples: number[] }) {
  return (
    <div
      data-testid="voice-waveform"
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        height: 28,
        padding: '0 2px',
      }}
    >
      {samples.map((s, i) => (
        <span
          key={i}
          style={{
            flex: 1,
            height: `${Math.round(s * 100)}%`,
            background: 'linear-gradient(180deg, #E8C84A, #C49B2A)',
            borderRadius: 2,
            minHeight: 3,
            opacity: 0.55 + s * 0.45,
          }}
        />
      ))}
    </div>
  );
}
