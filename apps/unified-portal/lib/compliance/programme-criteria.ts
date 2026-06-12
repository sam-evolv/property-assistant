/**
 * Compliance programme criteria — HPI, BCAR/BCMS and Homebond as named
 * evidence checklists, each criterion auto-filled from the live record:
 * compliance documents (matched by type name/category), commissioned
 * unit systems, handover events and the document archive.
 *
 * These report EVIDENCE COVERAGE in support of each programme — never
 * the certification itself. A criterion with no matching source in the
 * scheme says "not tracked" rather than pretending.
 */

export type ProgrammeKey = 'hpi' | 'bcar' | 'homebond';

export const PROGRAMME_KEYS: ProgrammeKey[] = ['hpi', 'bcar', 'homebond'];

export interface ProgrammeCriterion {
  key: string;
  label: string;
  scope: 'home' | 'scheme';
  covered: number;
  total: number;
  source: string;
  missing: string[];
  tracked: boolean;
}

export interface EvidenceContext {
  totalHomes: number;
  homeIds: string[];
  unitLabel: Map<string, string>;
  complianceTypes: Array<{ id: string; name: string; category: string | null }>;
  complianceDocs: Array<{ unit_id: string; document_type_id: string; status: string }>;
  systems: Array<{ unit_id: string; system_type: string; commissioning_date: string | null; commissioning_doc_id: string | null }>;
  events: Array<{ unit_id: string; event_type: string }>;
  archiveDisciplines: Set<string>;
  archiveTitles: string[];
}

const GOOD_STATUSES = ['uploaded', 'verified'];

function homesWithComplianceDoc(ctx: EvidenceContext, pattern: RegExp): Set<string> | null {
  const ids = new Set(ctx.complianceTypes.filter((t) => pattern.test(t.name)).map((t) => t.id));
  if (ids.size === 0) return null;
  const covered = new Set<string>();
  for (const d of ctx.complianceDocs) {
    if (ids.has(d.document_type_id) && GOOD_STATUSES.includes(d.status)) covered.add(d.unit_id);
  }
  return covered;
}

function homesWithComplianceCategory(ctx: EvidenceContext, category: string): Set<string> | null {
  const ids = new Set(
    ctx.complianceTypes.filter((t) => (t.category || '').toLowerCase() === category.toLowerCase()).map((t) => t.id),
  );
  if (ids.size === 0) return null;
  const covered = new Set<string>();
  for (const d of ctx.complianceDocs) {
    if (ids.has(d.document_type_id) && GOOD_STATUSES.includes(d.status)) covered.add(d.unit_id);
  }
  return covered;
}

function homesWithCommissionedSystem(ctx: EvidenceContext, types: string[]): Set<string> {
  const covered = new Set<string>();
  for (const s of ctx.systems) {
    if (types.includes(s.system_type) && (s.commissioning_date || s.commissioning_doc_id)) covered.add(s.unit_id);
  }
  return covered;
}

function homesWithEvent(ctx: EvidenceContext, eventType: string): Set<string> {
  const covered = new Set<string>();
  for (const e of ctx.events) if (e.event_type === eventType) covered.add(e.unit_id);
  return covered;
}

function archiveHasTitle(ctx: EvidenceContext, pattern: RegExp): boolean {
  return ctx.archiveTitles.some((t) => pattern.test(t));
}

function missingOf(ctx: EvidenceContext, covered: Set<string>): string[] {
  return ctx.homeIds
    .filter((id) => !covered.has(id))
    .map((id) => ctx.unitLabel.get(id) || 'Unit')
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .slice(0, 10);
}

function perHome(
  ctx: EvidenceContext,
  key: string,
  label: string,
  covered: Set<string> | null,
  source: string,
  fallback?: { covered: Set<string>; source: string },
): ProgrammeCriterion {
  let set = covered;
  let src = source;
  if ((set === null || set.size === 0) && fallback && fallback.covered.size > 0) {
    set = fallback.covered;
    src = fallback.source;
  }
  if (set === null) {
    return { key, label, scope: 'home', covered: 0, total: ctx.totalHomes, source, missing: [], tracked: false };
  }
  return {
    key,
    label,
    scope: 'home',
    covered: Math.min(set.size, ctx.totalHomes),
    total: ctx.totalHomes,
    source: src,
    missing: missingOf(ctx, set),
    tracked: true,
  };
}

/** Scheme-level item proven by the archive (by title pattern or discipline). */
function schemeFromArchive(
  ctx: EvidenceContext,
  key: string,
  label: string,
  ok: boolean,
  missingHint: string,
): ProgrammeCriterion {
  return {
    key,
    label,
    scope: 'scheme',
    covered: ok ? 1 : 0,
    total: 1,
    source: 'Document archive',
    missing: ok ? [] : [missingHint],
    tracked: true,
  };
}

/** Scheme-level item from compliance types OR the archive — tracked if either has signal. */
function schemeItem(
  ctx: EvidenceContext,
  key: string,
  label: string,
  typePattern: RegExp,
  titlePattern: RegExp,
  missingHint: string,
): ProgrammeCriterion {
  const viaCompliance = homesWithComplianceDoc(ctx, typePattern);
  if (viaCompliance !== null) {
    const ok = viaCompliance.size > 0;
    return {
      key,
      label,
      scope: 'scheme',
      covered: ok ? 1 : 0,
      total: 1,
      source: 'Compliance record',
      missing: ok ? [] : [missingHint],
      tracked: true,
    };
  }
  if (archiveHasTitle(ctx, titlePattern)) {
    return schemeFromArchive(ctx, key, label, true, missingHint);
  }
  // Neither source knows this document at all.
  return { key, label, scope: 'scheme', covered: 0, total: 1, source: 'Compliance record', missing: [], tracked: false };
}

export function buildProgrammeCriteria(programme: ProgrammeKey, ctx: EvidenceContext): ProgrammeCriterion[] {
  if (programme === 'hpi') {
    return [
      perHome(ctx, 'ber', 'BER certificate', homesWithComplianceDoc(ctx, /\bber\b|building energy/i), 'Compliance record'),
      perHome(ctx, 'airtightness', 'Airtightness test result', homesWithComplianceDoc(ctx, /airtight|air ?perm|blower/i), 'Compliance record'),
      perHome(
        ctx, 'ventilation', 'Ventilation commissioning',
        homesWithComplianceDoc(ctx, /ventilation.*(commission|valid)|commission.*ventilation/i),
        'Compliance record',
        { covered: homesWithCommissionedSystem(ctx, ['ventilation', 'mvhr']), source: 'Commissioned systems' },
      ),
      perHome(
        ctx, 'heating', 'Heating system commissioning',
        homesWithComplianceDoc(ctx, /heat ?pump.*commission|commission.*heat|boiler.*commission/i),
        'Compliance record',
        { covered: homesWithCommissionedSystem(ctx, ['heat_pump', 'heating_controls', 'hot_water']), source: 'Commissioned systems' },
      ),
      perHome(ctx, 'guide', 'Home User Guide issued', homesWithEvent(ctx, 'guide_issued'), 'Handover record'),
      perHome(ctx, 'demo', 'Resident handover demonstration', homesWithEvent(ctx, 'demo_completed'), 'Handover record'),
      schemeFromArchive(
        ctx, 'drawings', 'Design drawings & specifications filed',
        ctx.archiveDisciplines.has('architectural'),
        'No architectural documents in the archive',
      ),
      schemeFromArchive(
        ctx, 'services', 'Building services documentation filed',
        ctx.archiveDisciplines.has('mechanical') || ctx.archiveDisciplines.has('electrical') || ctx.archiveDisciplines.has('plumbing'),
        'No mechanical/electrical/plumbing documents in the archive',
      ),
    ];
  }

  if (programme === 'bcar') {
    return [
      schemeItem(ctx, 'commencement', 'Commencement notice', /commencement/i, /commencement/i, 'No commencement notice on record'),
      schemeItem(ctx, 'fire_cert', 'Fire safety certificate', /fire safety|fire cert/i, /fire (safety )?cert/i, 'No fire safety certificate on record'),
      schemeItem(ctx, 'dac', 'Disability access certificate (DAC)', /disability access|\bdac\b/i, /disability access|\bdac\b/i, 'No DAC on record'),
      schemeItem(ctx, 'assigned_certifier', 'Assigned certifier / ancillary certificates', /assigned certifier|ancillary/i, /assigned certifier|ancillary cert/i, 'No certifier documents on record'),
      perHome(
        ctx, 'ccc', 'Certificate of compliance on completion',
        homesWithComplianceDoc(ctx, /compliance on completion|completion cert|\bccc\b/i),
        'Compliance record',
      ),
      perHome(
        ctx, 'inspections', 'Inspection records',
        homesWithComplianceDoc(ctx, /inspection/i),
        'Compliance record',
        { covered: homesWithEvent(ctx, 'inspection'), source: 'Handover record' },
      ),
      schemeFromArchive(
        ctx, 'as_constructed', 'As-constructed drawings filed',
        ctx.archiveDisciplines.has('architectural') || ctx.archiveDisciplines.has('structural'),
        'No architectural/structural drawings in the archive',
      ),
    ];
  }

  // homebond
  return [
    perHome(
      ctx, 'registration', 'Homebond registration',
      homesWithComplianceDoc(ctx, /homebond.*(reg|cert)|structural warranty|warranty reg/i),
      'Compliance record',
    ),
    perHome(
      ctx, 'stage_notifications', 'Stage notifications & inspections',
      homesWithComplianceDoc(ctx, /stage (notification|inspection)|foundation|substructure/i),
      'Compliance record',
    ),
    perHome(
      ctx, 'final_certificate', 'Final notice / certificate',
      homesWithComplianceDoc(ctx, /homebond.*final|final (notice|cert)/i),
      'Compliance record',
    ),
    perHome(
      ctx, 'warranty_docs', 'Warranty documents issued',
      homesWithComplianceCategory(ctx, 'Warranty'),
      'Compliance record (Warranty category)',
    ),
    perHome(ctx, 'keys', 'Keys handed over', homesWithEvent(ctx, 'keys_handed'), 'Handover record'),
  ];
}
