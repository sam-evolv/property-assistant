import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    
    const errors: string[] = [];
    const unitTypes: { name: string; floor_plan_pdf_url: string }[] = [];
    const units: { address: string; unit_type_name: string; purchaser_name: string; handover_date: string }[] = [];
    
    const unitTypesSheet = workbook.Sheets['unit_types'] || workbook.Sheets[workbook.SheetNames[0]];
    if (unitTypesSheet) {
      const unitTypesData = XLSX.utils.sheet_to_json(unitTypesSheet) as any[];
      for (const row of unitTypesData) {
        const name = row.name || row.Name || row.type || row.Type;
        if (name) {
          unitTypes.push({
            name: String(name).trim(),
            floor_plan_pdf_url: row.floor_plan_pdf_url || row.floor_plan_url || '',
          });
        }
      }
    }
    
    const unitsSheet = workbook.Sheets['units'] || workbook.Sheets[workbook.SheetNames[1]];
    if (unitsSheet) {
      const unitsData = XLSX.utils.sheet_to_json(unitsSheet) as any[];
      for (let i = 0; i < unitsData.length; i++) {
        const row = unitsData[i];
        const address = row.address || row.Address || row.unit_address;
        const unitTypeName = row.unit_type_name || row.unit_type || row.type || row.Type;
        
        if (!address) {
          errors.push(`Row ${i + 2} in units sheet: Missing address`);
          continue;
        }
        if (!unitTypeName) {
          errors.push(`Row ${i + 2} in units sheet: Missing unit type`);
          continue;
        }
        
        units.push({
          address: String(address).trim(),
          unit_type_name: String(unitTypeName).trim(),
          purchaser_name: row.purchaser_name || row.purchaser || '',
          handover_date: row.handover_date || row.handover || '',
        });
      }
    }
    
    if (unitTypes.length === 0 && units.length === 0) {
      errors.push('No data found in the Excel file. Ensure sheets are named "unit_types" and "units".');
    }

    return NextResponse.json({
      unitTypes,
      units,
      errors,
    });
  } catch (err) {
    console.error('[API /projects/parse-excel] Error:', err);
    return NextResponse.json(
      { error: 'Failed to parse Excel file' },
      { status: 500 }
    );
  }
}
