import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import * as xlsx from 'xlsx';

export const runtime = 'nodejs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RawRow {
  [key: string]: any;
}

interface NormalizedRow {
  unit_number: string;
  unit_type: string;
}

function normalizeTypeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function normalizeRowHeaders(rawRow: RawRow): Record<string, any> {
  const normalized: Record<string, any> = {};
  for (const [key, value] of Object.entries(rawRow)) {
    normalized[normalizeHeader(key)] = value;
  }
  return normalized;
}

function extractUnitNumber(row: Record<string, any>): string | undefined {
  return row['unit_number'] ?? row['unit'] ?? row['unit_no'];
}

function extractUnitType(row: Record<string, any>): string | undefined {
  return row['unit_type'] ?? row['house_type_code'] ?? row['house_type'] ?? row['type'];
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
        unit_number: String(extractUnitNumber(normalized) ?? '').trim(),
        unit_type: String(extractUnitType(normalized) ?? '').trim(),
      };
    });

    const { data: existingUnits } = await supabaseAdmin
      .from('units')
      .select('unit_number')
      .eq('project_id', projectId);

    const existingUnitNumbers = new Set(
      (existingUnits || []).map((u) => normalizeTypeName(u.unit_number || ''))
    );

    const errors: string[] = [];
    const seenUnitNumbers = new Set<string>();
    const unitTypesInFile = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      if (!row.unit_number) {
        errors.push(`Row ${rowNum}: Missing unit number (accepted: unit_number, unit, unit_no)`);
        continue;
      }

      if (!row.unit_type) {
        errors.push(`Row ${rowNum}: Missing unit type (accepted: unit_type, house_type_code, house_type, type)`);
        continue;
      }

      const normalizedUnitNumber = normalizeTypeName(row.unit_number);
      
      if (existingUnitNumbers.has(normalizedUnitNumber)) {
        errors.push(`Row ${rowNum}: Unit "${row.unit_number}" already exists in database`);
        continue;
      }

      if (seenUnitNumbers.has(normalizedUnitNumber)) {
        errors.push(`Row ${rowNum}: Duplicate unit "${row.unit_number}" in file`);
        continue;
      }

      seenUnitNumbers.add(normalizedUnitNumber);
      unitTypesInFile.add(row.unit_type.trim());
    }

    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed - fix all errors before importing',
        totalRows: rows.length,
        validCount: seenUnitNumbers.size,
        errorCount: errors.length,
        errors: errors,
      }, { status: 400 });
    }

    if (seenUnitNumbers.size === 0) {
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

    const validRows: Array<{ unit_number: string; unit_type_id: string }> = [];
    const unmappedTypes: string[] = [];
    
    for (const row of rows) {
      if (!row.unit_number || !row.unit_type) continue;
      
      const normalizedType = normalizeTypeName(row.unit_type);
      const unitTypeId = unitTypeMap.get(normalizedType);
      
      if (!unitTypeId) {
        unmappedTypes.push(row.unit_type);
        continue;
      }

      validRows.push({
        unit_number: row.unit_number.trim(),
        unit_type_id: unitTypeId,
      });
    }

    if (unmappedTypes.length > 0) {
      console.error('[Import Units] Failed to map unit types:', unmappedTypes);
      return NextResponse.json({
        success: false,
        error: `Failed to resolve unit types: ${[...new Set(unmappedTypes)].join(', ')}`,
      }, { status: 500 });
    }

    if (validRows.length !== seenUnitNumbers.size) {
      return NextResponse.json({
        success: false,
        error: `Row count mismatch: expected ${seenUnitNumbers.size}, got ${validRows.length}`,
      }, { status: 500 });
    }

    const unitsToInsert = validRows.map((row) => ({
      project_id: projectId,
      unit_number: row.unit_number,
      unit_type_id: row.unit_type_id,
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

    return NextResponse.json({
      success: true,
      project: { id: project.id, name: project.name },
      totalRows: rows.length,
      inserted: insertedUnits?.length || 0,
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
