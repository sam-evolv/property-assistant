/**
 * Regression guards for the shared formatting helpers.
 *
 * Issue 1.6 / CODE-ISSUE-005 — `formatEuro` covers the rent-formatting
 * bug where `€${1850.5}` ended up in tenant-facing renewal copy.
 *
 * Issue 1.7 / CODE-ISSUE-006 — `formatIrishDate` covers the BST evening
 * off-by-one where `new Date('2026-05-08')` parsed as UTC midnight and
 * formatted as "7 May" on runtimes west of UTC.
 *
 * Hermetic — pure functions, no Supabase, no network.
 */

import {
  formatEuro,
  formatIrishDate,
  parseIrishCalendarDate,
  daysUntilCalendarDate,
} from '../../lib/agent-intelligence/format-helpers';

describe('formatEuro (Issue 1.6)', () => {
  it('formats a whole-euro integer with locale separator', () => {
    expect(formatEuro(1850)).toBe('€1,850');
  });

  it('rounds a fractional value to whole euro', () => {
    expect(formatEuro(1850.5)).toBe('€1,851');
    expect(formatEuro(1850.49)).toBe('€1,850');
  });

  it('formats zero as €0', () => {
    expect(formatEuro(0)).toBe('€0');
  });

  it('treats null / undefined / NaN as €0', () => {
    expect(formatEuro(null)).toBe('€0');
    expect(formatEuro(undefined)).toBe('€0');
    expect(formatEuro(Number.NaN)).toBe('€0');
  });

  it('coerces a numeric-string input', () => {
    expect(formatEuro('2000')).toBe('€2,000');
    expect(formatEuro('1850.5')).toBe('€1,851');
  });

  it('formats large amounts with thousands separator', () => {
    expect(formatEuro(1234567)).toBe('€1,234,567');
  });
});

describe('parseIrishCalendarDate (Issue 1.7)', () => {
  it('parses YYYY-MM-DD at LOCAL midnight (not UTC midnight)', () => {
    const d = parseIrishCalendarDate('2026-05-08');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    // May = 4 (0-indexed)
    expect(d!.getMonth()).toBe(4);
    expect(d!.getDate()).toBe(8);
    // Stable: midnight in local time, so the hours portion is 0 regardless
    // of which TZ Node is running in.
    expect(d!.getHours()).toBe(0);
    expect(d!.getMinutes()).toBe(0);
  });

  it('returns null on invalid input', () => {
    expect(parseIrishCalendarDate(null)).toBeNull();
    expect(parseIrishCalendarDate('')).toBeNull();
    expect(parseIrishCalendarDate('not-a-date')).toBeNull();
  });

  it('falls back to standard Date parser for full ISO timestamps', () => {
    const d = parseIrishCalendarDate('2026-05-08T12:34:56Z');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
  });
});

describe('formatIrishDate (Issue 1.7)', () => {
  it('renders 8 May 2026 for the YYYY-MM-DD input regardless of TZ', () => {
    // Because parseIrishCalendarDate returns a Date constructed at LOCAL
    // midnight on the given calendar day, toLocaleDateString shows the
    // same day component in any timezone — the previous bug was that
    // new Date('2026-05-08') was UTC midnight, which formatted as "7 May"
    // in any TZ west of UTC.
    expect(formatIrishDate('2026-05-08')).toMatch(/\b8 May 2026\b/);
  });

  it('returns "unknown date" on null/empty', () => {
    expect(formatIrishDate(null)).toBe('unknown date');
    expect(formatIrishDate(undefined)).toBe('unknown date');
    expect(formatIrishDate('')).toBe('unknown date');
  });

  it('passes through unparseable strings unchanged', () => {
    expect(formatIrishDate('not-a-date')).toBe('not-a-date');
  });

  // TZ-switch sanity check: we can't fully simulate a different timezone
  // without restarting Node (TZ env var is read at startup on most
  // platforms), but we can at least demonstrate that the parsed Date's
  // day-of-month is preserved across simulated wall-clock instants.
  it('preserves day-of-month across an early-morning evaluation window', () => {
    // Simulate "now is 2026-05-09 00:30 local" and ask for 2026-05-09.
    // Output must read "9 May 2026" — the bug was that toLocaleDateString
    // saw UTC midnight = local 23:00 the previous day in BST and rendered
    // "8 May".
    const d = parseIrishCalendarDate('2026-05-09');
    expect(d!.getDate()).toBe(9);
    expect(formatIrishDate('2026-05-09')).toMatch(/\b9 May 2026\b/);
  });
});

describe('daysUntilCalendarDate (Issue 1.7)', () => {
  it('returns 0 when target equals today', () => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(daysUntilCalendarDate(iso, today)).toBe(0);
  });

  it('returns -1 for yesterday, +1 for tomorrow', () => {
    const t = new Date(2026, 4, 8); // 8 May 2026 local
    expect(daysUntilCalendarDate('2026-05-07', t)).toBe(-1);
    expect(daysUntilCalendarDate('2026-05-09', t)).toBe(1);
  });

  it('does not flip to -1 when wall-clock is past local midnight', () => {
    // The bug: the previous helper computed daysToLeaseEnd as
    //   floor((leaseEnd_UTC - now_local) / 86_400_000)
    // which on the actual end date in BST after 01:00 returned -1.
    // The new helper anchors both sides at LOCAL midnight, so it returns
    // 0 for the actual end date even at noon local time.
    const noonOfEndDate = new Date(2026, 4, 8, 12, 0, 0); // 8 May 2026 12:00 local
    expect(daysUntilCalendarDate('2026-05-08', noonOfEndDate)).toBe(0);
  });

  it('returns null on invalid input', () => {
    expect(daysUntilCalendarDate(null)).toBeNull();
    expect(daysUntilCalendarDate('not-a-date')).toBeNull();
  });
});
