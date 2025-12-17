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

function normalizeTypeName(name: unknown): string {
  return clean(name).toLowerCase().replace(/\s+/g, ' ');
}

function normalizeRowHeaders(rawRow: RawRow): Record<string, any> {
  const normalized: Record<string, any> = {};
  for (const [key, value] of Object.entries(rawRow)) {
    normalized[normHeader(key)] = value;
  }
  return normalized;
}

function extractUnitIdentifier(row: Record<string, any>): string {
  return clean(row['unit_number'] ?? row['unit'] ?? row['unit_no'] ?? row['address'] ?? row['plot'] ?? row['plot_no']);
}

function extractUnitType(row: Record<string, any>): string {
  return clean(row['unit_type'] ?? row['house_type_code'] ?? row['house_type'] ?? row['type'] ?? row['house'] ?? row['property_type']);
}

function extractPurchaserName(row: Record<string, any>): string {
  return clean(row['purchaser_name'] ?? row['purchaser'] ?? row['owner'] ?? row['buyer_name'] ?? row['buyer'] ?? row['customer_name'] ?? row['customer'] ?? row['name'] ?? row['owner_name']);
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

    const rows = rawRows.map((rawRow) => {
      const normalized = normalizeRowHeaders(rawRow);
      return {
        unit_identifier: extractUnitIdentifier(normalized),
        unit_type: extractUnitType(normalized),
        purchaser_name: extractPurchaserName(normalized),
      };
    });

    const { data: existingUnits } = await supabaseAdmin
      .from('units')
      .select('id, address, purchaser_name')
      .eq('project_id', projectId);

    const existingUnitsMap = new Map<string, { id: string; purchaser_name: string | null }>();
    for (const u of existingUnits || []) {
      const normalizedAddr = normalizeTypeName(u.address || '');
      existingUnitsMap.set(normalizedAddr, { id: u.id, purchaser_name: u.purchaser_name });
    }

    const { data: existingUnitTypes } = await supabaseAdmin
      .from('unit_types')
      .select('id, name')
      .eq('project_id', projectId);

    const unitTypeMap = new Map<string, string>();
    for (const ut of existingUnitTypes || []) {
      unitTypeMap.set(normalizeTypeName(ut.name), ut.id);
    }

    const toCreate: { address: string; unit_type_name: string; purchaser_name: string | null }[] = [];
    const toUpdate: { id: string; purchaser_name: string }[] = [];
    const errors: string[] = [];
    const seenIdentifiers = new Set<string>();
    const missingTypes = new Set<string>();

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      if (!row.unit_identifier) {
        errors.push(`Row ${rowNum}: Missing unit identifier`);
        continue;
      }

      const normalizedIdentifier = normalizeTypeName(row.unit_identifier);

      if (seenIdentifiers.has(normalizedIdentifier)) {
        errors.push(`Row ${rowNum}: Duplicate unit "${row.unit_identifier}" in file`);
        continue;
      }
      seenIdentifiers.add(normalizedIdentifier);

      const existing = existingUnitsMap.get(normalizedIdentifier);

      if (existing) {
        if (row.purchaser_name && row.purchaser_name !== (existing.purchaser_name || '')) {
          toUpdate.push({ id: existing.id, purchaser_name: row.purchaser_name });
        } else {
          skipped++;
        }
      } else {
        if (!row.unit_type) {
          errors.push(`Row ${rowNum}: New unit "${row.unit_identifier}" needs a unit type`);
          continue;
        }

        const normalizedType = normalizeTypeName(row.unit_type);
        if (!unitTypeMap.has(normalizedType)) {
          missingTypes.add(row.unit_type);
        }

        toCreate.push({
          address: row.unit_identifier,
          unit_type_name: row.unit_type,
          purchaser_name: row.purchaser_name || null,
        });
      }
    }

    for (const typeName of missingTypes) {
      const { data: newType, error: typeError } = await supabaseAdmin
        .from('unit_types')
        .insert({ project_id: projectId, name: typeName })
        .select()
        .single();

      if (typeError) {
        errors.push(`Failed to create unit type "${typeName}": ${typeError.message}`);
      } else if (newType) {
        unitTypeMap.set(normalizeTypeName(typeName), newType.id);
      }
    }

    for (const unit of toCreate) {
      const normalizedType = normalizeTypeName(unit.unit_type_name);
      const typeId = unitTypeMap.get(normalizedType);
      
      if (!typeId) {
        errors.push(`Could not find/create unit type "${unit.unit_type_name}" for unit "${unit.address}"`);
        continue;
      }

      const { error: insertError } = await supabaseAdmin
        .from('units')
        .insert({
          project_id: projectId,
          address: unit.address,
          unit_type_id: typeId,
          purchaser_name: unit.purchaser_name,
        });

      if (insertError) {
        errors.push(`Failed to create unit "${unit.address}": ${insertError.message}`);
      } else {
        created++;
      }
    }

    for (const unit of toUpdate) {
      const { error: updateError } = await supabaseAdmin
        .from('units')
        .update({ purchaser_name: unit.purchaser_name })
        .eq('id', unit.id);

      if (updateError) {
        errors.push(`Failed to update unit: ${updateError.message}`);
      } else {
        updated++;
      }
    }

    console.log(`[Smart Import] Project ${projectId}: created=${created}, updated=${updated}, skipped=${skipped}, errors=${errors.length}`);

    return NextResponse.json({
      success: true,
      created,
      updated,
      skipped,
      errors,
      totalRows: rows.length,
    });

  } catch (err: any) {
    console.error('[Smart Import] Error:', err);
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 });
  }
}
