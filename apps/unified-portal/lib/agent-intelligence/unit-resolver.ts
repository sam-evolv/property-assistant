import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Session 9 — strict unit identifier resolution.
 *
 * The pre-9 draft skills resolved a target like "Unit 3" via
 * `.or('unit_number.ilike.%3%,unit_uid.ilike.%3%,purchaser_name.ilike.%…')`.
 * That fuzz matched Unit 30, Unit 31, Unit 13, any buyer whose name
 * contained the ref, and on a literal "Unit 3" (where unit_number is
 * stored as "3" not "Unit 3") the OR reduced to false and PostgREST
 * returned the arbitrary first row — in production that was Unit 10 for
 * Árdan View.
 *
 * This resolver:
 *   - Normalises the user-supplied identifier (strips the word "Unit",
 *     "unit", "#", whitespace). "Unit 3" → "3".
 *   - Matches EXACTLY against unit_number, then unit_uid, then a suffix
 *     match on unit_uid ("AV-3" matches ref "3").
 *   - Scopes every query to the agent's assigned developments.
 *   - Surfaces three outcomes: ok (one unit), not_found (zero), and
 *     ambiguous (multiple units across different developments with no
 *     scheme scope from the caller).
 */

export interface ResolvedUnitRow {
  id: string;
  development_id: string;
  unit_number: string | null;
  unit_uid: string | null;
  purchaser_name: string | null;
  purchaser_email: string | null;
  unit_status: string | null;
}

export interface UnitPipelineRow {
  unit_id: string;
  development_id: string | null;
  handover_date: string | null;
  sale_agreed_date: string | null;
  contracts_issued_date: string | null;
  signed_contracts_date: string | null;
  counter_signed_date: string | null;
  deposit_date: string | null;
  purchaser_name: string | null;
  purchaser_email: string | null;
}

export type UnitResolution =
  | { status: 'ok'; unit: ResolvedUnitRow; pipeline: UnitPipelineRow | null }
  | { status: 'not_found'; ref: string; normalised: string }
  | { status: 'ambiguous'; ref: string; normalised: string; candidates: Array<{ id: string; unit_number: string | null; scheme_name: string | null }> };

export interface ResolveOptions {
  /** Agent's assigned development ids — the outer scope for all queries. */
  developmentIds: string[];
  /** When set, narrows to this single development. */
  preferredDevelopmentId?: string | null;
}

/** Strips "Unit "/"unit "/"#"/whitespace. "Unit 3" → "3", "Unit  12" → "12",
 *  "AV-3" → "AV-3" (alphanumeric codes preserved). */
export function normaliseUnitRef(raw: string): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/^unit\s*#?\s*/i, '')
    .replace(/^#\s*/, '')
    .replace(/\s+/g, '')
    .trim();
}

export async function resolveUnitIdentifier(
  supabase: SupabaseClient,
  ref: string,
  opts: ResolveOptions,
): Promise<UnitResolution> {
  const normalised = normaliseUnitRef(ref);
  if (!normalised) return { status: 'not_found', ref, normalised };

  const scope = opts.preferredDevelopmentId
    ? [opts.preferredDevelopmentId]
    : opts.developmentIds;
  if (!scope.length) return { status: 'not_found', ref, normalised };

  const selectCols = 'id, development_id, unit_number, unit_uid, purchaser_name, purchaser_email, unit_status';

  // 1) Exact unit_number match — this is the common case ("3" or "Unit 3").
  //    Stored as text but exact equality only — no substring / LIKE fuzz.
  const { data: byNumber } = await supabase
    .from('units')
    .select(selectCols)
    .in('development_id', scope)
    .eq('unit_number', normalised);

  let candidates = (byNumber || []) as ResolvedUnitRow[];

  // 2) Exact unit_uid match.
  if (candidates.length === 0) {
    const { data: byUid } = await supabase
      .from('units')
      .select(selectCols)
      .in('development_id', scope)
      .eq('unit_uid', normalised);
    candidates = (byUid || []) as ResolvedUnitRow[];
  }

  // 3) unit_uid ending with "-<normalised>". "AV-3" / "RP-3" patterns.
  if (candidates.length === 0) {
    // Use ilike with an explicit suffix so "3" matches "AV-3" but NOT
    // "AV-30". The anchor is the character before the digit.
    const { data: bySuffix } = await supabase
      .from('units')
      .select(selectCols)
      .in('development_id', scope)
      .ilike('unit_uid', `%-${normalised}`);
    candidates = (bySuffix || []) as ResolvedUnitRow[];
  }

  if (candidates.length === 0) {
    return { status: 'not_found', ref, normalised };
  }

  if (candidates.length > 1) {
    // Multiple units matched — either the same unit_number exists in
    // several of the agent's developments (e.g. every scheme has a
    // "Unit 3"), or a loose ref hit multiple uids. Surface for the
    // caller to disambiguate. No silent pick.
    const { data: devs } = await supabase
      .from('developments')
      .select('id, name')
      .in('id', candidates.map((c) => c.development_id).filter(Boolean));
    const nameById = new Map<string, string>(
      (devs || []).map((d: any) => [d.id, d.name]),
    );
    return {
      status: 'ambiguous',
      ref,
      normalised,
      candidates: candidates.map((c) => ({
        id: c.id,
        unit_number: c.unit_number,
        scheme_name: nameById.get(c.development_id) ?? null,
      })),
    };
  }

  const unit = candidates[0];
  const { data: pipelineRow } = await supabase
    .from('unit_sales_pipeline')
    .select(
      'unit_id, development_id, handover_date, sale_agreed_date, contracts_issued_date, signed_contracts_date, counter_signed_date, deposit_date, purchaser_name, purchaser_email',
    )
    .eq('unit_id', unit.id)
    .maybeSingle();

  return {
    status: 'ok',
    unit,
    pipeline: (pipelineRow || null) as UnitPipelineRow | null,
  };
}

/**
 * Session 9 — intent-aware candidate selection for clarification.
 *
 * When the user gives a count but no specific units (e.g. "draft email
 * to 3 Ardan View and congratulate them on their keys"), the model
 * must see a candidate set filtered by the INTENT, not the first N
 * unit numbers. Intent is mapped from the user's verb:
 *   "congratulate" / "welcome" / "keys" / "moved in" → 'handover'
 *   "chase" / "overdue" / "follow up"                → 'overdue_contracts'
 *   "sale agreed" / "reserved"                        → 'sale_agreed'
 *   anything else                                     → 'all'
 */
export type CandidateIntent = 'handover' | 'sale_agreed' | 'overdue_contracts' | 'all';

export interface UnitCandidate {
  id: string;
  development_id: string;
  scheme_name: string;
  unit_number: string;
  purchaser_name: string | null;
  status_hint: string;
}

export async function getCandidateUnits(
  supabase: SupabaseClient,
  intent: CandidateIntent,
  opts: { developmentIds: string[]; preferredDevelopmentId?: string | null; limit?: number },
): Promise<UnitCandidate[]> {
  const scope = opts.preferredDevelopmentId
    ? [opts.preferredDevelopmentId]
    : opts.developmentIds;
  if (!scope.length) return [];
  const limit = Math.max(1, Math.min(20, opts.limit ?? 10));

  // Every intent needs the scheme names for display.
  const { data: devs } = await supabase
    .from('developments')
    .select('id, name')
    .in('id', scope);
  const schemeNameById = new Map<string, string>(
    (devs || []).map((d: any) => [d.id, d.name]),
  );

  if (intent === 'handover') {
    // Primary filter: pipeline rows with handover_date set, most recent
    // first. Units table carries `unit_status` too but pipeline's
    // handover_date is the canonical indicator.
    const { data: rows } = await supabase
      .from('unit_sales_pipeline')
      .select('unit_id, development_id, handover_date, purchaser_name')
      .in('development_id', scope)
      .not('handover_date', 'is', null)
      .order('handover_date', { ascending: false })
      .limit(limit);
    const pipelineRows = (rows || []) as Array<{
      unit_id: string;
      development_id: string;
      handover_date: string;
      purchaser_name: string | null;
    }>;
    if (!pipelineRows.length) return [];
    const unitIds = pipelineRows.map((r) => r.unit_id).filter(Boolean);
    const { data: units } = unitIds.length
      ? await supabase
          .from('units')
          .select('id, unit_number, purchaser_name')
          .in('id', unitIds)
      : { data: [] };
    const unitById = new Map<string, { unit_number: string | null; purchaser_name: string | null }>(
      (units || []).map((u: any) => [u.id, { unit_number: u.unit_number, purchaser_name: u.purchaser_name }]),
    );
    return pipelineRows.map((r) => ({
      id: r.unit_id,
      development_id: r.development_id,
      scheme_name: schemeNameById.get(r.development_id) ?? 'Unknown scheme',
      unit_number: unitById.get(r.unit_id)?.unit_number ?? '?',
      purchaser_name: r.purchaser_name ?? unitById.get(r.unit_id)?.purchaser_name ?? null,
      status_hint: `handed over ${r.handover_date.slice(0, 10)}`,
    }));
  }

  if (intent === 'overdue_contracts') {
    const cutoff = new Date(Date.now() - 28 * 86400000).toISOString();
    const { data: rows } = await supabase
      .from('unit_sales_pipeline')
      .select('unit_id, development_id, contracts_issued_date, purchaser_name')
      .in('development_id', scope)
      .not('contracts_issued_date', 'is', null)
      .is('signed_contracts_date', null)
      .lt('contracts_issued_date', cutoff)
      .order('contracts_issued_date', { ascending: true })
      .limit(limit);
    const pipelineRows = (rows || []) as Array<{
      unit_id: string;
      development_id: string;
      contracts_issued_date: string;
      purchaser_name: string | null;
    }>;
    if (!pipelineRows.length) return [];
    const unitIds = pipelineRows.map((r) => r.unit_id).filter(Boolean);
    const { data: units } = unitIds.length
      ? await supabase
          .from('units')
          .select('id, unit_number, purchaser_name')
          .in('id', unitIds)
      : { data: [] };
    const unitById = new Map<string, { unit_number: string | null; purchaser_name: string | null }>(
      (units || []).map((u: any) => [u.id, { unit_number: u.unit_number, purchaser_name: u.purchaser_name }]),
    );
    return pipelineRows.map((r) => ({
      id: r.unit_id,
      development_id: r.development_id,
      scheme_name: schemeNameById.get(r.development_id) ?? 'Unknown scheme',
      unit_number: unitById.get(r.unit_id)?.unit_number ?? '?',
      purchaser_name: r.purchaser_name ?? unitById.get(r.unit_id)?.purchaser_name ?? null,
      status_hint: `contracts issued ${r.contracts_issued_date.slice(0, 10)}, unsigned`,
    }));
  }

  if (intent === 'sale_agreed') {
    const { data: rows } = await supabase
      .from('unit_sales_pipeline')
      .select('unit_id, development_id, sale_agreed_date, purchaser_name')
      .in('development_id', scope)
      .not('sale_agreed_date', 'is', null)
      .is('signed_contracts_date', null)
      .is('handover_date', null)
      .order('sale_agreed_date', { ascending: false })
      .limit(limit);
    const pipelineRows = (rows || []) as Array<{
      unit_id: string;
      development_id: string;
      sale_agreed_date: string;
      purchaser_name: string | null;
    }>;
    if (!pipelineRows.length) return [];
    const unitIds = pipelineRows.map((r) => r.unit_id).filter(Boolean);
    const { data: units } = unitIds.length
      ? await supabase
          .from('units')
          .select('id, unit_number, purchaser_name')
          .in('id', unitIds)
      : { data: [] };
    const unitById = new Map<string, { unit_number: string | null; purchaser_name: string | null }>(
      (units || []).map((u: any) => [u.id, { unit_number: u.unit_number, purchaser_name: u.purchaser_name }]),
    );
    return pipelineRows.map((r) => ({
      id: r.unit_id,
      development_id: r.development_id,
      scheme_name: schemeNameById.get(r.development_id) ?? 'Unknown scheme',
      unit_number: unitById.get(r.unit_id)?.unit_number ?? '?',
      purchaser_name: r.purchaser_name ?? unitById.get(r.unit_id)?.purchaser_name ?? null,
      status_hint: `sale agreed ${r.sale_agreed_date.slice(0, 10)}`,
    }));
  }

  // 'all' — every unit in scope.
  const { data: rows } = await supabase
    .from('units')
    .select('id, development_id, unit_number, purchaser_name, unit_status')
    .in('development_id', scope)
    .order('unit_number', { ascending: true })
    .limit(limit);
  return ((rows || []) as Array<{
    id: string;
    development_id: string;
    unit_number: string | null;
    purchaser_name: string | null;
    unit_status: string | null;
  }>).map((r) => ({
    id: r.id,
    development_id: r.development_id,
    scheme_name: schemeNameById.get(r.development_id) ?? 'Unknown scheme',
    unit_number: r.unit_number ?? '?',
    purchaser_name: r.purchaser_name,
    status_hint: r.unit_status ?? 'unknown',
  }));
}
