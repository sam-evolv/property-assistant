/**
 * Honest capability chips (Session 11, polished in Session 12).
 *
 * The live chip list is sourced from real agent data via
 * `GET /api/agent/intelligence/capability-chips`. That endpoint reads
 * the agent's assigned schemes, letting properties, applicant /
 * tenancy / rental-viewing counts, and composes phrases that only
 * reference rows that actually exist.
 *
 * This file keeps a short context-free fallback set — no scheme
 * names, no property addresses, no buyer names, no "those three
 * units" style context-dependent phrasing. If the live fetch fails
 * or is still in flight, the carousel renders these; nothing it
 * says will disappoint when the user taps it.
 */

// Session 14.12 — chip copy is now ≤22 chars per phrase so the carousel
// chips render without ellipsis truncation on a 360px-wide grid. Each
// phrase still maps to a clear, action-oriented intent the chat surface
// can act on. Tap behaviour pre-fills the input with the chip text.
export const FALLBACK_CAPABILITY_CHIPS: readonly string[] = [
  "What's on today?",
  'Scheme summary',
  'Chase aged contracts',
  'Show overdue chases',
  'This week’s viewings',
  'Signed this week?',
  'Draft a follow-up',
  'Schedule a viewing',
  'Weekly report',
  'Invite an applicant',
] as const;

/** Fisher–Yates shuffle. Pure function; call once per mount. */
export function shuffleChips(input: readonly string[]): string[] {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Client-side fetch for the live capability chips. Falls back to the
 * static context-free set on any failure. Never throws.
 *
 * `mode` (optional) — when set to 'lettings', the server-side route
 * branches to the lettings chip composer (real tenancies + vacancies +
 * lettings-flavoured action phrases). Defaults to the sales composer
 * when omitted, preserving existing call-site behaviour.
 */
export async function fetchCapabilityChips(mode?: 'sales' | 'lettings'): Promise<string[]> {
  try {
    const url = mode === 'lettings'
      ? '/api/agent/intelligence/capability-chips?mode=lettings'
      : '/api/agent/intelligence/capability-chips';
    const res = await fetch(url, {
      cache: 'no-store',
    });
    if (!res.ok) return [...FALLBACK_CAPABILITY_CHIPS];
    const data = await res.json();
    if (!Array.isArray(data?.chips) || data.chips.length === 0) {
      return [...FALLBACK_CAPABILITY_CHIPS];
    }
    return (data.chips as unknown[])
      .filter((c): c is string => typeof c === 'string' && c.length > 0);
  } catch {
    return [...FALLBACK_CAPABILITY_CHIPS];
  }
}
