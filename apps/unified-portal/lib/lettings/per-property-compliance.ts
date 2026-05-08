/**
 * Per-property compliance score arithmetic (Issue 1.2 / Chrome ISSUE-006).
 *
 * The Compliance tab on the per-property page used to render
 * `property.completenessScore` — a stored column updated by an
 * unrelated pipeline — so a property with every dimension Outstanding
 * still showed 80%. The portfolio-level fix from PR #95 used a fill-
 * rate formula correctly; the per-property page was using a different
 * (broken) source. This helper consolidates the formula in one place
 * so the per-property page and the regression test agree.
 *
 * Rule: numerator = #OK dimensions, denominator = #applicable
 * dimensions (excludes 'na', e.g. RTB on a vacant property).
 */

export function computePerPropertyComplianceScore(rows: Array<{ state: 'ok' | 'amber' | 'na' }>): number | null {
  const applicable = rows.filter((r) => r.state !== 'na');
  if (applicable.length === 0) return null;
  const ok = applicable.filter((r) => r.state === 'ok').length;
  return Math.round((ok / applicable.length) * 100);
}
