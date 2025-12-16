import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import * as xlsx from 'xlsx';

export const runtime = 'nodejs';

// Service role client bypasses RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
    db: { schema: 'public' }
  }
);

interface RawRow {
  [key: string]: any;
}

interface NormalizedRow {
  unit_identifier: string;
  unit_type: string;
  purchaser_name: string;
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
  return clean(row['unit_number'] ?? row['unit'] ?? row['unit_no'] ?? row['address']);
}

function extractUnitType(row: Record<string, any>): string {
  return clean(row['unit_type'] ?? row['house_type_code'] ?? row['house_type'] ?? row['type']);
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

    const projectId = params.projectId;

    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found in Supabase' }, { status: 404 });
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

    const rows: NormalizedRow[] = rawRows.map((rawRow) => {
      const normalized = normalizeRowHeaders(rawRow);
      return {
        unit_identifier: extractUnitIdentifier(normalized),
        unit_type: extractUnitType(normalized),
        purchaser_name: extractPurchaserName(normalized),
      };
    });

    const { data: existingUnits } = await supabaseAdmin
      .from('units')
      .select('address')
      .eq('project_id', projectId);

    const existingAddresses = new Set(
      (existingUnits || []).map((u) => normalizeTypeName(u.address || ''))
    );

    const errors: string[] = [];
    const seenIdentifiers = new Set<string>();
    const unitTypesInFile = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      if (!row.unit_identifier) {
        errors.push(`Row ${rowNum}: Missing unit identifier (accepted: unit_number, unit, unit_no, address)`);
        continue;
      }

      if (!row.unit_type) {
        errors.push(`Row ${rowNum}: Missing unit type (accepted: unit_type, house_type_code, house_type, type)`);
        continue;
      }

      const normalizedIdentifier = normalizeTypeName(row.unit_identifier);
      
      if (existingAddresses.has(normalizedIdentifier)) {
        errors.push(`Row ${rowNum}: Unit "${row.unit_identifier}" already exists in database`);
        continue;
      }

      if (seenIdentifiers.has(normalizedIdentifier)) {
        errors.push(`Row ${rowNum}: Duplicate unit "${row.unit_identifier}" in file`);
        continue;
      }

      seenIdentifiers.add(normalizedIdentifier);
      unitTypesInFile.add(row.unit_type);
    }

    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed - fix all errors before importing',
        totalRows: rows.length,
        validCount: seenIdentifiers.size,
        errorCount: errors.length,
        errors: errors,
      }, { status: 400 });
    }

    if (seenIdentifiers.size === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid rows to import',
        totalRows: rows.length,
      }, { status: 400 });
    }

    const { data: existingUnitTypes, error: typesError } = await supabaseAdmin
      .from('unit_types')
      .select('id, name')
      .eq('project_id', projectId);

    if (typesError) {
      console.error('[Import Units] Error fetching unit types:', typesError);
      return NextResponse.json({ error: 'Failed to fetch unit types' }, { status: 500 });
    }

    const unitTypeMap = new Map<string, string>();
    for (const ut of existingUnitTypes || []) {
      unitTypeMap.set(normalizeTypeName(ut.name), ut.id);
    }

    const missingTypes: string[] = [];
    for (const typeName of unitTypesInFile) {
      const normalized = normalizeTypeName(typeName);
      if (!unitTypeMap.has(normalized)) {
        missingTypes.push(typeName);
      }
    }

    let createdTypesCount = 0;
    if (missingTypes.length > 0) {
      console.log('[Import Units] Creating missing unit types:', missingTypes);
      
      for (const typeName of missingTypes) {
        const { data: insertedType, error: insertTypeError } = await supabaseAdmin
          .from('unit_types')
          .insert({
            project_id: projectId,
            name: typeName,
            floor_plan_pdf_url: null,
            specification_json: null,
          })
          .select()
          .single();

        if (insertTypeError) {
          if (insertTypeError.code === '23505') {
            console.log('[Import Units] Unit type already exists (concurrent creation):', typeName);
          } else {
            console.error('[Import Units] Fatal error creating unit type:', insertTypeError);
            return NextResponse.json({
              success: false,
              error: `Failed to create unit type "${typeName}": ${insertTypeError.message}`,
            }, { status: 500 });
          }
        } else if (insertedType) {
          createdTypesCount++;
          unitTypeMap.set(normalizeTypeName(insertedType.name), insertedType.id);
        }
      }

      const { data: refreshedTypes } = await supabaseAdmin
        .from('unit_types')
        .select('id, name')
        .eq('project_id', projectId);

      for (const ut of refreshedTypes || []) {
        unitTypeMap.set(normalizeTypeName(ut.name), ut.id);
      }

      console.log('[Import Units] Created', createdTypesCount, 'new unit types');
    }

    const validRows: Array<{ address: string; unit_type_id: string; purchaser_name: string }> = [];
    const unmappedTypes: string[] = [];
    
    for (const row of rows) {
      if (!row.unit_identifier || !row.unit_type) continue;
      
      const normalizedType = normalizeTypeName(row.unit_type);
      const unitTypeId = unitTypeMap.get(normalizedType);
      
      if (!unitTypeId) {
        unmappedTypes.push(row.unit_type);
        continue;
      }

      validRows.push({
        address: row.unit_identifier,
        unit_type_id: unitTypeId,
        purchaser_name: row.purchaser_name,
      });
    }

    if (unmappedTypes.length > 0) {
      console.error('[Import Units] Failed to map unit types:', unmappedTypes);
      return NextResponse.json({
        success: false,
        error: `Failed to resolve unit types: ${[...new Set(unmappedTypes)].join(', ')}`,
      }, { status: 500 });
    }

    if (validRows.length !== seenIdentifiers.size) {
      return NextResponse.json({
        success: false,
        error: `Row count mismatch: expected ${seenIdentifiers.size}, got ${validRows.length}`,
      }, { status: 500 });
    }

    const unitsToInsert = validRows.map((row) => ({
      project_id: projectId,
      address: row.address,
      unit_type_id: row.unit_type_id,
      purchaser_name: row.purchaser_name || null,
    }));

    const { data: insertedUnits, error: insertError } = await supabaseAdmin
      .from('units')
      .insert(unitsToInsert)
      .select();

    if (insertError) {
      console.error('[Import Units] Insert error:', insertError);
      return NextResponse.json({
        success: false,
        error: `Insert failed: ${insertError.message}`,
      }, { status: 500 });
    }

    console.log('[Import Units] Inserted:', insertedUnits?.length || 0, 'units for project:', project.name);

    // POST-IMPORT VALIDATION: Verify units are queryable via service role
    let verifiedCount = 0;
    try {
      const { count, error } = await supabaseAdmin
        .from('units')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId);
      
      if (!error) {
        verifiedCount = count || 0;
      }
      console.log(`[Import Units] Post-import verification: ${verifiedCount} total units in project, error: ${error?.message || 'none'}`);
      
      if (verifiedCount < (insertedUnits?.length || 0)) {
        console.warn('[Import Units] WARNING: Verified count is less than inserted count - possible RLS issue');
      }
    } catch (verifyError) {
      console.error('[Import Units] Post-import verification error:', verifyError);
    }

    return NextResponse.json({
      success: true,
      project: { id: project.id, name: project.name },
      totalRows: rows.length,
      inserted: insertedUnits?.length || 0,
      verified: verifiedCount,
      skipped: 0,
      unitTypesCreated: createdTypesCount,
    });
  } catch (error: any) {
    console.error('[Import Units] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}
