'use client';

import { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Mail, Calendar, BarChart3, Home } from 'lucide-react';
import { useApprovalDrawer } from '@/lib/agent-intelligence/drawer-store';
import { SKILL_LABELS } from '@/lib/agent-intelligence/envelope';

const ICON_MAP = {
  mail: Mail,
  calendar: Calendar,
  report: BarChart3,
  home: Home,
} as const;

export function ApprovalDrawer() {
  const { isOpen, envelope, close } = useApprovalDrawer();
  const [draftIndex, setDraftIndex] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  // Reset pager + manage focus on open/close
  useEffect(() => {
    if (isOpen) {
      setDraftIndex(0);
      prevFocusRef.current = document.activeElement as HTMLElement;
      // Defer so the panel has transitioned into view
      const id = setTimeout(() => panelRef.current?.focus(), 50);
      return () => clearTimeout(id);
    } else {
      prevFocusRef.current?.focus();
      prevFocusRef.current = null;
    }
  }, [isOpen]);

  // Keyboard: Escape closes; arrow keys page through drafts; Tab focus-trap
  useEffect(() => {
    if (!isOpen) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowRight') { setDraftIndex(i => Math.min(i + 1, (envelope?.drafts.length ?? 1) - 1)); return; }
      if (e.key === 'ArrowLeft') { setDraftIndex(i => Math.max(i - 1, 0)); return; }

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

  // Don't render at all until first envelope arrives
  if (!envelope) return null;

  const skillInfo = SKILL_LABELS[envelope.skill] ?? {
    label: envelope.skill,
    humanTitle: envelope.skill,
    icon: 'report' as const,
  };
  const Icon = ICON_MAP[skillInfo.icon];
  const draftCount = envelope.drafts.length;
  const countLabel = draftCount === 1 ? '1 draft ready' : `${draftCount} drafts ready for review`;

  return (
    <>
      <style>{`
        .oh-ad-overlay {
          opacity: 0;
          transition: opacity 220ms ease-out;
          pointer-events: none;
        }
        .oh-ad-overlay.open {
          opacity: 1;
          pointer-events: auto;
        }
        /* Mobile: slide up from bottom */
        .oh-ad-panel {
          transform: translateY(100%);
          transition: transform 260ms ease-out;
        }
        .oh-ad-panel.open {
          transform: translateY(0);
        }
        /* Desktop: slide from right */
        @media (min-width: 768px) {
          .oh-ad-panel {
            transform: translateX(100%);
          }
          .oh-ad-panel.open {
            transform: translateX(0);
          }
        }
      `}</style>

      {/* Root: fixed full-viewport, non-interactive when closed */}
      <div
        className="fixed inset-0 z-50"
        style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
      >
        {/* Overlay */}
        <div
          className={`absolute inset-0 oh-ad-overlay${isOpen ? ' open' : ''}`}
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
          className={`absolute oh-ad-panel${isOpen ? ' open' : ''}
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

          {/* ── Header ────────────────────────────────────────────────── */}
          <div
            className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
            style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}
          >
            {/* Skill icon */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(212,175,55,0.14)' }}
            >
              <Icon size={16} color="#D4AF37" />
            </div>

            {/* Title column */}
            <div className="flex-1 min-w-0">
              <p
                className="uppercase tracking-[0.1em] font-medium"
                style={{ fontSize: 11, color: '#D4AF37' }}
              >
                {skillInfo.label}
              </p>
              <p
                id="oh-ad-title"
                className="font-medium mt-0.5 truncate"
                style={{ fontSize: 18, color: 'white' }}
              >
                {skillInfo.humanTitle}
              </p>
              <p className="mt-1" style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                {countLabel}
              </p>
            </div>

            {/* Close button */}
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

          {/* ── Pager strip ───────────────────────────────────────────── */}
          <div
            className="flex items-center px-5 py-2.5 flex-shrink-0"
            style={{ borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}
          >
            {/* Dots */}
            <div className="flex items-center gap-1.5 flex-1">
              {Array.from({ length: draftCount }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setDraftIndex(i)}
                  aria-label={`Draft ${i + 1}`}
                  className="rounded-full transition-all"
                  style={{
                    width: 5,
                    height: 5,
                    background: i === draftIndex ? '#D4AF37' : 'rgba(255,255,255,0.2)',
                  }}
                />
              ))}
            </div>

            {/* Draft counter */}
            <span
              className="tabular-nums mx-3"
              style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}
            >
              Draft {draftIndex + 1} of {draftCount}
            </span>

            {/* Prev / Next */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDraftIndex(i => Math.max(i - 1, 0))}
                disabled={draftIndex === 0}
                aria-label="Previous draft"
                className="flex items-center justify-center rounded-md transition-colors"
                style={{
                  width: 28,
                  height: 28,
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
                  width: 28,
                  height: 28,
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

          {/* ── Body ──────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: 'none' }}>
            <p
              className="text-center"
              style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', paddingTop: 80 }}
            >
              Draft rendering lands in the next session.
            </p>
          </div>

          {/* ── Footer ────────────────────────────────────────────────── */}
          <div
            className="flex-shrink-0 px-5 py-3"
            style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)', paddingBottom: 18 }}
          >
            <p
              className="text-center"
              style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}
            >
              Approve / Edit / Discard actions land in 4b.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
