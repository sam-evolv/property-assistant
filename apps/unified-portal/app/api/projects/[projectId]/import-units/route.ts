import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import * as xlsx from 'xlsx';

export const runtime = 'nodejs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CSVRow {
  unit_number: string;
  unit_type: string;
}

function normalizeTypeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
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

    const { data: unitTypes, error: typesError } = await supabaseAdmin
      .from('unit_types')
      .select('id, name')
      .eq('project_id', projectId);

    if (typesError) {
      console.error('[Import Units] Error fetching unit types:', typesError);
      return NextResponse.json({ error: 'Failed to fetch unit types' }, { status: 500 });
    }

    if (!unitTypes || unitTypes.length === 0) {
      return NextResponse.json({
        error: 'No unit types defined for this project. Please create unit types first.',
      }, { status: 400 });
    }

    const unitTypeMap = new Map<string, string>();
    for (const ut of unitTypes) {
      unitTypeMap.set(normalizeTypeName(ut.name), ut.id);
    }

    console.log('[Import Units] Unit types loaded:', unitTypes.length);

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

    let rows: CSVRow[] = [];

    if (fileName.endsWith('.csv')) {
      const text = buffer.toString('utf-8');
      const workbook = xlsx.read(text, { type: 'string' });
      const sheetName = workbook.SheetNames[0];
      rows = xlsx.utils.sheet_to_json<CSVRow>(workbook.Sheets[sheetName]);
    } else {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      rows = xlsx.utils.sheet_to_json<CSVRow>(workbook.Sheets[sheetName]);
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File is empty or has no data rows' }, { status: 400 });
    }

    const { data: existingUnits } = await supabaseAdmin
      .from('units')
      .select('unit_number')
      .eq('project_id', projectId);

    const existingUnitNumbers = new Set(
      (existingUnits || []).map((u) => normalizeTypeName(u.unit_number || ''))
    );

    const errors: string[] = [];
    const validRows: Array<{ unit_number: string; unit_type_id: string }> = [];
    const seenUnitNumbers = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      if (!row.unit_number) {
        errors.push(`Row ${rowNum}: Missing unit_number column`);
        continue;
      }

      if (!row.unit_type) {
        errors.push(`Row ${rowNum}: Missing unit_type column`);
        continue;
      }

      const normalizedType = normalizeTypeName(row.unit_type);
      const unitTypeId = unitTypeMap.get(normalizedType);

      if (!unitTypeId) {
        errors.push(
          `Row ${rowNum}: Unit type "${row.unit_type}" not found. Available types: ${Array.from(unitTypeMap.keys()).join(', ')}`
        );
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
      validRows.push({
        unit_number: row.unit_number.trim(),
        unit_type_id: unitTypeId,
      });
    }

    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed - fix all errors before importing',
        totalRows: rows.length,
        validCount: validRows.length,
        errorCount: errors.length,
        errors: errors,
      }, { status: 400 });
    }

    if (validRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid rows to import',
        totalRows: rows.length,
      }, { status: 400 });
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
    });
  } catch (error: any) {
    console.error('[Import Units] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}
