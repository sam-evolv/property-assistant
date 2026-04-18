'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ChevronDown, Mail, Calendar, BarChart3, Home } from 'lucide-react';
import { useApprovalDrawer } from '@/lib/agent-intelligence/drawer-store';
import { SKILL_LABELS } from '@/lib/agent-intelligence/envelope';
import type { AgenticSkillEnvelope } from '@/lib/agent-intelligence/tools/agentic-skills';

type Draft = AgenticSkillEnvelope['drafts'][number];

const ICON_MAP = {
  mail: Mail,
  calendar: Calendar,
  report: BarChart3,
  home: Home,
} as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);
}

// ── Draft body renderers ──────────────────────────────────────────────────────

function EmailDraft({ draft }: { draft: Draft }) {
  const isTbc = draft.recipient?.email?.includes('@tbc.invalid');

  return (
    <div>
      {/* Recipient row */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold"
          style={{ background: 'rgba(212,175,55,0.18)', color: '#D4AF37' }}
        >
          {draft.recipient ? initials(draft.recipient.name) : '?'}
        </div>
        <div style={{ fontSize: 13 }}>
          <span style={{ color: 'white', fontWeight: 500 }}>
            {draft.recipient?.name ?? 'Unknown'}
          </span>
          {draft.recipient?.role && (
            <span style={{ color: 'rgba(255,255,255,0.45)' }}> · {draft.recipient.role}</span>
          )}
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 1 }}>
            {draft.recipient?.email ?? ''}
          </div>
        </div>
      </div>

      {isTbc && (
        <div
          className="rounded-lg px-3 py-2 mb-4 flex items-center gap-2"
          style={{
            background: 'rgba(234,179,8,0.12)',
            border: '1px solid rgba(234,179,8,0.25)',
            fontSize: 12,
            color: '#FCD34D',
          }}
        >
          ⚠ Placeholder email — confirm recipient before sending.
        </div>
      )}

      {draft.subject && (
        <div className="mb-4">
          <p
            className="uppercase tracking-[0.08em] mb-1"
            style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}
          >
            Subject
          </p>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
            {draft.subject}
          </p>
        </div>
      )}

      <div>
        <p
          className="uppercase tracking-[0.08em] mb-2"
          style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}
        >
          Body
        </p>
        <pre
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.75)',
            whiteSpace: 'pre-wrap',
            fontFamily: 'inherit',
            lineHeight: 1.6,
          }}
        >
          {draft.body}
        </pre>
      </div>
    </div>
  );
}

function ReportDraft({ draft, skill }: { draft: Draft; skill: string }) {
  const isWeeklyBriefing = skill === 'weekly_monday_briefing';
  const lines = draft.body.split('\n');

  return (
    <div>
      {draft.subject && (
        <p className="mb-4 font-semibold" style={{ fontSize: 16, color: 'white' }}>
          {draft.subject}
        </p>
      )}

      {isWeeklyBriefing ? (
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7 }}>
          {lines.map((line, i) => {
            const trimmed = line.trim();
            const isSectionHeader =
              trimmed.length > 2 &&
              (/^[A-Z][A-Z\s:–\-]{3,}$/.test(trimmed) || trimmed.startsWith('## '));
            if (isSectionHeader) {
              const text = trimmed.replace(/^##\s*/, '');
              return (
                <p
                  key={i}
                  className="mt-4 mb-1 pb-0.5 font-semibold uppercase tracking-wider"
                  style={{
                    fontSize: 11,
                    color: '#D4AF37',
                    borderBottom: '1px solid rgba(212,175,55,0.3)',
                  }}
                >
                  {text}
                </p>
              );
            }
            return (
              <p key={i} style={{ minHeight: trimmed ? undefined : '0.5em' }}>
                {trimmed || null}
              </p>
            );
          })}
        </div>
      ) : (
        <pre
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.75)',
            whiteSpace: 'pre-wrap',
            fontFamily: 'inherit',
            lineHeight: 1.6,
          }}
        >
          {draft.body}
        </pre>
      )}
    </div>
  );
}

function ViewingRecordDraft({ draft }: { draft: Draft }) {
  let data: Record<string, unknown> = {};
  try {
    data = typeof draft.body === 'string' ? JSON.parse(draft.body) : {};
  } catch {
    // fall through to raw fallback
  }

  const fields: Array<[string, string]> = [];
  if (data.property || draft.subject) fields.push(['Property', String(data.property ?? draft.subject ?? '')]);
  if (data.buyer ?? data.buyer_name) fields.push(['Buyer', String(data.buyer ?? data.buyer_name)]);
  if (data.when ?? data.datetime ?? data.date) fields.push(['When', String(data.when ?? data.datetime ?? data.date)]);
  if (data.status) fields.push(['Status', String(data.status)]);
  if (data.notes) fields.push(['Notes', String(data.notes)]);

  if (!fields.length) {
    return (
      <pre
        style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.75)',
          whiteSpace: 'pre-wrap',
          fontFamily: 'inherit',
          lineHeight: 1.6,
        }}
      >
        {draft.body}
      </pre>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {fields.map(([label, value]) => (
        <div key={label}>
          <p
            className="uppercase tracking-[0.08em] mb-0.5"
            style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}
          >
            {label}
          </p>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{value}</p>
        </div>
      ))}
    </div>
  );
}

function ReasoningBlock({ reasoning }: { reasoning: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="mt-5 rounded-xl overflow-hidden"
      style={{ border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(255,255,255,0.04)', fontSize: 13, color: 'rgba(255,255,255,0.55)' }}
      >
        <span>Why this draft</span>
        <ChevronDown
          size={14}
          style={{ transition: 'transform 200ms', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      {open && (
        <div
          className="px-4 py-3"
          style={{
            background: 'rgba(255,255,255,0.02)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            fontSize: 13,
            color: 'rgba(255,255,255,0.6)',
            lineHeight: 1.6,
          }}
        >
          {reasoning}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ApprovalDrawer() {
  const { isOpen, envelope, close, draftStates, setDraftStatus } = useApprovalDrawer();
  const [panelOpen, setPanelOpen] = useState(false);
  const [draftIndex, setDraftIndex] = useState(0);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Panel open/close animation + focus management
  useEffect(() => {
    if (!isOpen) {
      setPanelOpen(false);
      prevFocusRef.current?.focus();
      prevFocusRef.current = null;
      return;
    }
    prevFocusRef.current = document.activeElement as HTMLElement;
    setDraftIndex(0);
    setFeedbackMsg(null);
    const rafId = requestAnimationFrame(() => {
      setPanelOpen(true);
      requestAnimationFrame(() => panelRef.current?.focus());
    });
    return () => cancelAnimationFrame(rafId);
  }, [isOpen]);

  // Clear advance timer on unmount
  useEffect(() => () => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
  }, []);

  // Reset feedback when navigating to a different draft
  useEffect(() => { setFeedbackMsg(null); }, [draftIndex]);

  // Keyboard: Escape, arrow keys, Tab focus-trap
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowRight') {
        setDraftIndex(i => Math.min(i + 1, (envelope?.drafts.length ?? 1) - 1));
        return;
      }
      if (e.key === 'ArrowLeft') {
        setDraftIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(el => !el.hasAttribute('disabled'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, close, envelope]);

  const handleAction = useCallback(
    async (action: 'approve' | 'discard') => {
      if (!envelope) return;
      const draft = envelope.drafts[draftIndex];
      if (!draft) return;

      setDraftStatus(draft.id, action === 'approve' ? 'approving' : 'discarding');

      try {
        const res = await fetch('/api/agent-intelligence/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draft, skill: envelope.skill, user_action: action }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        setDraftStatus(draft.id, action === 'approve' ? 'approved' : 'discarded');

        if (action === 'approve') {
          if (data.side_effects?.communication_event_id) {
            setFeedbackMsg('Sent. Logged to communications.');
          } else if (data.side_effects?.agent_viewing_id) {
            setFeedbackMsg('Viewing created.');
          } else if (draft.type === 'email') {
            setFeedbackMsg('Logged. Email transport not yet wired for lettings drafts.');
          } else {
            setFeedbackMsg('Completed.');
          }
        } else {
          setFeedbackMsg('Discarded.');
        }

        // Auto-advance to next pending draft, or close if all decided
        const delay = action === 'approve' ? 900 : 700;
        advanceTimerRef.current = setTimeout(() => {
          const drafts = envelope.drafts;
          let nextIdx: number | null = null;
          // Search forward from current position (skip current draft)
          for (let i = draftIndex + 1; i < drafts.length; i++) {
            if ((draftStates[drafts[i].id] ?? 'pending') === 'pending') {
              nextIdx = i;
              break;
            }
          }
          // Then wrap around to beginning
          if (nextIdx === null) {
            for (let i = 0; i < draftIndex; i++) {
              if ((draftStates[drafts[i].id] ?? 'pending') === 'pending') {
                nextIdx = i;
                break;
              }
            }
          }
          if (nextIdx !== null) {
            setDraftIndex(nextIdx);
          } else {
            close();
          }
        }, delay);
      } catch {
        setDraftStatus(draft.id, 'errored');
        setFeedbackMsg('Something went wrong. Try again.');
      }
    },
    [envelope, draftIndex, draftStates, setDraftStatus, close],
  );

  if (!envelope && !isOpen) return null;

  const skillInfo = SKILL_LABELS[envelope?.skill ?? ''] ?? {
    label: envelope?.skill ?? '',
    humanTitle: envelope?.skill ?? '',
    icon: 'report' as const,
  };
  const Icon = ICON_MAP[skillInfo.icon];
  const draftCount = envelope?.drafts.length ?? 0;
  const countLabel = draftCount === 1 ? '1 draft ready' : `${draftCount} drafts ready for review`;
  const draft = envelope?.drafts[draftIndex] ?? null;
  const draftState = draft ? (draftStates[draft.id] ?? 'pending') : 'pending';
  const isActing = draftState === 'approving' || draftState === 'discarding';
  const isDecided = draftState === 'approved' || draftState === 'discarded';
  const isErrored = draftState === 'errored';
  const showActionButtons = !isDecided && !isErrored;
  const showStatusBar = isDecided || isErrored;

  function dotColor(draftId: string, index: number): string {
    const state = draftStates[draftId] ?? 'pending';
    if (state === 'approved') return '#10B981';
    if (state === 'discarded') return 'rgba(239,68,68,0.45)';
    if (index === draftIndex) return '#D4AF37';
    return 'rgba(255,255,255,0.2)';
  }

  return (
    <>
      <style>{`
        .oh-ad-overlay { opacity: 0; transition: opacity 220ms ease-out; pointer-events: none; }
        .oh-ad-overlay.open { opacity: 1; pointer-events: auto; }
        .oh-ad-panel { transform: translateY(100%); transition: transform 260ms ease-out; }
        .oh-ad-panel.open { transform: translateY(0); }
        @media (min-width: 768px) {
          .oh-ad-panel { transform: translateX(100%); }
          .oh-ad-panel.open { transform: translateX(0); }
        }
        @keyframes oh-spin { to { transform: rotate(360deg); } }
        .oh-spinner {
          display: inline-block; width: 14px; height: 14px;
          border-radius: 50%; border: 2px solid currentColor;
          border-top-color: transparent;
          animation: oh-spin 0.7s linear infinite; vertical-align: middle;
        }
      `}</style>

      <div className="fixed inset-0 z-50" style={{ pointerEvents: panelOpen ? 'auto' : 'none' }}>
        {/* Overlay */}
        <div
          className={`absolute inset-0 oh-ad-overlay${panelOpen ? ' open' : ''}`}
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={close}
          tabIndex={-1}
          aria-hidden="true"
        />

        {/* Panel — mobile bottom sheet / desktop right panel */}
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="oh-ad-title"
          tabIndex={0}
          className={`absolute oh-ad-panel${panelOpen ? ' open' : ''}
            bottom-0 left-0 right-0 h-[86vh] rounded-t-2xl
            md:inset-y-0 md:left-auto md:right-0 md:w-[480px] md:h-auto md:rounded-l-2xl md:rounded-tr-none
            flex flex-col outline-none`}
          style={{ background: '#0b0c0f', color: 'rgba(255,255,255,0.92)' }}
        >
          {/* Drag handle — mobile only */}
          <div
            className="md:hidden mx-auto mt-2.5 mb-0 rounded-full flex-shrink-0"
            style={{ width: 38, height: 4, background: 'rgba(255,255,255,0.2)' }}
          />

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div
            className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
            style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(212,175,55,0.14)' }}
            >
              <Icon size={16} color="#D4AF37" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="uppercase tracking-[0.1em] font-medium" style={{ fontSize: 11, color: '#D4AF37' }}>
                {skillInfo.label}
              </p>
              <p id="oh-ad-title" className="font-medium mt-0.5 truncate" style={{ fontSize: 18, color: 'white' }}>
                {skillInfo.humanTitle}
              </p>
              <p className="mt-1" style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                {countLabel}
              </p>
            </div>
            <button
              onClick={close}
              aria-label="Close"
              className="flex-shrink-0 flex items-center justify-center rounded-md transition-colors"
              style={{ width: 28, height: 28, color: 'rgba(255,255,255,0.6)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'white')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
            >
              <X size={18} />
            </button>
          </div>

          {/* ── Pager strip ─────────────────────────────────────────────── */}
          <div
            className="flex items-center px-5 py-2.5 flex-shrink-0"
            style={{ borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}
          >
            <div className="flex items-center gap-1.5 flex-1">
              {Array.from({ length: draftCount }).map((_, i) => {
                const d = envelope?.drafts[i];
                const color = d ? dotColor(d.id, i) : 'rgba(255,255,255,0.2)';
                return (
                  <button
                    key={i}
                    onClick={() => setDraftIndex(i)}
                    aria-label={`Draft ${i + 1}`}
                    className="rounded-full transition-all"
                    style={{ width: 5, height: 5, background: color }}
                  />
                );
              })}
            </div>
            <span className="tabular-nums mx-3" style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
              Draft {draftIndex + 1} of {draftCount}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDraftIndex(i => Math.max(i - 1, 0))}
                disabled={draftIndex === 0}
                aria-label="Previous draft"
                className="flex items-center justify-center rounded-md transition-colors"
                style={{
                  width: 28, height: 28,
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.6)',
                  opacity: draftIndex === 0 ? 0.3 : 1,
                }}
                onMouseEnter={e => { if (draftIndex > 0) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; }}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setDraftIndex(i => Math.min(i + 1, draftCount - 1))}
                disabled={draftIndex === draftCount - 1}
                aria-label="Next draft"
                className="flex items-center justify-center rounded-md transition-colors"
                style={{
                  width: 28, height: 28,
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.6)',
                  opacity: draftIndex === draftCount - 1 ? 0.3 : 1,
                }}
                onMouseEnter={e => { if (draftIndex < draftCount - 1) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; }}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* ── Body ────────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-5 py-5" style={{ scrollbarWidth: 'none' }}>
            {draft && (
              <>
                {draft.type === 'email' && <EmailDraft draft={draft} />}
                {draft.type === 'report' && <ReportDraft draft={draft} skill={envelope?.skill ?? ''} />}
                {draft.type === 'viewing_record' && <ViewingRecordDraft draft={draft} />}
                {draft.reasoning && <ReasoningBlock key={draft.id} reasoning={draft.reasoning} />}
              </>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <div
            className="flex-shrink-0"
            style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)' }}
          >
            {/* Status / feedback bar */}
            {showStatusBar && feedbackMsg && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center gap-3 px-5 py-3"
                style={{
                  background: isErrored
                    ? 'rgba(239,68,68,0.12)'
                    : draftState === 'approved'
                    ? 'rgba(16,185,129,0.12)'
                    : 'rgba(255,255,255,0.05)',
                  fontSize: 13,
                  color: isErrored
                    ? '#FCA5A5'
                    : draftState === 'approved'
                    ? '#6EE7B7'
                    : 'rgba(255,255,255,0.55)',
                  paddingBottom: 18,
                }}
              >
                <span className="flex-1">{feedbackMsg}</span>
                {isErrored && draft && (
                  <button
                    onClick={() => { setDraftStatus(draft.id, 'pending'); setFeedbackMsg(null); }}
                    className="rounded px-3 py-1 text-xs font-medium flex-shrink-0"
                    style={{
                      background: 'rgba(239,68,68,0.2)',
                      color: '#FCA5A5',
                      border: '1px solid rgba(239,68,68,0.3)',
                    }}
                  >
                    Retry
                  </button>
                )}
              </div>
            )}

            {/* Action buttons */}
            {showActionButtons && (
              <div
                className="flex items-center gap-2 px-5 py-3"
                style={{ paddingBottom: 18 }}
              >
                <button
                  onClick={() => handleAction('discard')}
                  disabled={isActing}
                  aria-label="Discard this draft"
                  className="flex items-center justify-center rounded-xl font-medium transition-colors"
                  style={{
                    width: 88, height: 40, fontSize: 13, flexShrink: 0,
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.6)',
                    background: 'transparent',
                    opacity: isActing ? 0.5 : 1,
                    cursor: isActing ? 'not-allowed' : 'pointer',
                  }}
                >
                  {draftState === 'discarding' ? <span className="oh-spinner" /> : 'Discard'}
                </button>

                <button
                  disabled
                  aria-disabled="true"
                  title="Edit lands in next session"
                  className="flex items-center justify-center rounded-xl font-medium"
                  style={{
                    width: 88, height: 40, fontSize: 13, flexShrink: 0,
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.4)',
                    background: 'transparent',
                    opacity: 0.4,
                    cursor: 'not-allowed',
                  }}
                >
                  Edit
                </button>

                <button
                  onClick={() => handleAction('approve')}
                  disabled={isActing}
                  aria-label="Approve and send this draft"
                  className="flex items-center justify-center rounded-xl font-semibold transition-colors"
                  style={{
                    flex: 1, height: 40, fontSize: 13,
                    background: isActing ? 'rgba(212,175,55,0.6)' : '#D4AF37',
                    color: '#0b0c0f',
                    opacity: isActing ? 0.8 : 1,
                    cursor: isActing ? 'not-allowed' : 'pointer',
                  }}
                >
                  {draftState === 'approving' ? (
                    <span
                      className="oh-spinner"
                      style={{ borderColor: 'rgba(11,12,15,0.5)', borderTopColor: 'transparent' }}
                    />
                  ) : (
                    'Approve & send'
                  )}
                </button>
              </div>
            )}

            {/* Spacer when decided but feedback cleared */}
            {showStatusBar && !feedbackMsg && <div style={{ height: 18 }} />}
          </div>
        </div>
      </div>
    </>
  );
}
