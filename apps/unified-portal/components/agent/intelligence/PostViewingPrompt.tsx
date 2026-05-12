'use client';

/**
 * Proactive prompt that surfaces above the Intelligence chat input when the
 * agent has a viewing they just finished and haven't captured yet.
 *
 * Conditions checked against /api/agent/viewings (which already returns
 * hasCapture per row):
 *   - status='confirmed' or 'scheduled' or 'pending'
 *   - scheduled time is in the past (the viewing has happened)
 *   - within the last 2 hours
 *   - !hasCapture
 *
 * On Capture: opens a VoiceCaptureCard modal. On Dismiss: hides for this
 * session only, no DB persistence (it'll resurface on next page load).
 * If multiple viewings qualify, the most recent one wins.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, X } from 'lucide-react';
import VoiceCaptureCard from './VoiceCaptureCard';

interface ApiViewing {
  id: string;
  buyerName: string;
  schemeName: string | null;
  viewingDate: string;
  viewingTime: string;
  status: string;
  hasCapture?: boolean;
}

interface Candidate {
  id: string;
  applicant_name: string;
  development_name: string | null;
  scheduled_at: string;
  scheduled_ms: number;
  status: string;
}

const POLL_INTERVAL_MS = 30_000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function viewingToCandidate(v: ApiViewing): Candidate | null {
  if (!v.viewingDate || !v.viewingTime) return null;
  const iso = `${v.viewingDate}T${v.viewingTime.slice(0, 5)}:00`;
  const scheduledMs = new Date(iso).getTime();
  if (Number.isNaN(scheduledMs)) return null;
  return {
    id: v.id,
    applicant_name: v.buyerName,
    development_name: v.schemeName ?? null,
    scheduled_at: iso,
    scheduled_ms: scheduledMs,
    status: v.status,
  };
}

function pickMostRecent(viewings: ApiViewing[], dismissed: Set<string>, nowMs: number): Candidate | null {
  let best: Candidate | null = null;
  for (const v of viewings) {
    if (v.hasCapture) continue;
    if (dismissed.has(v.id)) continue;
    if (v.status !== 'confirmed' && v.status !== 'scheduled' && v.status !== 'pending') continue;
    const c = viewingToCandidate(v);
    if (!c) continue;
    const sinceMs = nowMs - c.scheduled_ms;
    if (sinceMs < 0 || sinceMs > TWO_HOURS_MS) continue;
    if (!best || c.scheduled_ms > best.scheduled_ms) best = c;
  }
  return best;
}

function humaniseAgo(scheduledMs: number, nowMs: number): string {
  const sinceMs = Math.max(0, nowMs - scheduledMs);
  const mins = Math.floor(sinceMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 minute ago';
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return '1 hour ago';
  return `${hours} hours ago`;
}

export default function PostViewingPrompt() {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [showCard, setShowCard] = useState(false);
  const dismissedRef = useRef<Set<string>>(new Set());
  const [, setNowTick] = useState(0);

  const fetchAndPick = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/viewings', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { viewings?: ApiViewing[] };
      const picked = pickMostRecent(data.viewings || [], dismissedRef.current, Date.now());
      setCandidate(picked);
    } catch {
      // Silent, proactive prompt is opportunistic; a failed poll just
      // means no card surfaces this cycle.
    }
  }, []);

  useEffect(() => {
    fetchAndPick();
    const interval = setInterval(fetchAndPick, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchAndPick]);

  // Re-render every 30s so the "X minutes ago" string stays fresh even
  // when the poll didn't return new data.
  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  function handleDismiss() {
    if (candidate) dismissedRef.current.add(candidate.id);
    setCandidate(null);
  }

  function handleCapture() {
    if (!candidate) return;
    setShowCard(true);
  }

  function handleCardClose() {
    setShowCard(false);
    // After capture closes, re-poll so the prompt disappears if the
    // viewing now has a capture marker.
    fetchAndPick();
  }

  if (!candidate && !showCard) return null;

  return (
    <>
      {candidate && !showCard && (
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 14,
            padding: '10px 12px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 20px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 8,
            border: '0.5px solid rgba(196,155,42,0.30)',
          }}
        >
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: 'rgba(196,155,42,0.12)',
              color: '#C49B2A',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Mic size={15} strokeWidth={2.25} />
          </span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#0D0D12',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Just finished with {candidate.applicant_name}?
            </span>
            <span
              style={{
                fontSize: 11.5,
                color: '#6B7280',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {candidate.development_name || 'Property'}, {humaniseAgo(candidate.scheduled_ms, Date.now())}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCapture}
            className="agent-tappable"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 999,
              background: 'linear-gradient(180deg, #D4AF37 0%, #C49B2A 100%)',
              border: 'none',
              fontSize: 12.5,
              fontWeight: 600,
              color: '#FFFFFF',
              cursor: 'pointer',
              fontFamily: 'inherit',
              flexShrink: 0,
            }}
          >
            <Mic size={12} strokeWidth={2.25} />
            Capture
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="agent-tappable"
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              border: 'none',
              background: 'transparent',
              color: '#A0A8B0',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontFamily: 'inherit',
            }}
          >
            <X size={14} strokeWidth={2.25} />
          </button>
        </div>
      )}

      {showCard && candidate && (
        <div
          onClick={handleCardClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 250,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '0 12px 20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 560,
              animation: 'slideUp 300ms cubic-bezier(.2,.8,.2,1)',
              maxHeight: '92dvh',
              overflowY: 'auto',
            }}
          >
            <VoiceCaptureCard
              viewing={{
                id: candidate.id,
                applicant_name: candidate.applicant_name,
                development_name: candidate.development_name,
                scheduled_at: candidate.scheduled_at,
                status: candidate.status,
              }}
              onClose={handleCardClose}
            />
          </div>
        </div>
      )}
    </>
  );
}
