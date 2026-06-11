export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getSupabaseAdmin } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { developments } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import {
  parseWorkbook,
  mapHeaders,
  normaliseRows,
  identifierKey,
  type HeaderMapping,
  type ParsedHome,
  type CanonicalField,
} from '@/lib/home-import/parse';
import { suggestHeaderMappings } from '@/lib/home-import/llm-headers';

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_ROWS = 2000;

const FLAG_LABELS: Partial<Record<CanonicalField, string>> = {
  sadrl_date: 'SADRL',
  proof_of_funds_date: 'Proof of Funds',
  deposit_date: 'Deposit',
  deposit_receipt_date: 'Receipt',
  loan_approved_date: 'Loan Approved',
  signed_contracts_date: 'Signed Contracts',
  one_part_returned_date: 'One Part Returned',
};

function generateUnitCode(developmentCode: string, index: number): string {
  return `${developmentCode}-${String(index).padStart(3, '0')}`;
}

function generateRandomSuffix(length: number = 4): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getDevelopmentPrefix(developmentCode: string): string {
  if (developmentCode.length <= 2) return developmentCode.toUpperCase();
  const words = developmentCode.split(/[-_\s]+/);
  if (words.length >= 2) {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
  return developmentCode.substring(0, 2).toUpperCase();
}

function generateSecureUnitUid(prefix: string, unitNumber: string): string {
  const numMatch = unitNumber.match(/\d+/);
  const paddedNum = numMatch ? String(parseInt(numMatch[0], 10)).padStart(3, '0') : '001';
  return `${prefix}-${paddedNum}-${generateRandomSuffix(4)}`;
}

function extractUnitNumber(identifier: string): string {
  const match = identifier.match(/^(\d+)/);
  if (match) return match[1];
  const words = identifier.split(/\s+/);
  return words[0] || identifier.substring(0, 10);
}

const MISSING_COLUMN_RE = /Could not find the '([^']+)' column/i;

/**
 * The live units table carries a legacy NOT NULL FK: project_id -> projects.
 * Resolve the development's project container (by id, by link, by name —
 * matching how the archive resolves it) or create it, reusing/creating a
 * minimal organisations row named after the tenant.
 */
async function ensureProjectIdForDevelopment(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  development: { id: string; name: string; tenant_id: string | null },
): Promise<{ projectId: string | null; error: string | null }> {
  const byId = await supabase.from('projects').select('id').eq('id', development.id).maybeSingle();
  if (byId.data?.id) return { projectId: byId.data.id, error: null };

  const byLink = await supabase
    .from('projects')
    .select('id')
    .eq('development_id', development.id)
    .maybeSingle();
  if (byLink.data?.id) return { projectId: byLink.data.id, error: null };

  const byName = await supabase
    .from('projects')
    .select('id')
    .eq('name', development.name)
    .maybeSingle();
  if (byName.data?.id) return { projectId: byName.data.id, error: null };

  let orgName = 'OpenHouse';
  if (development.tenant_id) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', development.tenant_id)
      .maybeSingle();
    if (tenant?.name) orgName = tenant.name;
  }
  let orgId: string | null = null;
  const { data: existingOrg } = await supabase
    .from('organisations')
    .select('id')
    .eq('name', orgName)
    .maybeSingle();
  orgId = existingOrg?.id ?? null;
  if (!orgId) {
    const { data: newOrg, error: orgErr } = await supabase
      .from('organisations')
      .insert({ name: orgName })
      .select('id')
      .single();
    if (orgErr || !newOrg) return { projectId: null, error: `organisation: ${orgErr?.message}` };
    orgId = newOrg.id;
  }

  const { data: project, error: projErr } = await supabase
    .from('projects')
    .insert({
      id: development.id,
      organization_id: orgId,
      name: development.name,
      development_id: development.id,
    })
    .select('id')
    .single();
  if (project?.id) return { projectId: project.id, error: null };

  // Lost a race with a concurrent import — the row exists now.
  const retry = await supabase.from('projects').select('id').eq('id', development.id).maybeSingle();
  if (retry.data?.id) return { projectId: retry.data.id, error: null };
  return { projectId: null, error: `project: ${projErr?.message}` };
}

/** "Row 12 (x): same message" * 112 -> two examples + one summary line. */
function compressWarnings(warnings: string[]): string[] {
  const groups = new Map<string, string[]>();
  for (const w of warnings) {
    const key = w.replace(/^Row \d+[^:]*: /, '');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(w);
  }
  const out: string[] = [];
  for (const [key, items] of groups) {
    if (items.length <= 3) {
      out.push(...items);
    } else {
      out.push(...items.slice(0, 2));
      out.push(`…and ${items.length - 2} more rows: ${key}`);
    }
  }
  return out;
}

/**
 * Inserts a row, dropping any column PostgREST reports as unknown and
 * retrying — so the importer works whether or not migration 070 has been
 * run yet. Dropped columns are remembered for the rest of the batch.
 */
async function insertWithColumnFallback(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  row: Record<string, unknown>,
  droppedColumns: Set<string>,
  warnings: string[],
): Promise<{ id: string | null; error: string | null }> {
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== null && v !== undefined && !droppedColumns.has(k)) payload[k] = v;
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await supabase.from(table).insert(payload).select('id').single();
    if (!error) return { id: (data as { id: string } | null)?.id ?? null, error: null };

    const missing = error.message?.match(MISSING_COLUMN_RE)?.[1];
    if (missing && missing in payload) {
      delete payload[missing];
      if (!droppedColumns.has(missing)) {
        droppedColumns.add(missing);
        warnings.push(
          `Column "${missing}" doesn't exist on ${table} yet (run migration 070) — that value was skipped.`,
        );
      }
      continue;
    }
    return { id: null, error: error.message };
  }
  return { id: null, error: 'Too many missing columns' };
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireRole(['developer', 'admin', 'super_admin']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const developmentId = String(formData.get('developmentId') || '');
  const mode = String(formData.get('mode') || 'dryRun');

  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  if (!developmentId) return NextResponse.json({ error: 'developmentId is required' }, { status: 400 });
  if (mode !== 'dryRun' && mode !== 'commit') {
    return NextResponse.json({ error: 'mode must be dryRun or commit' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File too large (50MB max)' }, { status: 400 });
  }
  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
    return NextResponse.json({ error: 'Please upload an Excel (.xlsx/.xls) or CSV file' }, { status: 400 });
  }

  // The development must belong to the caller's tenant (super_admin exempt).
  const development = await db.query.developments.findFirst({
    where: eq(developments.id, developmentId),
    columns: { id: true, code: true, name: true, tenant_id: true },
  });
  if (!development) {
    return NextResponse.json({ error: 'Development not found' }, { status: 404 });
  }
  if (session.role !== 'super_admin') {
    if (!session.tenantId || development.tenant_id !== session.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }
  const tenantId = development.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: 'Development has no tenant' }, { status: 400 });
  }

  // Parse + map headers
  const buffer = Buffer.from(await file.arrayBuffer());
  let sheet;
  try {
    sheet = parseWorkbook(buffer, fileName);
  } catch {
    return NextResponse.json({ error: 'Could not read that file — is it a valid spreadsheet?' }, { status: 400 });
  }
  if (sheet.rows.length === 0) {
    return NextResponse.json({ error: 'No data rows found in the spreadsheet' }, { status: 400 });
  }
  if (sheet.rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `That's ${sheet.rows.length} rows — the importer takes up to ${MAX_ROWS} at a time. Split the file and drop each part.` },
      { status: 400 },
    );
  }

  const { mapped, unmapped } = mapHeaders(sheet.headers);
  let mapping: HeaderMapping[] = [...mapped];
  let unmappedHeaders = [...unmapped];

  // One fail-soft LLM call for whatever the heuristics missed.
  if (unmappedHeaders.length > 0) {
    const samples: Record<string, string[]> = {};
    for (const h of unmappedHeaders) {
      samples[h] = sheet.rows
        .map((r) => String(r[h] ?? '').trim())
        .filter(Boolean)
        .slice(0, 3);
    }
    const suggested = await suggestHeaderMappings(
      unmappedHeaders,
      samples,
      mapping.map((m) => m.field),
    );
    for (const [header, field] of Object.entries(suggested)) {
      if (!field) continue;
      mapping.push({ field, header, via: 'llm' });
      unmappedHeaders = unmappedHeaders.filter((h) => h !== header);
    }
  }

  if (!mapping.some((m) => m.field === 'unit_identifier')) {
    return NextResponse.json(
      {
        error: 'Couldn\'t find a unit or address column. Make sure one column holds the house number/address.',
        unmappedHeaders,
      },
      { status: 422 },
    );
  }

  const { homes, errors } = normaliseRows(sheet.rows, mapping);

  // Dedup against existing units + within the file. Append-only by design.
  const supabase = getSupabaseAdmin();
  const { data: existingUnits, error: existingError } = await supabase
    .from('units')
    .select('id, address, address_line_1, unit_number, unit_uid')
    .eq('development_id', developmentId);
  if (existingError) {
    return NextResponse.json({ error: `Could not check existing homes: ${existingError.message}` }, { status: 500 });
  }

  const existingKeys = new Set<string>();
  const existingUids = new Set<string>();
  for (const u of existingUnits || []) {
    for (const v of [u.address, u.address_line_1, u.unit_number]) {
      if (v) existingKeys.add(identifierKey(String(v)));
    }
    if (u.unit_uid) existingUids.add(String(u.unit_uid));
  }

  const seenInFile = new Set<string>();
  const newHomes: ParsedHome[] = [];
  const duplicates: string[] = [];
  for (const home of homes) {
    const key = identifierKey(home.unit_identifier);
    if (existingKeys.has(key) || seenInFile.has(key)) {
      duplicates.push(home.unit_identifier);
      continue;
    }
    seenInFile.add(key);
    newHomes.push(home);
  }

  const counts = {
    totalRows: sheet.rows.length,
    newHomes: newHomes.length,
    purchasers: newHomes.filter((h) => h.purchaser_name).length,
    withPipelineDates: newHomes.filter((h) => Object.keys(h.dates).length > 0).length,
    duplicates: duplicates.length,
    invalid: errors.length,
  };

  if (mode === 'dryRun') {
    return NextResponse.json({
      mapping: mapping.map(({ field, header, via }) => ({ field, header, via })),
      unmappedHeaders,
      sample: newHomes.slice(0, 5),
      counts,
      duplicates: duplicates.slice(0, 20),
      errors,
    });
  }

  // ---- commit ----
  const { projectId, error: projectError } = await ensureProjectIdForDevelopment(supabase, development);
  if (!projectId) {
    return NextResponse.json(
      { error: `Couldn't prepare the scheme for import${projectError ? ` (${projectError})` : ''}. Nothing was saved.` },
      { status: 500 },
    );
  }

  const warnings: string[] = [...errors];
  const droppedUnitCols = new Set<string>();
  const droppedPipelineCols = new Set<string>();
  const prefix = getDevelopmentPrefix(development.code);
  let inserted = 0;
  let pipelineCreated = 0;
  let unitIndex = (existingUnits || []).length;

  for (const home of newHomes) {
    unitIndex += 1;
    const unitNumber = extractUnitNumber(home.unit_identifier);

    let unitUid = generateSecureUnitUid(prefix, unitNumber);
    let guard = 0;
    while (existingUids.has(unitUid) && guard < 5) {
      unitUid = generateSecureUnitUid(prefix, unitNumber);
      guard++;
    }
    existingUids.add(unitUid);

    const unitRow: Record<string, unknown> = {
      tenant_id: tenantId,
      development_id: developmentId,
      project_id: projectId,
      development_code: development.code,
      unit_number: unitNumber,
      unit_code: generateUnitCode(development.code, unitIndex),
      unit_uid: unitUid,
      address: home.unit_identifier,
      address_line_1: home.unit_identifier,
      house_type_code: home.house_type ?? 'TBD',
      property_designation: home.property_designation,
      phase: home.phase,
      bedrooms: home.bedrooms,
      eircode: home.eircode,
      purchaser_name: home.purchaser_name,
      purchaser_email: home.purchaser_email,
      purchaser_phone: home.purchaser_phone,
      handover_date: home.dates.handover_date ?? null,
      unit_status: home.purchaser_name ? 'sold' : 'available',
    };

    const unitResult = await insertWithColumnFallback(supabase, 'units', unitRow, droppedUnitCols, warnings);
    if (!unitResult.id) {
      warnings.push(`Row ${home.rowNum} (${home.unit_identifier}): ${unitResult.error || 'insert failed'}`);
      continue;
    }
    inserted++;

    // Pipeline row whenever the tracker carried sale-side data.
    const flagEntries = Object.entries(home.flags) as Array<[CanonicalField, string]>;
    const hasPipelineData =
      Object.keys(home.dates).length > 0 ||
      flagEntries.length > 0 ||
      home.purchaser_name !== null ||
      home.sale_price !== null ||
      home.solicitor_name !== null ||
      home.sale_type !== null ||
      home.comments !== null ||
      home.status !== null;
    if (!hasPipelineData) continue;

    const d = home.dates;
    const pipelineRow: Record<string, unknown> = {
      tenant_id: tenantId,
      development_id: developmentId,
      unit_id: unitResult.id,
      purchaser_name: home.purchaser_name,
      purchaser_email: home.purchaser_email,
      purchaser_phone: home.purchaser_phone,
      sale_type: home.sale_type,
      housing_agency: home.housing_agency,
      sale_price: home.sale_price,
      solicitor_name: home.solicitor_name,
      solicitor_email: home.solicitor_email,
      solicitor_phone: home.solicitor_phone,
      release_date: d.release_date,
      sale_agreed_date: d.sale_agreed_date,
      deposit_date: d.deposit_date,
      contracts_issued_date: d.contracts_issued_date,
      queries_raised_date: d.queries_raised_date,
      queries_replied_date: d.queries_replied_date,
      signed_contracts_date: d.signed_contracts_date,
      counter_signed_date: d.counter_signed_date,
      snag_date: d.snag_date,
      drawdown_date: d.drawdown_date,
      handover_date: d.handover_date,
      sadrl_date: d.sadrl_date,
      proof_of_funds_date: d.proof_of_funds_date,
      deposit_receipt_date: d.deposit_receipt_date,
      loan_approved_date: d.loan_approved_date,
      one_part_returned_date: d.one_part_returned_date,
      projected_handover_date: d.projected_handover_date,
      snagging_start_date: d.snagging_start_date,
      mortgage_expiry_date: d.mortgage_expiry_date,
    };

    const pipelineResult = await insertWithColumnFallback(
      supabase, 'unit_sales_pipeline', pipelineRow, droppedPipelineCols, warnings,
    );
    if (!pipelineResult.id) {
      warnings.push(`Row ${home.rowNum} (${home.unit_identifier}): pipeline not created — ${pipelineResult.error}`);
      continue;
    }
    pipelineCreated++;

    // Comments + yes/no tracker flags land as one pipeline note, verbatim.
    const noteParts: string[] = [];
    if (home.comments) noteParts.push(home.comments);
    if (home.status) noteParts.push(`Status (imported): ${home.status}`);
    if (flagEntries.length > 0) {
      noteParts.push(
        'Tracker flags: ' +
          flagEntries.map(([f, v]) => `${FLAG_LABELS[f] || f}: ${v}`).join('; '),
      );
    }
    if (noteParts.length > 0) {
      const { error: noteError } = await supabase.from('unit_pipeline_notes').insert({
        tenant_id: tenantId,
        pipeline_id: pipelineResult.id,
        unit_id: unitResult.id,
        note_type: 'general',
        content: noteParts.join('\n'),
        created_by: session.id,
      });
      if (noteError) {
        warnings.push(`Row ${home.rowNum}: note not saved — ${noteError.message}`);
      }
    }
  }

  return NextResponse.json({
    inserted,
    skippedDuplicates: duplicates.length,
    pipelineCreated,
    errors: compressWarnings(warnings),
    developmentId,
  });
}
