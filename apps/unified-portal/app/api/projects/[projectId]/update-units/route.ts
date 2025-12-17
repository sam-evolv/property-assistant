import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import * as xlsx from 'xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      db: { schema: 'public' }
    }
  );
}

interface RawRow {
  [key: string]: any;
}

function asString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  try { return String(v); } catch { return ''; }
}

function clean(v: unknown): string {
  return asString(v).trim();
}

function normHeader(h: unknown): string {
  return clean(h).toLowerCase().replace(/[\s\-]+/g, '_');
}

function normalizeRowHeaders(rawRow: RawRow): Record<string, any> {
  const normalized: Record<string, any> = {};
  for (const [key, value] of Object.entries(rawRow)) {
    normalized[normHeader(key)] = value;
  }
  return normalized;
}

function extractUnitIdentifier(row: Record<string, any>): string {
  return clean(row['unit_number'] ?? row['unit'] ?? row['unit_no'] ?? row['address']);
}

function extractPurchaserName(row: Record<string, any>): string {
  return clean(row['purchaser_name'] ?? row['purchaser'] ?? row['owner'] ?? row['buyer_name'] ?? row['buyer'] ?? row['customer_name'] ?? row['customer']);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    await requireRole(['super_admin']);
    const supabaseAdmin = getSupabaseAdmin();

    const projectId = params.projectId;

    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json({ error: 'Invalid file format. Please upload CSV or Excel file.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let rawRows: RawRow[] = [];

    if (fileName.endsWith('.csv')) {
      const text = buffer.toString('utf-8');
      const workbook = xlsx.read(text, { type: 'string' });
      const sheetName = workbook.SheetNames[0];
      rawRows = xlsx.utils.sheet_to_json<RawRow>(workbook.Sheets[sheetName]);
    } else {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      rawRows = xlsx.utils.sheet_to_json<RawRow>(workbook.Sheets[sheetName]);
    }

    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'File is empty or has no data rows' }, { status: 400 });
    }

    const { data: existingUnits, error: unitsError } = await supabaseAdmin
      .from('units')
      .select('id, address, purchaser_name')
      .eq('project_id', projectId);

    if (unitsError) {
      console.error('[Update Units] Error fetching units:', unitsError);
      return NextResponse.json({ error: 'Failed to fetch existing units' }, { status: 500 });
    }

    const unitsByAddress = new Map<string, { id: string; purchaser_name: string | null }>();
    for (const unit of existingUnits || []) {
      const normalizedAddr = (unit.address || '').toLowerCase().trim();
      unitsByAddress.set(normalizedAddr, { id: unit.id, purchaser_name: unit.purchaser_name });
    }

    let matched = 0;
    let updated = 0;
    let skipped = 0;
    let notFound = 0;
    const updates: { id: string; purchaser_name: string }[] = [];
    const notFoundList: string[] = [];

    for (const rawRow of rawRows) {
      const normalized = normalizeRowHeaders(rawRow);
      const unitIdentifier = extractUnitIdentifier(normalized);
      const purchaserName = extractPurchaserName(normalized);

      if (!unitIdentifier) {
        skipped++;
        continue;
      }

      const normalizedIdentifier = unitIdentifier.toLowerCase().trim();
      const existingUnit = unitsByAddress.get(normalizedIdentifier);

      if (!existingUnit) {
        notFound++;
        if (notFoundList.length < 10) {
          notFoundList.push(unitIdentifier);
        }
        continue;
      }

      matched++;

      if (purchaserName && purchaserName !== existingUnit.purchaser_name) {
        updates.push({ id: existingUnit.id, purchaser_name: purchaserName });
      }
    }

    for (const update of updates) {
      const { error: updateError } = await supabaseAdmin
        .from('units')
        .update({ purchaser_name: update.purchaser_name })
        .eq('id', update.id);

      if (!updateError) {
        updated++;
      } else {
        console.error('[Update Units] Update error for unit:', update.id, updateError);
      }
    }

    console.log(`[Update Units] Project: ${project.name}, Matched: ${matched}, Updated: ${updated}, Not found: ${notFound}, Skipped: ${skipped}`);

    return NextResponse.json({
      success: true,
      project: { id: project.id, name: project.name },
      totalRows: rawRows.length,
      matched,
      updated,
      skipped,
      notFound,
      notFoundList: notFoundList.length > 0 ? notFoundList : undefined,
    });
  } catch (error: any) {
    console.error('[Update Units] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Update failed' },
      { status: 500 }
    );
  }
}
