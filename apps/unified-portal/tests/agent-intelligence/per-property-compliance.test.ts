/**
 * Regression guard for Issue 1.2 / Chrome ISSUE-006.
 *
 * The per-property Compliance tab used to render
 * `property.completenessScore` — a stored column updated by an unrelated
 * pipeline — so a property with every dimension Outstanding still showed
 * 80%. The fill-rate formula from PR #95 is the right answer; this
 * guard pins the formula so future refactors can't silently revert.
 */

import { computePerPropertyComplianceScore } from '../../lib/lettings/per-property-compliance';

describe('computePerPropertyComplianceScore (Issue 1.2)', () => {
  it('returns 0 when every applicable dimension is Outstanding (the 1 Rose Hill case)', () => {
    const rows = [
      { state: 'amber' as const }, // BER
      { state: 'amber' as const }, // Gas
      { state: 'amber' as const }, // Electrical
      { state: 'na' as const },    // RTB — vacant, N/A
      { state: 'amber' as const }, // Lease
    ];
    expect(computePerPropertyComplianceScore(rows)).toBe(0);
  });

  it('returns 100 when every applicable dimension is OK', () => {
    const rows = [
      { state: 'ok' as const },
      { state: 'ok' as const },
      { state: 'ok' as const },
      { state: 'ok' as const },
      { state: 'ok' as const },
    ];
    expect(computePerPropertyComplianceScore(rows)).toBe(100);
  });

  it('excludes N/A dimensions from the denominator', () => {
    // 2 OK out of 4 applicable (RTB is N/A on a vacant property) = 50%.
    const rows = [
      { state: 'ok' as const },    // BER
      { state: 'ok' as const },    // Gas
      { state: 'amber' as const }, // Electrical
      { state: 'na' as const },    // RTB — vacant, N/A
      { state: 'amber' as const }, // Lease
    ];
    expect(computePerPropertyComplianceScore(rows)).toBe(50);
  });

  it('rounds to nearest integer percent', () => {
    // 1 of 3 applicable = 33.33% → 33%
    expect(
      computePerPropertyComplianceScore([
        { state: 'ok' as const },
        { state: 'amber' as const },
        { state: 'amber' as const },
      ]),
    ).toBe(33);
  });

  it('returns null when no dimensions are applicable', () => {
    expect(computePerPropertyComplianceScore([])).toBeNull();
    expect(
      computePerPropertyComplianceScore([{ state: 'na' as const }, { state: 'na' as const }]),
    ).toBeNull();
  });

  it('matches the PR #95 portfolio formula on a four-of-five OK record', () => {
    // Same arithmetic as the lettings portfolio fill-rate. 4 OK / 5
    // applicable = 80% — the rounding boundary stays consistent.
    const rows = [
      { state: 'ok' as const },
      { state: 'ok' as const },
      { state: 'ok' as const },
      { state: 'ok' as const },
      { state: 'amber' as const },
    ];
    expect(computePerPropertyComplianceScore(rows)).toBe(80);
  });
});
