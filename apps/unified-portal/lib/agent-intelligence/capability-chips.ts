/**
 * Session 11 — honest capability chips.
 *
 * The chip library is now SOURCED FROM LIVE DATA at render time via
 * `GET /api/agent/intelligence/capability-chips`. The endpoint reads
 * the agent's real assigned schemes, letting properties, applicants
 * and draft counts, and composes chip phrases that only reference rows
 * that exist.
 *
 * This file keeps a small fallback set of CONTEXT-FREE phrases — no
 * scheme names, no property addresses, no buyer names, no "those three
 * units" style context-dependent phrasing. If the live fetch fails or
 * is still in flight, the carousel renders these; nothing it says will
 * disappoint when the user taps it.
 */

export const FALLBACK_CAPABILITY_CHIPS: readonly string[] = [
  'Show me overdue chases',
  "What's on for me today?",
  'What viewings do I have this week?',
  'Generate developer weekly report',
  'Give me a scheme summary',
  'What signed this week?',
  'Chase aged contracts',
  'Draft a buyer follow-up email',
  'Invite an applicant',
  'Schedule a viewing for Saturday at 2pm',
  'Show me everything across all schemes',
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
 */
export async function fetchCapabilityChips(): Promise<string[]> {
  try {
    const res = await fetch('/api/agent/intelligence/capability-chips', {
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
