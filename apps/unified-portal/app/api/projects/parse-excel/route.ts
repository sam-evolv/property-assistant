export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

interface UnitTypeRow {
  name: string;
  floor_plan_pdf_url: string;
  designation?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqm?: number;
}

interface UnitRow {
  address: string;
  unit_type_name: string;
  purchaser_name: string;
  handover_date: string;
  bedrooms?: number;
  bathrooms?: number;
}

function normalizeTypeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

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
    const unitTypesFromSheet: UnitTypeRow[] = [];
    const units: UnitRow[] = [];
    
    const hasExplicitUnitTypesSheet = !!workbook.Sheets['unit_types'];
    
    if (hasExplicitUnitTypesSheet) {
      const unitTypesSheet = workbook.Sheets['unit_types'];
      const unitTypesData = XLSX.utils.sheet_to_json(unitTypesSheet) as any[];
      for (const row of unitTypesData) {
        const name = row.name || row.Name || row.type || row.Type;
        if (name) {
          const bedroomsRaw = row.bedrooms || row.Bedrooms || row.beds || row.Beds || row.bed_count || row.bedroom_count;
          const bathroomsRaw = row.bathrooms || row.Bathrooms || row.baths || row.Baths || row.bath_count || row.bathroom_count;
          const sqmRaw = row.sqm || row.Sqm || row.floor_area || row.FloorArea || row.area || row.Area || row.size || row.Size;
          
          unitTypesFromSheet.push({
            name: String(name).trim(),
            floor_plan_pdf_url: row.floor_plan_pdf_url || row.floor_plan_url || row.FloorPlanUrl || '',
            designation: row.designation || row.Designation || undefined,
            bedrooms: bedroomsRaw ? Number(bedroomsRaw) : undefined,
            bathrooms: bathroomsRaw ? Number(bathroomsRaw) : undefined,
            sqm: sqmRaw ? Number(sqmRaw) : undefined,
          });
        }
      }
    }
    
    const unitsSheet = workbook.Sheets['units'] || workbook.Sheets[workbook.SheetNames[0]];
    if (unitsSheet) {
      const unitsData = XLSX.utils.sheet_to_json(unitsSheet) as any[];
      for (let i = 0; i < unitsData.length; i++) {
        const row = unitsData[i];
        const address = row.address || row.Address || row.unit_address || row.unit_number || row.unit || row.Unit || row.plot;
        const unitTypeName = row.unit_type_name || row.unit_type || row.type || row.Type || row.house_type || row.house_type_code;
        
        if (!address) {
          errors.push(`Row ${i + 2}: Missing unit identifier (address/unit_number/plot)`);
          continue;
        }
        if (!unitTypeName) {
          errors.push(`Row ${i + 2}: Missing unit type`);
          continue;
        }
        
        const bedroomsRaw = row.bedrooms || row.Bedrooms || row.beds || row.Beds || row.bed_count || row.bedroom_count;
        const bathroomsRaw = row.bathrooms || row.Bathrooms || row.baths || row.Baths || row.bath_count || row.bathroom_count;
        
        units.push({
          address: String(address).trim(),
          unit_type_name: String(unitTypeName).trim(),
          purchaser_name: row.purchaser_name || row.purchaser || row.owner || row.buyer || '',
          handover_date: row.handover_date || row.handover || '',
          bedrooms: bedroomsRaw ? Number(bedroomsRaw) : undefined,
          bathrooms: bathroomsRaw ? Number(bathroomsRaw) : undefined,
        });
      }
    }
    
    // Map normalized type name to: { originalName, bedrooms, bathrooms } from first unit encountered
    const distinctUnitTypesFromUnits = new Map<string, { originalName: string; bedrooms?: number; bathrooms?: number }>();
    for (const unit of units) {
      const normalized = normalizeTypeName(unit.unit_type_name);
      if (!distinctUnitTypesFromUnits.has(normalized)) {
        distinctUnitTypesFromUnits.set(normalized, {
          originalName: unit.unit_type_name,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
        });
      }
    }
    
    const enrichmentMap = new Map<string, UnitTypeRow>();
    for (const ut of unitTypesFromSheet) {
      enrichmentMap.set(normalizeTypeName(ut.name), ut);
    }
    
    const unitTypes: UnitTypeRow[] = [];
    const addedNormalized = new Set<string>();
    
    distinctUnitTypesFromUnits.forEach((unitTypeInfo, normalized) => {
      const enrichment = enrichmentMap.get(normalized);
      if (enrichment) {
        // Use enrichment data but fallback to unit data for bedrooms/bathrooms if not in enrichment
        unitTypes.push({
          ...enrichment,
          bedrooms: enrichment.bedrooms ?? unitTypeInfo.bedrooms,
          bathrooms: enrichment.bathrooms ?? unitTypeInfo.bathrooms,
        });
      } else {
        // No explicit unit_types sheet entry - use data from units
        unitTypes.push({
          name: unitTypeInfo.originalName,
          floor_plan_pdf_url: '',
          bedrooms: unitTypeInfo.bedrooms,
          bathrooms: unitTypeInfo.bathrooms,
        });
      }
      addedNormalized.add(normalized);
    });
    
    for (const ut of unitTypesFromSheet) {
      const normalized = normalizeTypeName(ut.name);
      if (!addedNormalized.has(normalized)) {
        unitTypes.push(ut);
        addedNormalized.add(normalized);
      }
    }
    
    if (units.length === 0) {
      errors.push('No units found in the Excel file. Ensure there is a "units" sheet or that the first sheet contains unit data.');
    }
    
    console.log(`[parse-excel] Parsed ${units.length} units, derived ${unitTypes.length} unit types (${unitTypesFromSheet.length} from sheet, ${distinctUnitTypesFromUnits.size} distinct in units)`);

    return NextResponse.json({
      unitTypes,
      units,
      errors,
      meta: {
        hasExplicitUnitTypesSheet,
        unitTypesFromSheet: unitTypesFromSheet.length,
        distinctUnitTypesFromUnits: distinctUnitTypesFromUnits.size,
      },
    });
  } catch (err) {
    console.error('[API /projects/parse-excel] Error:', err);
    return NextResponse.json(
      { error: 'Failed to parse Excel file' },
      { status: 500 }
    );
  }
}
