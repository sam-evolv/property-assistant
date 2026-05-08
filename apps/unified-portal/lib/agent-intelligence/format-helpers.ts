/**
 * Shared formatting helpers for skill outputs.
 *
 * Two concerns:
 *
 *  1. Currency formatting (Issue 1.6 / CODE-ISSUE-005)
 *     `€${rent}` interpolation lets a stored numeric like 1850.5 land in
 *     tenant-facing legal copy as "€1850.5". `formatEuro` runs every
 *     amount through `Intl.NumberFormat('en-IE', { currency: 'EUR' })`
 *     so the user sees "€1,851" — rounded to whole euro, with a
 *     thousands separator. This is the single source of truth for any
 *     Euro string the agent renders.
 *
 *  2. Timezone-stable date parsing (Issue 1.7 / CODE-ISSUE-006)
 *     `new Date('2026-05-08')` parses as UTC midnight. Formatting that
 *     value with `toLocaleDateString` on a runtime west of UTC (or
 *     even in BST when the wall-clock is past 01:00) can render as
 *     "7 May" instead of "8 May". `parseIrishCalendarDate` parses
 *     `YYYY-MM-DD` strings as LOCAL midnight via the (year, month, day)
 *     constructor so the displayed day matches the stored day no matter
 *     where the runtime is. Falls back to the standard `Date(string)`
 *     parser when the input already carries a time component (ISO with
 *     timezone) so existing call sites that pass full timestamps stay
 *     correct.
 */

const EURO_FORMATTER = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Render a number as a Euro string in en-IE locale. Whole euro only —
 * the renewal-cap math is rounded to multiples of €5 anyway, and tenant
 * copy reads cleaner without ".00" everywhere.
 *
 * `null` / `undefined` / non-finite values render as "€0" rather than
 * "€NaN" — the one place this matters (rent_pcm absent on a tenancy)
 * was previously rendering "€0" via raw `Number(t.rent_pcm ?? 0)`, so
 * this preserves the existing behaviour.
 */
export function formatEuro(amount: number | string | null | undefined): string {
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return EURO_FORMATTER.format(0);
  return EURO_FORMATTER.format(n);
}

const YYYY_MM_DD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse a date string into a Date positioned at LOCAL midnight when the
 * input is `YYYY-MM-DD`. For full ISO timestamps (containing a `T` or
 * `Z`), defers to `new Date(input)` since those carry their own
 * timezone information.
 *
 * Returns null when the input doesn't parse — callers fall back to
 * displaying the raw string in that case.
 */
export function parseIrishCalendarDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  const dateOnlyMatch = trimmed.match(YYYY_MM_DD_RE);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Day-of-month difference between `iso` and `now`, computed at midnight
 * local time on both sides. Avoids the BST-evening-after-midnight-UTC
 * off-by-one that bit `draftLeaseRenewal` (CODE-ISSUE-006): a renewal
 * email used to read "lease ended 1 day ago" on the actual end date
 * because `Date.now()` was a wall-clock instant while the parsed
 * `lease_end` was UTC midnight.
 */
export function daysUntilCalendarDate(
  iso: string | null | undefined,
  now: Date = new Date(),
): number | null {
  const target = parseIrishCalendarDate(iso);
  if (!target) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ms = target.getTime() - today.getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Format an Irish calendar date as "8 May 2026". Stable across executor
 * timezones for `YYYY-MM-DD` inputs.
 */
export function formatIrishDate(iso: string | null | undefined): string {
  if (!iso) return 'unknown date';
  const date = parseIrishCalendarDate(iso);
  if (!date) return iso;
  return date.toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
}
