'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CAPABILITY_CHIPS,
  shuffleChips,
} from '@/lib/agent-intelligence/capability-chips';

const VISIBLE = 4;
const ROTATE_MS = 6_000;
const SLIDE_MS = 320;

interface CapabilityChipsCarouselProps {
  /**
   * Called when the user taps a chip. The parent prefills the input bar
   * and focuses it. The carousel does NOT auto-submit.
   */
  onChipTap: (text: string) => void;
  /**
   * When true the carousel stops rotating (e.g. the input has focus —
   * rotating chips under the cursor is disorienting).
   */
  paused?: boolean;
  /**
   * Allows callers to override the pool (tests). Defaults to the full
   * CAPABILITY_CHIPS list.
   */
  pool?: readonly string[];
}

/**
 * Session 7 — rotating chip carousel that sits above the input bar on
 * the Intelligence landing. Showcases Intelligence's capabilities without
 * a permanent button grid.
 *
 * Session 8 Bug 3 fix. Previous implementation rendered chips into a
 * flex-wrap container with per-chip CSS keyframes on every render. On
 * iPhone viewports that produced 5-6 visible chips during the slide
 * transition — flex-wrap spread the mount/unmount overlap across two
 * rows. The carousel now pins exactly four cells into a 2×2 grid
 * (`display: grid; grid-template-columns: repeat(2, 1fr);
 * grid-template-rows: repeat(2, auto)`). Outside the grid nothing ever
 * renders. The slide animation is scoped to an inner `<span>` keyed on
 * the chip's (idx,text) so it plays once on mount, not on every
 * re-render of the parent.
 *
 * Rotation behaviour:
 *   - 4 chips visible at any time (no more, no less)
 *   - Advances by one slot every 6 seconds
 *   - Pauses when the paused prop is true (parent wires this to input
 *     focus)
 *   - Pauses on pointer hover so the agent can read a chip before it
 *     rotates away
 *   - Respects `prefers-reduced-motion` — fade-swap instead of slide
 */
export default function CapabilityChipsCarousel({
  onChipTap,
  paused = false,
  pool = CAPABILITY_CHIPS,
}: CapabilityChipsCarouselProps) {
  const deck = useMemo(() => shuffleChips(pool), [pool]);
  const safeDeck = deck.length >= VISIBLE ? deck : [...deck, ...deck];

  const [offset, setOffset] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [fade, setFade] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const advance = useCallback(() => {
    if (reducedMotion) {
      setFade(0);
      window.setTimeout(() => {
        setOffset((o) => (o + 1) % safeDeck.length);
        setFade(1);
      }, 180);
    } else {
      setOffset((o) => (o + 1) % safeDeck.length);
    }
  }, [reducedMotion, safeDeck.length]);

  useEffect(() => {
    if (paused || hovered) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(advance, ROTATE_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused, hovered, advance]);

  const visible = useMemo(() => {
    const out: Array<{ key: string; text: string }> = [];
    for (let i = 0; i < VISIBLE; i++) {
      const idx = (offset + i) % safeDeck.length;
      out.push({ key: `${idx}-${safeDeck[idx]}`, text: safeDeck[idx] });
    }
    return out;
  }, [offset, safeDeck]);

  return (
    <div
      data-testid="capability-chips-carousel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={() => setHovered(true)}
      onTouchEnd={() => setHovered(false)}
      style={{
        // Fixed 2x2 grid — exactly four cells, never more, never less.
        // `overflow: hidden` clips any stray transform animation so a
        // mid-transition chip can't escape its cell.
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gridTemplateRows: 'repeat(2, auto)',
        gap: 8,
        padding: '0 16px',
        width: '100%',
        maxWidth: 360,
        margin: '0 auto',
        overflow: 'hidden',
        opacity: reducedMotion ? fade : 1,
        transition: reducedMotion ? `opacity ${SLIDE_MS}ms ease` : undefined,
      }}
    >
      {visible.map((chip) => (
        <Chip
          key={chip.key}
          text={chip.text}
          reducedMotion={reducedMotion}
          onTap={() => onChipTap(chip.text)}
        />
      ))}
    </div>
  );
}

function Chip({
  text,
  reducedMotion,
  onTap,
}: {
  text: string;
  reducedMotion: boolean;
  onTap: () => void;
}) {
  // The button fills its grid cell, never expands beyond it. The
  // slide-in animation lives on an inner span so re-renders of the
  // parent don't restart it — the <span>'s key is the chip text, so
  // React only plays the animation once, when the chip first mounts.
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`Tap to ask: ${text}`}
      data-testid="capability-chip"
      className="agent-tappable"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        maxWidth: '100%',
        padding: '0 12px',
        height: 36,
        borderRadius: 999,
        background: 'rgba(13,13,18,0.04)',
        border: '0.5px solid rgba(13,13,18,0.08)',
        color: '#0b0c0f',
        fontSize: 12.5,
        fontWeight: 500,
        lineHeight: 1,
        cursor: 'pointer',
        fontFamily: 'inherit',
        overflow: 'hidden',
      }}
    >
      <span
        key={text}
        style={{
          display: 'inline-block',
          maxWidth: '100%',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          animation: reducedMotion
            ? undefined
            : `oh-chip-slide-in ${SLIDE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
        }}
      >
        {text}
      </span>
      <style>{`
        @keyframes oh-chip-slide-in {
          from { transform: translateX(8px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </button>
  );
}
