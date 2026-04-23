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
 * Rotation behaviour:
 *   - 4 chips visible at any time
 *   - Advances by one slot every 6 seconds
 *   - Pauses when the paused prop is true (parent wires this to input
 *     focus)
 *   - Pauses on pointer hover so the agent can read a chip before it
 *     rotates away
 *   - Respects `prefers-reduced-motion` — fade-swap instead of slide
 *
 * Why a window of four from a shuffled pool rather than randomised-on-
 * every-tick: predictable rotation lets the eye follow along, and
 * shuffling once per mount means first-impression chips differ session
 * to session.
 */
export default function CapabilityChipsCarousel({
  onChipTap,
  paused = false,
  pool = CAPABILITY_CHIPS,
}: CapabilityChipsCarouselProps) {
  // Shuffle once per mount so different sessions surface different
  // chips first. useMemo with an empty dep list; the shuffle output is
  // stable for the component lifetime.
  const deck = useMemo(() => shuffleChips(pool), [pool]);
  const safeDeck = deck.length >= VISIBLE ? deck : [...deck, ...deck];

  const [offset, setOffset] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [fade, setFade] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Detect prefers-reduced-motion. Updates live if the user toggles the
  // setting while the app is open.
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
      // Fade out, swap, fade in — gentler than the slide for
      // motion-sensitive users.
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
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        padding: '0 16px',
        width: '100%',
        maxWidth: 720,
        margin: '0 auto',
        opacity: reducedMotion ? fade : 1,
        transition: reducedMotion
          ? `opacity ${SLIDE_MS}ms ease`
          : undefined,
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
  // Slide-in animation: each chip is keyed on its idx-text so when the
  // rotation advances, React unmounts the leftmost chip and mounts a
  // fresh rightmost one. The fresh chip enters from the right via a
  // CSS keyframe. Reduced-motion users skip the keyframe.
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`Tap to ask: ${text}`}
      data-testid="capability-chip"
      className="agent-tappable"
      style={{
        maxWidth: '100%',
        padding: '0 14px',
        height: 36,
        borderRadius: 999,
        background: 'rgba(13,13,18,0.04)',
        border: '0.5px solid rgba(13,13,18,0.08)',
        color: '#0b0c0f',
        fontSize: 13,
        fontWeight: 500,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        cursor: 'pointer',
        fontFamily: 'inherit',
        animation: reducedMotion
          ? undefined
          : `oh-chip-slide-in ${SLIDE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
      }}
    >
      {text}
      <style>{`
        @keyframes oh-chip-slide-in {
          from { transform: translateX(12px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </button>
  );
}
