'use client';

/**
 * VoiceCaptureCard. The post-viewing voice loop UI.
 *
 * Phase machine: idle → recording → transcribing → processing → review →
 * confirmed | error. The state lives entirely in the card. The parent
 * just hands in the viewing context and an onClose callback.
 *
 * Audio: MediaRecorder, webm/opus preferred. Hard cap at 90 seconds with a
 * 5-second countdown warning. No silence-based auto-stop, the agent
 * controls when to stop. This is intentionally different from the chat
 * input's useVoiceCapture hook (which cuts after 2s of silence).
 *
 * Mutation-integrity rule: every section in the review phase reads from
 * the API response envelope, never from optimistic state. Failed steps
 * render with a yellow alert icon and the error message, not a green
 * check.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Mic,
  Square,
  Check,
  AlertTriangle,
  Send,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  Save,
  SkipForward,
  Edit3,
  Info,
} from 'lucide-react';

type Phase = 'idle' | 'recording' | 'transcribing' | 'processing' | 'review' | 'confirmed' | 'error';

export interface VoiceCaptureViewing {
  id: string;
  applicant_name: string;
  development_name: string | null;
  scheduled_at: string;
  status: string;
}

type ExtractionConfidence = 'high' | 'medium' | 'low';

interface SavedActionsSummary {
  viewing_status: 'completed' | 'no_show' | null;
  notes_added: number;
  reminders_created: number;
  audit_log_id: string | null;
}

interface FollowUpEmail {
  pending_draft_id: string | null;
  subject: string;
  body: string;
  tone: 'warm' | 'neutral' | 'firm';
  addresses_concerns: string[];
}

interface PendingApprovalSummary {
  follow_up_email: FollowUpEmail | null;
  clarifications: string[];
}

interface ExecuteFailure {
  step:
    | 'resolve_viewing'
    | 'extract_actions'
    | 'mark_status'
    | 'append_notes'
    | 'create_reminders'
    | 'persist_draft'
    | 'unknown';
  message: string;
}

type Outcome =
  | 'high_interest'
  | 'mild_interest'
  | 'no_interest'
  | 'callback_needed'
  | 'viewing_didnt_happen';

interface CaptureResult {
  ok: boolean;
  transcript: string;
  confidence: ExtractionConfidence;
  outcome: Outcome;
  saved: SavedActionsSummary;
  pending_approval: PendingApprovalSummary;
  errors: ExecuteFailure[];
  viewing: {
    viewing_id: string;
    source: 'viewings' | 'agent_viewings';
    applicant_id: string | null;
    applicant_name: string;
    development_name: string | null;
    scheduled_at: string;
  };
}

interface VoiceCaptureCardProps {
  viewing: VoiceCaptureViewing;
  onClose: () => void;
  onConfirmed?: (result: CaptureResult) => void;
}

const MAX_DURATION_MS = 90_000;
const WARNING_AT_MS = MAX_DURATION_MS - 5_000;

const cardSurface: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: 18,
  padding: 18,
  width: '100%',
  maxWidth: 520,
  boxShadow:
    '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  fontFamily: 'inherit',
};

const labelText: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#6B7280',
  letterSpacing: 0,
};

const subtleHeading: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#6B7280',
};

const primaryButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '10px 14px',
  background: 'linear-gradient(180deg, #D4AF37 0%, #C49B2A 100%)',
  border: 'none',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 600,
  color: '#FFFFFF',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const secondaryButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '10px 14px',
  background: '#F4F4F5',
  border: '0.5px solid rgba(0,0,0,0.08)',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 600,
  color: '#0D0D12',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const tertiaryButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '10px 14px',
  background: 'transparent',
  border: 'none',
  fontSize: 13,
  fontWeight: 500,
  color: '#6B7280',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 13.5,
  border: '0.5px solid rgba(0,0,0,0.16)',
  borderRadius: 10,
  background: '#FFFFFF',
  color: '#0D0D12',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

function formatScheduled(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-IE', {
      timeZone: 'Europe/Dublin',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function outcomeLabel(outcome: Outcome): string {
  switch (outcome) {
    case 'high_interest':
      return 'completed (high interest)';
    case 'mild_interest':
      return 'completed (mild interest)';
    case 'no_interest':
      return 'completed (no interest)';
    case 'callback_needed':
      return 'completed (callback needed)';
    case 'viewing_didnt_happen':
      return 'no-show';
  }
}

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

export default function VoiceCaptureCard({ viewing, onClose, onConfirmed }: VoiceCaptureCardProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  // Edit state for the follow-up draft, seeded from the API response.
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [sendBusy, setSendBusy] = useState(false);
  const [sendStatus, setSendStatus] = useState<'pending' | 'sent' | 'skipped' | 'saved'>('pending');
  const [sendError, setSendError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBlobRef = useRef<Blob | null>(null);

  const cleanupRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  useEffect(() => () => cleanupRecording(), [cleanupRecording]);

  // When result.pending_approval.follow_up_email arrives, seed the edit
  // state. We re-seed on every result change so a Retry resets the form.
  useEffect(() => {
    const fu = result?.pending_approval.follow_up_email;
    if (fu) {
      setEditedSubject(fu.subject);
      setEditedBody(fu.body);
      setSendStatus('pending');
      setSendError(null);
    }
  }, [result]);

  async function startRecording() {
    setErrorText(null);
    setResult(null);
    setElapsed(0);
    chunksRef.current = [];
    lastBlobRef.current = null;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setErrorText('Microphone is not available on this device. Use the chat input instead.');
      setPhase('error');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: any) {
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setErrorText('Microphone permission denied. Allow access in your browser or device settings.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setErrorText('No microphone detected.');
      } else {
        setErrorText(err?.message || 'Could not start recording.');
      }
      setPhase('error');
      return;
    }

    streamRef.current = stream;
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setPhase('recording');

    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startedAtRef.current);
    }, 250);
    autoStopRef.current = setTimeout(() => {
      void stopRecording();
    }, MAX_DURATION_MS);
  }

  async function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recorder.state === 'inactive') {
      cleanupRecording();
      return;
    }

    await new Promise<void>((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        lastBlobRef.current = blob;
        cleanupRecording();
        resolve();
      };
      try {
        recorder.stop();
      } catch {
        cleanupRecording();
        resolve();
      }
    });

    setPhase('transcribing');
    await postCapture(lastBlobRef.current);
  }

  function cancelRecording() {
    cleanupRecording();
    chunksRef.current = [];
    lastBlobRef.current = null;
    setPhase('idle');
    setElapsed(0);
  }

  async function postCapture(blob: Blob | null) {
    if (!blob) {
      setErrorText('No audio captured. Try again.');
      setPhase('error');
      return;
    }
    // The backend endpoint runs transcription + extraction + orchestration
    // in one call. The "transcribing" → "processing" transition is purely
    // a UX nicety so the user sees progress; we use a short delay to swap
    // labels mid-request.
    const labelSwap = setTimeout(() => {
      setPhase((p) => (p === 'transcribing' ? 'processing' : p));
    }, 2500);

    try {
      const form = new FormData();
      form.append('audio', blob, 'capture.webm');
      form.append('viewing_id', viewing.id);

      const res = await fetch('/api/agent-intelligence/voice-capture/post-viewing', {
        method: 'POST',
        body: form,
      });

      clearTimeout(labelSwap);

      if (!res.ok) {
        let detail = '';
        try {
          const json = await res.json();
          detail = json?.error || json?.details || '';
        } catch {
          // ignore parse error
        }
        const message =
          res.status === 401
            ? 'You are signed out. Sign back in and try again.'
            : res.status === 403
              ? 'This viewing belongs to a different account.'
              : res.status === 413
                ? 'Recording is too long. Keep it under 90 seconds.'
                : detail || "Couldn't capture viewing. Try again.";
        setErrorText(message);
        setPhase('error');
        return;
      }

      const data = (await res.json()) as CaptureResult;
      setResult(data);
      setPhase('review');
    } catch (err) {
      clearTimeout(labelSwap);
      const message = err instanceof Error ? err.message : "Couldn't capture viewing. Try again.";
      setErrorText(message);
      setPhase('error');
    }
  }

  async function retry() {
    setErrorText(null);
    setResult(null);
    setSendError(null);
    setSendStatus('pending');
    if (lastBlobRef.current) {
      // We kept the blob from the prior attempt; re-upload without
      // re-recording so the agent doesn't have to repeat themselves.
      setPhase('transcribing');
      await postCapture(lastBlobRef.current);
      return;
    }
    setPhase('idle');
  }

  async function handleSendDraft() {
    if (!result?.pending_approval.follow_up_email?.pending_draft_id) return;
    const draftId = result.pending_approval.follow_up_email.pending_draft_id;
    setSendBusy(true);
    setSendError(null);
    try {
      // Persist any edits the agent made first.
      const edited =
        editedSubject !== result.pending_approval.follow_up_email.subject ||
        editedBody !== result.pending_approval.follow_up_email.body;
      if (edited) {
        const patchRes = await fetch(`/api/agent/intelligence/drafts/${draftId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject: editedSubject, body: editedBody }),
        });
        if (!patchRes.ok) {
          const j = await patchRes.json().catch(() => ({}));
          throw new Error(j?.error || 'Could not save edits');
        }
      }
      // Then send through the existing send-draft pipeline.
      const sendRes = await fetch('/api/agent/intelligence/send-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId, wasEdited: edited, mode: 'reviewed' }),
      });
      if (!sendRes.ok) {
        const j = await sendRes.json().catch(() => ({}));
        throw new Error(j?.error || 'Could not send draft');
      }
      setSendStatus('sent');
      setPhase('confirmed');
      onConfirmed?.(result);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not send draft');
    } finally {
      setSendBusy(false);
    }
  }

  async function handleSaveDraft() {
    if (!result?.pending_approval.follow_up_email?.pending_draft_id) return;
    const draftId = result.pending_approval.follow_up_email.pending_draft_id;
    setSendBusy(true);
    setSendError(null);
    try {
      const edited =
        editedSubject !== result.pending_approval.follow_up_email.subject ||
        editedBody !== result.pending_approval.follow_up_email.body;
      if (edited) {
        const res = await fetch(`/api/agent/intelligence/drafts/${draftId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject: editedSubject, body: editedBody }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || 'Could not save edits');
        }
      }
      setSendStatus('saved');
      setPhase('confirmed');
      onConfirmed?.(result);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not save draft');
    } finally {
      setSendBusy(false);
    }
  }

  async function handleSkipDraft() {
    if (!result?.pending_approval.follow_up_email?.pending_draft_id) {
      // No draft to discard, still treat as success.
      setSendStatus('skipped');
      setPhase('confirmed');
      if (result) onConfirmed?.(result);
      return;
    }
    const draftId = result.pending_approval.follow_up_email.pending_draft_id;
    setSendBusy(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/agent/intelligence/drafts/${draftId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Could not discard draft');
      }
      setSendStatus('skipped');
      setPhase('confirmed');
      onConfirmed?.(result);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not discard draft');
    } finally {
      setSendBusy(false);
    }
  }

  // ---------- Render branches ----------

  const headerLine = `Capture viewing with ${viewing.applicant_name}`;
  const subHeaderLine = `${viewing.development_name || 'the property'}, ${formatScheduled(viewing.scheduled_at)}`;
  const dismissButton = (
    <button
      type="button"
      aria-label="Close"
      onClick={onClose}
      style={{
        width: 28,
        height: 28,
        borderRadius: 999,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6B7280',
        fontFamily: 'inherit',
        flexShrink: 0,
      }}
    >
      <X size={16} strokeWidth={2.25} />
    </button>
  );

  if (phase === 'idle' || phase === 'recording') {
    const isRecording = phase === 'recording';
    const showAutoStopWarning = isRecording && elapsed >= WARNING_AT_MS;
    const remainingSeconds = Math.max(0, Math.ceil((MAX_DURATION_MS - elapsed) / 1000));

    return (
      <div style={cardSurface}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#0D0D12', letterSpacing: '-0.01em' }}>
              {headerLine}
            </span>
            <span style={{ fontSize: 12, color: '#A0A8B0' }}>{subHeaderLine}</span>
          </div>
          {dismissButton}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            padding: '14px 0 8px',
          }}
        >
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            className="agent-tappable"
            style={{
              width: 84,
              height: 84,
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              background: isRecording
                ? 'linear-gradient(180deg, #DC2626 0%, #B91C1C 100%)'
                : 'linear-gradient(180deg, #EF4444 0%, #DC2626 100%)',
              color: '#FFFFFF',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isRecording
                ? '0 0 0 8px rgba(220,38,38,0.15), 0 4px 16px rgba(220,38,38,0.30)'
                : '0 4px 14px rgba(220,38,38,0.22)',
              animation: isRecording ? 'voice-capture-pulse 1.6s ease-in-out infinite' : 'none',
            }}
          >
            {isRecording ? <Square size={28} strokeWidth={2.5} /> : <Mic size={32} strokeWidth={2.25} />}
          </button>

          {isRecording ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#0D0D12', letterSpacing: '-0.02em' }}>
                {formatElapsed(elapsed)}
              </span>
              <span style={{ fontSize: 12, color: '#6B7280' }}>Tap to stop, or auto-stop at 1:30</span>
              {showAutoStopWarning && (
                <span style={{ fontSize: 12, fontWeight: 600, color: '#B45309' }}>
                  Auto-stopping in {remainingSeconds}...
                </span>
              )}
            </div>
          ) : (
            <span style={{ fontSize: 12, color: '#6B7280', textAlign: 'center', maxWidth: 280 }}>
              Tap to record. 15 to 90 seconds describing how the viewing went, what they said, and
              what comes next.
            </span>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          {isRecording ? (
            <button type="button" style={tertiaryButton} onClick={cancelRecording} className="agent-tappable">
              Cancel
            </button>
          ) : (
            <button type="button" style={tertiaryButton} onClick={onClose} className="agent-tappable">
              Close
            </button>
          )}
        </div>

        <style>{`
          @keyframes voice-capture-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.06); }
          }
          @keyframes voice-capture-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (phase === 'transcribing' || phase === 'processing') {
    const label = phase === 'transcribing' ? 'Transcribing your recording...' : 'Working out what to do...';
    return (
      <div style={cardSurface}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#0D0D12', letterSpacing: '-0.01em' }}>
              {headerLine}
            </span>
            <span style={{ fontSize: 12, color: '#A0A8B0' }}>{subHeaderLine}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 4px' }}>
          <Loader2 size={18} style={{ color: '#C49B2A', animation: 'voice-capture-spin 1s linear infinite' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0D0D12' }}>{label}</span>
            <span style={{ fontSize: 12, color: '#6B7280' }}>
              Recorded {formatElapsed(elapsed)}. Usually takes a few seconds.
            </span>
          </div>
        </div>
        <style>{`
          @keyframes voice-capture-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (phase === 'confirmed' && result) {
    const followUpStatus =
      sendStatus === 'sent' ? 'Sent' : sendStatus === 'saved' ? 'Saved as draft' : 'Skipped';
    const actionsCount =
      (result.saved.viewing_status ? 1 : 0) +
      result.saved.notes_added +
      result.saved.reminders_created;
    return (
      <div style={cardSurface}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check size={16} strokeWidth={2.25} style={{ color: '#10703C' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0D0D12' }}>Captured</span>
        </div>
        <span style={{ fontSize: 12.5, color: '#6B7280' }}>
          {actionsCount} {actionsCount === 1 ? 'action' : 'actions'} saved. Follow-up {followUpStatus.toLowerCase()}.
        </span>
        <ReceiptDetails result={result} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" style={tertiaryButton} onClick={onClose} className="agent-tappable">
            Close
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div
        style={{
          ...cardSurface,
          border: '1px solid rgba(220,38,38,0.45)',
          boxShadow:
            '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(220,38,38,0.10), 0 0 0 0.5px rgba(220,38,38,0.20)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} strokeWidth={2.25} style={{ color: '#B91C1C' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#B91C1C' }}>Couldn&apos;t capture viewing</span>
        </div>
        <span style={{ fontSize: 12.5, color: '#0D0D12' }}>
          {errorText || 'Something went wrong. Try again or capture manually.'}
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={primaryButton} onClick={retry} className="agent-tappable">
            <Mic size={14} strokeWidth={2.25} />
            {lastBlobRef.current ? 'Retry' : 'Try again'}
          </button>
          <button type="button" style={tertiaryButton} onClick={onClose} className="agent-tappable">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // phase === 'review'
  if (!result) return null;
  const fu = result.pending_approval.follow_up_email;
  const showLowConfidence = result.confidence === 'low';

  return (
    <div style={cardSurface}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#0D0D12', letterSpacing: '-0.01em' }}>
            Captured: viewing with {viewing.applicant_name}
          </span>
          <span style={{ fontSize: 12, color: '#A0A8B0' }}>{subHeaderLine}</span>
        </div>
        {dismissButton}
      </div>

      {showLowConfidence && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 999,
            background: 'rgba(245,158,11,0.12)',
            color: '#92400E',
            fontSize: 12,
            fontWeight: 600,
            alignSelf: 'flex-start',
          }}
        >
          <AlertTriangle size={12} strokeWidth={2.25} />
          Low confidence, review carefully
        </div>
      )}

      {/* WHAT I HEARD */}
      <Section heading="What I heard">
        <button
          type="button"
          onClick={() => setTranscriptOpen((v) => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            color: '#0D0D12',
            fontSize: 12.5,
            fontWeight: 500,
            fontFamily: 'inherit',
          }}
        >
          {transcriptOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {transcriptOpen ? 'Hide transcript' : 'Show transcript'}
        </button>
        {transcriptOpen && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: '#FAFAF8',
              border: '0.5px solid rgba(0,0,0,0.06)',
              color: '#0D0D12',
              fontSize: 12.5,
              lineHeight: 1.55,
              fontStyle: 'italic',
              position: 'relative',
            }}
          >
            {result.transcript || '(no transcript)'}
            <button
              type="button"
              disabled
              title="Editing the transcript is coming soon."
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                background: 'rgba(0,0,0,0.04)',
                border: 'none',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                color: '#A0A8B0',
                cursor: 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              <Edit3 size={11} strokeWidth={2.25} />
              Edit
            </button>
          </div>
        )}
      </Section>

      {/* WHAT I DID */}
      <Section heading="Done">
        <SavedActionsList result={result} />
      </Section>

      {/* FOLLOW-UP DRAFT */}
      {fu && (
        <Section heading="Ready to send">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={labelText}>Subject</span>
              <input
                type="text"
                value={editedSubject}
                onChange={(e) => setEditedSubject(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={labelText}>Body</span>
              <textarea
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                rows={8}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 140, lineHeight: 1.55 }}
              />
            </div>
            {fu.addresses_concerns.length > 0 && (
              <span style={{ fontSize: 11.5, color: '#6B7280' }}>
                Addresses: {fu.addresses_concerns.join(', ')}
              </span>
            )}
            {sendError && (
              <span style={{ fontSize: 12, color: '#B91C1C' }}>{sendError}</span>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              <button
                type="button"
                style={primaryButton}
                disabled={sendBusy}
                onClick={handleSendDraft}
                className="agent-tappable"
              >
                {sendBusy ? (
                  <Loader2 size={14} style={{ animation: 'voice-capture-spin 1s linear infinite' }} />
                ) : (
                  <Send size={14} strokeWidth={2.25} />
                )}
                Send
              </button>
              <button
                type="button"
                style={secondaryButton}
                disabled={sendBusy}
                onClick={handleSaveDraft}
                className="agent-tappable"
              >
                <Save size={14} strokeWidth={2.25} />
                Save as draft
              </button>
              <button
                type="button"
                style={tertiaryButton}
                disabled={sendBusy}
                onClick={handleSkipDraft}
                className="agent-tappable"
              >
                <SkipForward size={14} strokeWidth={2.25} />
                Skip
              </button>
            </div>
          </div>
        </Section>
      )}

      {/* CLARIFICATIONS */}
      {result.pending_approval.clarifications.length > 0 && (
        <Section heading="Quick questions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {result.pending_approval.clarifications.map((q, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: '#FAFAF8',
                  border: '0.5px solid rgba(0,0,0,0.06)',
                }}
              >
                <span style={{ fontSize: 12.5, color: '#0D0D12' }}>{q}</span>
                <input
                  type="text"
                  placeholder="Optional answer for next time"
                  style={{ ...inputStyle, fontSize: 12.5, padding: '6px 8px' }}
                />
              </div>
            ))}
          </div>
        </Section>
      )}

      <style>{`
        @keyframes voice-capture-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B7280' }}>
        {heading}
      </span>
      {children}
    </div>
  );
}

interface SavedRow {
  key: string;
  ok: boolean;
  label: string;
  detail?: string;
  undoable: boolean;
}

function buildSavedRows(result: CaptureResult): SavedRow[] {
  const rows: SavedRow[] = [];
  const errStep = new Map<string, string>();
  for (const e of result.errors) errStep.set(e.step, e.message);

  // Status mark.
  if (result.saved.viewing_status) {
    rows.push({
      key: 'mark_status',
      ok: !errStep.has('mark_status'),
      label: `Marked viewing as ${outcomeLabel(result.outcome)}`,
      detail: errStep.get('mark_status'),
      undoable: false,
    });
  } else if (errStep.has('mark_status')) {
    rows.push({
      key: 'mark_status',
      ok: false,
      label: 'Could not update viewing status',
      detail: errStep.get('mark_status'),
      undoable: false,
    });
  }

  // Notes.
  if (result.saved.notes_added > 0) {
    rows.push({
      key: 'append_notes',
      ok: !errStep.has('append_notes'),
      label: `Added ${result.saved.notes_added} notes to ${result.viewing.applicant_name}'s record`,
      detail: errStep.get('append_notes'),
      undoable: false,
    });
  } else if (errStep.has('append_notes')) {
    rows.push({
      key: 'append_notes',
      ok: false,
      label: 'Could not save notes',
      detail: errStep.get('append_notes'),
      undoable: false,
    });
  }

  // Reminders.
  if (result.saved.reminders_created > 0) {
    rows.push({
      key: 'create_reminders',
      ok: !errStep.has('create_reminders'),
      label: `Created ${result.saved.reminders_created} ${result.saved.reminders_created === 1 ? 'reminder' : 'reminders'}`,
      detail: errStep.get('create_reminders'),
      undoable: false,
    });
  } else if (errStep.has('create_reminders')) {
    rows.push({
      key: 'create_reminders',
      ok: false,
      label: 'Could not create reminders',
      detail: errStep.get('create_reminders'),
      undoable: false,
    });
  }

  // Other generic errors (resolve_viewing, extract_actions, persist_draft).
  for (const e of result.errors) {
    if (e.step === 'mark_status' || e.step === 'append_notes' || e.step === 'create_reminders') continue;
    rows.push({
      key: e.step,
      ok: false,
      label: errorLabelForStep(e.step),
      detail: e.message,
      undoable: false,
    });
  }

  return rows;
}

function errorLabelForStep(step: ExecuteFailure['step']): string {
  switch (step) {
    case 'resolve_viewing':
      return 'Could not resolve viewing';
    case 'extract_actions':
      return 'Could not extract actions';
    case 'persist_draft':
      return 'Could not save follow-up draft';
    case 'unknown':
    default:
      return 'Something went wrong';
  }
}

function SavedActionsList({ result }: { result: CaptureResult }) {
  const rows = buildSavedRows(result);
  if (rows.length === 0) {
    return (
      <span style={{ fontSize: 12.5, color: '#6B7280' }}>
        Nothing changed yet. Review the transcript and try again.
      </span>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((r) => (
        <div
          key={r.key}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0' }}
        >
          {r.ok ? (
            <Check size={14} strokeWidth={2.5} style={{ color: '#10703C', marginTop: 2, flexShrink: 0 }} />
          ) : (
            <AlertTriangle size={14} strokeWidth={2.5} style={{ color: '#B45309', marginTop: 2, flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 12.5, color: '#0D0D12' }}>{r.label}</span>
            {r.detail && !r.ok && (
              <span style={{ fontSize: 11.5, color: '#B45309' }}>{r.detail}</span>
            )}
          </div>
          {r.ok && !r.undoable && (
            <span
              title="Undo isn't wired for this action yet. Edit manually in the Viewings tab or the applicant page."
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11.5,
                color: '#A0A8B0',
                flexShrink: 0,
              }}
            >
              <Info size={11} strokeWidth={2.25} />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function ReceiptDetails({ result }: { result: CaptureResult }) {
  const rows = buildSavedRows(result);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.map((r) => (
        <div key={r.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          {r.ok ? (
            <Check size={12} strokeWidth={2.5} style={{ color: '#10703C', marginTop: 3, flexShrink: 0 }} />
          ) : (
            <AlertTriangle size={12} strokeWidth={2.5} style={{ color: '#B45309', marginTop: 3, flexShrink: 0 }} />
          )}
          <span style={{ fontSize: 12, color: '#6B7280' }}>{r.label}</span>
        </div>
      ))}
    </div>
  );
}
