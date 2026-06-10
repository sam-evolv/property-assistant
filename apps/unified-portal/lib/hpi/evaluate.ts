// lib/hpi/evaluate.ts
//
// Pure HPI evidence evaluator. Given assembled per-unit evidence for a scheme,
// runs the indicator registry and produces: per-unit per-indicator status, a
// weighted scheme readiness %, a per-category breakdown, a transparent (and
// always "indicative") projected certification tier, and a flat gap list keyed
// by responsible party. No DB, no React.

import {
  HPI_INDICATORS,
  MANDATORY_MINIMUM_IDS,
  CATEGORY_LABELS,
  type HpiCategory,
  type HpiIndicator,
  type IndicatorEvidence,
  type IndicatorScope,
  type IndicatorStatus,
  type TierBand,
} from './indicators';

// Tier thresholds (one place, deliberately simple, always surfaced as indicative).
const TIER_THRESHOLDS: Array<{ tier: TierBand; min: number }> = [
  { tier: 'gold', min: 88 },
  { tier: 'silver', min: 75 },
  { tier: 'certified', min: 60 },
];
// Mandatory minimums must be ready on at least this share of units to project a
// tier. IGBC v3.1 allows only a small share of units to miss mandatory minimums;
// 0.8 tolerates a single laggard on a small scheme without passing a scheme with
// systemic gaps.
const MANDATORY_GATE = 0.8;
// Mandatory indicators weigh double in the readiness mean.
const MANDATORY_WEIGHT = 2;
// Minutes of assessor review saved per pre-assembled evidence item (labelled in UI).
const MINUTES_SAVED_PER_ITEM = 3.5;

export interface RawUnitEvidence {
  unit: {
    id: string;
    unit_number: string | null;
    address_line_1: string | null;
    purchaser_name: string | null;
    house_type_code: string | null;
  };
  systems: any[];
  events: any[];
  guideIssued: boolean;
  /** keyed by doc-type name lowercased */
  complianceByType: Record<string, { status: string; expiry_date: string | null }>;
}

export interface UnitIndicatorResult {
  indicatorId: string;
  status: IndicatorStatus;
  detail: string;
}

export interface GapItem {
  indicatorId: string;
  code: string;
  category: HpiCategory;
  scope: IndicatorScope;
  unitId?: string;
  unitLabel?: string;
  responsibleParty: string;
  status: IndicatorStatus;
  detail: string;
}

export interface SchemeEvaluation {
  readinessPct: number;
  projectedTier: TierBand | 'none';
  projectedTierLabel: string;
  mandatoryMet: boolean;
  itemsToNextTier: number | null;
  categoryBreakdown: Record<HpiCategory, { pct: number; ready: number; total: number }>;
  indicatorMatrix: Array<{
    indicatorId: string;
    code: string;
    category: HpiCategory;
    label: string;
    scope: IndicatorScope;
    ready: number;
    total: number;
    responsibleParty: string;
  }>;
  gaps: GapItem[];
  perUnit: Record<string, UnitIndicatorResult[]>;
}

export interface RoiMetrics {
  evidenceItemsTracked: number;
  autoCapturedPct: number;
  spreadsheetsReplaced: number;
  assessorHoursSaved: number;
}

const EXPIRY_WINDOW_DAYS = 30;

/**
 * Normalise a compliance_documents.status into an indicator status. Handles BOTH
 * the live vocabulary (pending / pending_renewal) and the canonical code
 * vocabulary (missing / uploaded / verified / expired), plus expiry windows.
 */
export function normaliseComplianceStatus(
  dbStatus: string | null | undefined,
  expiry: string | null | undefined,
  now: Date = new Date(),
): IndicatorStatus {
  const s = (dbStatus ?? '').toLowerCase();
  // A lapsed certificate is no longer valid evidence → treat as missing.
  if (expiry) {
    const e = new Date(expiry);
    if (!isNaN(e.getTime()) && e.getTime() < now.getTime()) return 'missing';
    if (!isNaN(e.getTime())) {
      const days = (e.getTime() - now.getTime()) / 86400000;
      // Valid but expiring soon: present evidence that needs renewal.
      if (days <= EXPIRY_WINDOW_DAYS && (s === 'verified' || s === 'pending_renewal')) return 'expiring';
    }
  }
  switch (s) {
    case 'verified':
      return 'ready';
    case 'uploaded':
    case 'pending':
    case 'pending_renewal':
      return 'partial';
    case 'expired':
      return 'missing'; // lapsed → no valid evidence
    default:
      return 'missing';
  }
}

/** Whether a status counts as valid evidence present (for the mandatory gate). */
function isPresent(s: IndicatorStatus): boolean {
  return s === 'ready' || s === 'expiring';
}

function unitLabel(u: RawUnitEvidence['unit']): string {
  return u.unit_number ? `Unit ${u.unit_number}` : u.address_line_1 || 'Unit';
}

function toIndicatorEvidence(u: RawUnitEvidence): IndicatorEvidence {
  const compliance: IndicatorEvidence['compliance'] = {};
  for (const [name, doc] of Object.entries(u.complianceByType)) {
    compliance[name] = {
      status: normaliseComplianceStatus(doc.status, doc.expiry_date),
      expiry_date: doc.expiry_date,
    };
  }
  const hasEvent = (t: string) => u.events.some((e) => e.event_type === t);
  return {
    guideIssued: u.guideIssued || hasEvent('guide_issued'),
    demoCompleted: hasEvent('demo_completed'),
    aftercareActivated: hasEvent('aftercare_activated'),
    systems: u.systems.map((s) => ({
      system_type: s.system_type,
      commissioning_date: s.commissioning_date ?? null,
      warranty_end: s.warranty_end ?? null,
      warranty_doc_id: s.warranty_doc_id ?? null,
    })),
    compliance,
  };
}

function isReady(s: IndicatorStatus): boolean {
  return s === 'ready';
}

export function evaluateScheme(units: RawUnitEvidence[]): SchemeEvaluation {
  const evidences = units.map((u) => ({ unit: u.unit, ev: toIndicatorEvidence(u) }));

  const perUnit: Record<string, UnitIndicatorResult[]> = {};
  for (const { unit } of evidences) perUnit[unit.id] = [];

  // Per-indicator coverage + gaps + matrix
  const indicatorMatrix: SchemeEvaluation['indicatorMatrix'] = [];
  const gaps: GapItem[] = [];
  const indicatorCoverage: Array<{ indicator: HpiIndicator; coverage: number; presentCoverage: number }> = [];

  for (const indicator of HPI_INDICATORS) {
    let ready = 0;
    let present = 0;
    const total = indicator.scope === 'per_scheme' ? 1 : evidences.length;

    if (indicator.scope === 'per_scheme') {
      // Evaluate once against the first unit's evidence (per-scheme indicators
      // read scheme-level docs that are mirrored to every unit, or constants).
      const sample = evidences[0]?.ev;
      const res = sample
        ? indicator.evaluate(sample)
        : { status: 'missing' as IndicatorStatus, detail: 'No units' };
      if (isReady(res.status)) ready = 1;
      if (isPresent(res.status)) present = 1;
      if (!isReady(res.status)) {
        gaps.push({
          indicatorId: indicator.id,
          code: indicator.code,
          category: indicator.category,
          scope: indicator.scope,
          responsibleParty: indicator.responsibleParty,
          status: res.status,
          detail: res.detail,
        });
      }
    } else {
      for (const { unit, ev } of evidences) {
        const res = indicator.evaluate(ev);
        perUnit[unit.id].push({ indicatorId: indicator.id, status: res.status, detail: res.detail });
        if (isPresent(res.status)) present += 1;
        if (isReady(res.status)) {
          ready += 1;
        } else {
          gaps.push({
            indicatorId: indicator.id,
            code: indicator.code,
            category: indicator.category,
            scope: indicator.scope,
            unitId: unit.id,
            unitLabel: unitLabel(unit),
            responsibleParty: indicator.responsibleParty,
            status: res.status,
            detail: res.detail,
          });
        }
      }
    }

    const coverage = total > 0 ? ready / total : 0;
    const presentCoverage = total > 0 ? present / total : 0;
    indicatorCoverage.push({ indicator, coverage, presentCoverage });
    indicatorMatrix.push({
      indicatorId: indicator.id,
      code: indicator.code,
      category: indicator.category,
      label: indicator.label,
      scope: indicator.scope,
      ready,
      total,
      responsibleParty: indicator.responsibleParty,
    });
  }

  // Weighted readiness (mandatory ×2)
  let weightSum = 0;
  let weighted = 0;
  for (const { indicator, coverage } of indicatorCoverage) {
    const w = indicator.mandatoryMinimum ? MANDATORY_WEIGHT : 1;
    weighted += coverage * w;
    weightSum += w;
  }
  const readinessPct = weightSum > 0 ? Math.round((weighted / weightSum) * 100) : 0;

  // Mandatory gate — valid evidence present (ready or expiring-but-valid) on
  // at least the gate share of units for every mandatory minimum.
  const mandatoryMet = indicatorCoverage
    .filter(({ indicator }) => MANDATORY_MINIMUM_IDS.includes(indicator.id))
    .every(({ presentCoverage }) => presentCoverage >= MANDATORY_GATE);

  // Category breakdown
  const categoryBreakdown = {} as SchemeEvaluation['categoryBreakdown'];
  (Object.keys(CATEGORY_LABELS) as HpiCategory[]).forEach((cat) => {
    const inCat = indicatorMatrix.filter((m) => m.category === cat);
    const ready = inCat.reduce((a, m) => a + m.ready, 0);
    const total = inCat.reduce((a, m) => a + m.total, 0);
    categoryBreakdown[cat] = { pct: total > 0 ? Math.round((ready / total) * 100) : 0, ready, total };
  });

  // Projected tier
  let projectedTier: TierBand | 'none' = 'none';
  if (mandatoryMet) {
    for (const t of TIER_THRESHOLDS) {
      if (readinessPct >= t.min) {
        projectedTier = t.tier;
        break;
      }
    }
  }
  const projectedTierLabel = mandatoryMet
    ? projectedTier === 'none'
      ? 'Approaching Certified (indicative)'
      : `${cap(projectedTier)} (indicative)`
    : 'Below Certified threshold (indicative)';

  // Items to next tier: cheapest count of not-ready indicator-units to cross the
  // next threshold. Null at Gold or when the mandatory gate isn't met yet.
  const itemsToNextTier = computeItemsToNextTier(
    indicatorCoverage,
    readinessPct,
    projectedTier,
    mandatoryMet,
  );

  return {
    readinessPct,
    projectedTier,
    projectedTierLabel,
    mandatoryMet,
    itemsToNextTier,
    categoryBreakdown,
    indicatorMatrix,
    gaps,
    perUnit,
  };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function computeItemsToNextTier(
  indicatorCoverage: Array<{ indicator: HpiIndicator; coverage: number }>,
  readinessPct: number,
  projectedTier: TierBand | 'none',
  mandatoryMet: boolean,
): number | null {
  if (!mandatoryMet) return null;
  if (projectedTier === 'gold') return null;
  const nextMin =
    projectedTier === 'silver'
      ? 88
      : projectedTier === 'certified'
        ? 75
        : 60; // 'none' but gate met → next is Certified
  if (readinessPct >= nextMin) return null;

  // Greedily flip the highest-weight, lowest-coverage indicators to full and
  // count how many indicator-units that takes to reach nextMin.
  const weightSum = indicatorCoverage.reduce(
    (a, { indicator }) => a + (indicator.mandatoryMinimum ? MANDATORY_WEIGHT : 1),
    0,
  );
  // Sort by remaining gain potential (weight × shortfall) descending.
  const sorted = [...indicatorCoverage].sort((a, b) => {
    const ga = (a.indicator.mandatoryMinimum ? MANDATORY_WEIGHT : 1) * (1 - a.coverage);
    const gb = (b.indicator.mandatoryMinimum ? MANDATORY_WEIGHT : 1) * (1 - b.coverage);
    return gb - ga;
  });

  let weighted = indicatorCoverage.reduce(
    (a, { indicator, coverage }) => a + coverage * (indicator.mandatoryMinimum ? MANDATORY_WEIGHT : 1),
    0,
  );
  let items = 0;
  for (const { indicator, coverage } of sorted) {
    if ((weighted / weightSum) * 100 >= nextMin) break;
    const w = indicator.mandatoryMinimum ? MANDATORY_WEIGHT : 1;
    weighted += (1 - coverage) * w;
    // Count the not-ready units this represents (per_scheme = 1).
    items += 1;
  }
  return Math.max(items, 1);
}

/** Portfolio-row summary (cheap; reuses evaluateScheme). */
export function summariseSchemeForPortfolio(units: RawUnitEvidence[]): {
  readinessPct: number;
  projectedTier: string;
  mandatoryMet: boolean;
  gapCount: number;
} {
  const ev = evaluateScheme(units);
  return {
    readinessPct: ev.readinessPct,
    projectedTier: ev.projectedTierLabel,
    mandatoryMet: ev.mandatoryMet,
    gapCount: ev.gaps.length,
  };
}

/**
 * ROI metrics across a set of schemes. `nativeItems` are evidence items
 * OpenHouse captures itself (handover events, issued guides, commissioned
 * systems); `manualItems` are uploaded compliance docs that are being tracked
 * (status not missing). Both count toward "tracked".
 */
export function computeRoi(schemes: RawUnitEvidence[][]): RoiMetrics {
  let nativeItems = 0;
  let manualItems = 0;
  let schemesWithEvidence = 0;

  for (const units of schemes) {
    let schemeTracked = 0;
    for (const u of units) {
      const ev = toIndicatorEvidence(u);
      if (ev.guideIssued) nativeItems++, schemeTracked++;
      if (ev.demoCompleted) nativeItems++, schemeTracked++;
      if (ev.aftercareActivated) nativeItems++, schemeTracked++;
      for (const s of ev.systems) {
        if (s.commissioning_date) nativeItems++, schemeTracked++;
      }
      for (const doc of Object.values(ev.compliance)) {
        if (doc && doc.status !== 'missing') manualItems++, schemeTracked++;
      }
    }
    if (schemeTracked > 0) schemesWithEvidence++;
  }

  const tracked = nativeItems + manualItems;
  return {
    evidenceItemsTracked: tracked,
    autoCapturedPct: tracked > 0 ? Math.round((nativeItems / tracked) * 100) : 0,
    spreadsheetsReplaced: schemesWithEvidence,
    assessorHoursSaved: Math.round((tracked * MINUTES_SAVED_PER_ITEM) / 60),
  };
}
