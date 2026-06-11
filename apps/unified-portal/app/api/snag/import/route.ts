/**
 * POST /api/snag/import
 *
 * An external snag engineer (or the site team) uploads their own list —
 * any spreadsheet shape — and the AI organises it: headers mapped, rows
 * matched to houses, trade + severity assigned in one batch call, then
 * committed as canonical issue_reports with source 'uploaded_report'.
 *
 * Multipart: file (xlsx/xls/csv), development_id, unit_id (optional —
 * "this whole list is one house"), mode: dryRun | commit.
 *
 * dryRun previews mapping/counts and writes nothing. Rows that can't be
 * matched to a house are skipped and reported, never guessed.
 *
 * Auth via snag-auth, development-scoped. Gated on FEATURE_BUILDER_SNAG_APP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { isBuilderSnagAppEnabled } from '@/lib/feature-flags';
import {
  resolveSnagAuth,
  assertCanAccessDevelopment,
  snagAuthErrorToResponse,
  snagFeatureDisabledResponse,
  SnagAuthError,
} from '@/lib/assistant/snag-auth';
import { parseWorkbook, identifierKey } from '@/lib/home-import/parse';
import {
  mapSnagHeaders,
  normaliseSnagRows,
  classifySnagBatch,
  type ParsedSnagRow,
} from '@/lib/snag-import/parse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_ROWS = 500;

export async function POST(request: NextRequest) {
  if (!isBuilderSnagAppEnabled()) {
    return snagFeatureDisabledResponse();
  }

  let auth;
  try {
    auth = await resolveSnagAuth(request);
  } catch (err) {
    if (err instanceof SnagAuthError) return snagAuthErrorToResponse(err);
    throw err;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const developmentId = String(formData.get('development_id') || '');
  const unitIdParam = String(formData.get('unit_id') || '');
  const mode = String(formData.get('mode') || 'dryRun');

  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  if (!UUID_RE.test(developmentId)) {
    return NextResponse.json({ error: 'development_id must be a uuid' }, { status: 400 });
  }
  if (unitIdParam && !UUID_RE.test(unitIdParam)) {
    return NextResponse.json({ error: 'unit_id must be a uuid' }, { status: 400 });
  }
  if (mode !== 'dryRun' && mode !== 'commit') {
    return NextResponse.json({ error: 'mode must be dryRun or commit' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File too large (25MB max)' }, { status: 400 });
  }
  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
    return NextResponse.json({ error: 'Please upload an Excel (.xlsx/.xls) or CSV file' }, { status: 400 });
  }

  try {
    assertCanAccessDevelopment(auth, developmentId);
  } catch (err) {
    if (err instanceof SnagAuthError) return snagAuthErrorToResponse(err);
    throw err;
  }

  const supabase = getSupabaseAdmin();

  const { data: development } = await supabase
    .from('developments')
    .select('id, tenant_id, name')
    .eq('id', developmentId)
    .maybeSingle();
  if (!development || development.tenant_id !== auth.tenantId) {
    return NextResponse.json({ error: 'Development not found' }, { status: 404 });
  }

  // Houses in the development, for matching rows to units.
  const { data: units, error: unitsErr } = await supabase
    .from('units')
    .select('id, unit_number, address, address_line_1')
    .eq('development_id', developmentId);
  if (unitsErr) {
    return NextResponse.json({ error: 'Could not load houses' }, { status: 500 });
  }
  const unitByKey = new Map<string, string>();
  for (const u of units || []) {
    for (const v of [u.unit_number, u.address, u.address_line_1]) {
      if (v) unitByKey.set(identifierKey(String(v)), u.id);
    }
  }

  let fallbackUnitId: string | null = null;
  if (unitIdParam) {
    const belongs = (units || []).some((u) => u.id === unitIdParam);
    if (!belongs) {
      return NextResponse.json({ error: 'That house is not in this development' }, { status: 400 });
    }
    fallbackUnitId = unitIdParam;
  }

  // Parse + map + normalise
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
      { error: `That's ${sheet.rows.length} rows — the importer takes up to ${MAX_ROWS} snags at a time.` },
      { status: 400 },
    );
  }

  const { mapped, unmapped } = mapSnagHeaders(sheet.headers);
  const { rows, errors } = normaliseSnagRows(sheet.rows, mapped);

  // Resolve each row to a house. A house chosen in the form is explicit
  // intent and wins outright — sheets for one house often carry a "No."
  // column that would otherwise mis-match against unit numbers.
  const ready: Array<ParsedSnagRow & { resolvedUnitId: string }> = [];
  const unmatched: string[] = [];
  for (const row of rows) {
    const matchedId =
      fallbackUnitId ||
      (row.unit_identifier && unitByKey.get(identifierKey(row.unit_identifier))) ||
      null;
    if (!matchedId) {
      unmatched.push(`Row ${row.rowNum}: "${(row.unit_identifier || row.title).slice(0, 60)}"`);
      continue;
    }
    ready.push({ ...row, resolvedUnitId: matchedId });
  }

  const counts = {
    totalRows: sheet.rows.length,
    snags: ready.length,
    houses: new Set(ready.map((r) => r.resolvedUnitId)).size,
    alreadyDone: ready.filter((r) => r.resolved).length,
    unmatched: unmatched.length,
    invalid: errors.length,
  };

  if (mode === 'dryRun') {
    return NextResponse.json({
      mapping: mapped,
      unmappedHeaders: unmapped,
      counts,
      sample: ready.slice(0, 5).map((r) => ({
        title: r.title,
        room: r.room,
        unit_identifier: r.unit_identifier,
        resolved: r.resolved,
      })),
      unmatched: unmatched.slice(0, 10),
      errors,
    });
  }

  // ---- commit ----
  // One batch call organises the list: trade + severity per row. Fail-soft.
  const classifications = await classifySnagBatch(ready);

  const warnings = [...errors];
  let inserted = 0;
  let resolvedImported = 0;
  let classified = 0;
  const nowIso = new Date().toISOString();

  for (let i = 0; i < ready.length; i++) {
    const row = ready[i];
    const klass = classifications[i];
    const insertRow: Record<string, unknown> = {
      tenant_id: auth.tenantId,
      development_id: developmentId,
      unit_id: row.resolvedUnitId,
      user_id: auth.userId,
      title: row.title,
      description: row.description,
      room: row.room,
      status: row.resolved ? 'resolved' : 'open',
      priority: 'normal',
      source: 'uploaded_report',
      logged_by_user_id: auth.userId,
      logged_by_role: auth.role,
    };
    if (row.resolved) insertRow.resolved_at = nowIso;
    if (klass?.severity) insertRow.severity_label = klass.severity;
    if (klass?.trade) insertRow.likely_trade = klass.trade;

    const { data: issueRow, error: insertErr } = await supabase
      .from('issue_reports')
      .insert(insertRow)
      .select('id')
      .single();
    if (insertErr || !issueRow) {
      warnings.push(`Row ${row.rowNum}: ${insertErr?.message || 'insert failed'}`);
      continue;
    }
    inserted++;
    if (row.resolved) resolvedImported++;
    if (klass?.trade || klass?.severity) classified++;

    const { error: eventErr } = await supabase.from('issue_events').insert({
      tenant_id: auth.tenantId,
      issue_report_id: issueRow.id,
      event_type: 'snag_logged',
      actor_type: auth.role,
      actor_id: auth.userId,
      metadata: {
        source: 'uploaded_report',
        file_name: file.name,
        row: row.rowNum,
        ...(row.resolved ? { imported_as_resolved: true } : {}),
      },
    });
    if (eventErr) {
      warnings.push(`Row ${row.rowNum}: event not recorded — ${eventErr.message}`);
    }
  }

  return NextResponse.json({
    inserted,
    resolvedImported,
    classified,
    skippedUnmatched: unmatched.length,
    houses: counts.houses,
    errors: warnings,
  });
}
