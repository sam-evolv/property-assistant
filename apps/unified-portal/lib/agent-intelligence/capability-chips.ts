/**
 * Session 7 — capability chip library shown on the Intelligence landing.
 *
 * Intent: showcase Intelligence's full breadth (sales, lettings, drafts,
 * queries, scheduling, reporting, autonomy, scope) without a permanent
 * button grid. Four chips visible at a time, rotating every 6s.
 *
 * Each chip is phrased the way a working Irish estate agent would say it
 * — conversational, not command-style. The chip text is dropped into the
 * input bar when tapped; the user edits before sending.
 *
 * To add, remove, or re-word chips, edit this file. The carousel
 * component reads the export and shuffles on mount.
 */

export const CAPABILITY_CHIPS: readonly string[] = [
  // Sales pipeline
  "What's outstanding on contracts?",
  'Show me overdue chases',
  'Draft a buyer follow-up email',
  'What signed this week?',
  'Which units are still for sale?',

  // Lettings
  'Three people came to see 14 Oakfield',
  "Invite the O'Sheas to apply",
  'Show me applicants for Maple Court',
  'Which tenancies are up for renewal?',
  'Log a rental viewing for tomorrow',

  // Reporting & briefings
  'Generate developer weekly report',
  'Give me a scheme summary',
  "What's on for me today?",
  'Brief me on Árdan View',

  // Scheduling
  'Schedule a viewing for Saturday at 2pm',
  'What viewings do I have this week?',

  // Drafts & autonomy
  'Review my drafts',
  'Draft a price reduction notice',
  'Chase those three units about signing',

  // Scope / scheme switching
  'Switch to Rathárd Park',
  'Show me everything across all schemes',
] as const;

/**
 * Fisher–Yates shuffle. Pure function; callers should call it once on
 * mount to avoid re-shuffling on every render.
 */
export function shuffleChips(input: readonly string[]): string[] {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
