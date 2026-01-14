#!/usr/bin/env tsx
/**
 * FIX SUPABASE UNIT TYPES
 * This script:
 * 1. Reads Excel files to get correct house_type_code, bedrooms, bathrooms, floor_area for each unit
 * 2. Creates/updates unit_types in Supabase with proper specification_json
 * 3. Updates each unit's unit_type_id to point to the correct house type
 */
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface UnitData {
  unitNumber: string;
  purchaserName: string;
  address: string;
  houseTypeCode: string;
  bedrooms: number | null;
  bathrooms: number | null;
  floorArea: number | null;
  eircode: string | null;
}

interface ProjectConfig {
  projectId: string;
  projectName: string;
  excelPath: string;
}

const PROJECTS: ProjectConfig[] = [
  {
    projectId: '57dc3919-2725-4575-8046-9179075ac88e',
    projectName: 'Longview Park',
    excelPath: '../../attached_assets/Longview_Park_Data_(2)_copy_1768418841669.xlsx'
  },
  {
    projectId: '6d3789de-2e46-430c-bf31-22224bd878da', 
    projectName: 'Rathard Park',
    excelPath: '../../attached_assets/Rathard_Park_-_Developer_Portal_Upload_(Formatted)_copy_1768419364749.xlsx'
  },
  {
    projectId: '9598cf36-3e3f-4b7d-be6d-d1e80f708f46',
    projectName: 'Rathard Lawn',
    excelPath: '../../attached_assets/Rathard_Lawn_-_Developer_Portal_Data_1768418836952.xlsx'
  }
];

function parseBedrooms(value: any): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const match = value.match(/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

function parseBathrooms(value: any): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const match = value.match(/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

function parseExcelFile(filePath: string, projectName: string): UnitData[] {
  console.log(`\n📖 Parsing: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`  ❌ File not found: ${filePath}`);
    return [];
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

  console.log(`  📊 Found ${data.length} rows in sheet: ${sheetName}`);
  if (data.length > 0) {
    console.log(`  📋 Columns: ${Object.keys(data[0] as any).join(', ')}`);
  }
  
  const units: UnitData[] = [];
  
  for (const row of data as any[]) {
    const unitNumber = String(row['unit_number'] || row['Unit Number'] || row['Unit'] || row['No.'] || '').trim();
    if (!unitNumber || unitNumber === 'Unit Number' || unitNumber === 'unit_number') continue;
    
    const houseTypeCode = String(row['house_type_code'] || row['unit_type'] || row['House Type'] || row['Type'] || '').trim().toUpperCase();
    if (!houseTypeCode) continue;
    
    const bedroomsRaw = row['bedrooms_raw'] || row['bedrooms'] || row['Bedrooms'];
    const bathroomsRaw = row['bathrooms'] || row['Bathrooms'];
    const bedrooms = parseBedrooms(bedroomsRaw);
    const bathrooms = parseBathrooms(bathroomsRaw);
    const floorArea = parseFloat(row['square_footage'] || row['floor_area'] || row['Sq.m'] || '0') || null;
    const purchaserName = String(row['purchaser_name'] || row['Purchaser Name'] || '').trim();
    const address = String(row['address_line_1'] || row['address'] || row['Address'] || '').trim();
    const eircode = String(row['eircode'] || row['Eircode'] || '').trim() || null;

    units.push({
      unitNumber: String(unitNumber),
      purchaserName,
      address,
      houseTypeCode,
      bedrooms,
      bathrooms,
      floorArea,
      eircode
    });
  }

  console.log(`  ✓ Parsed ${units.length} valid units`);
  
  const houseTypes = [...new Set(units.map(u => u.houseTypeCode))];
  console.log(`  📋 House types found: ${houseTypes.join(', ')}`);
  
  return units;
}

async function fixProjectUnitTypes(supabase: any, config: ProjectConfig, units: UnitData[]) {
  console.log(`\n🔧 Processing ${config.projectName} (${config.projectId})...`);
  
  if (units.length === 0) {
    console.log('  ⚠️ No units to process');
    return;
  }

  const uniqueHouseTypes = new Map<string, { bedrooms: number | null; bathrooms: number | null; floorArea: number | null }>();
  for (const unit of units) {
    if (!uniqueHouseTypes.has(unit.houseTypeCode)) {
      uniqueHouseTypes.set(unit.houseTypeCode, {
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        floorArea: unit.floorArea
      });
    }
  }

  console.log(`  📝 Creating/updating ${uniqueHouseTypes.size} unit types...`);
  
  const unitTypeMap = new Map<string, string>();
  
  for (const [houseTypeCode, specs] of uniqueHouseTypes) {
    const { data: existingType, error: fetchError } = await supabase
      .from('unit_types')
      .select('id, specification_json')
      .eq('project_id', config.projectId)
      .eq('name', houseTypeCode)
      .single();

    if (existingType) {
      const specJson = {
        ...(existingType.specification_json || {}),
        bedrooms: specs.bedrooms,
        bathrooms: specs.bathrooms,
        floor_area_sqm: specs.floorArea
      };

      const { error: updateError } = await supabase
        .from('unit_types')
        .update({ specification_json: specJson })
        .eq('id', existingType.id);

      if (updateError) {
        console.error(`    ❌ Failed to update unit type ${houseTypeCode}:`, updateError.message);
      } else {
        console.log(`    ✓ Updated unit type: ${houseTypeCode} (beds: ${specs.bedrooms}, baths: ${specs.bathrooms}, sqm: ${specs.floorArea})`);
      }
      unitTypeMap.set(houseTypeCode, existingType.id);
    } else {
      const specJson = {
        bedrooms: specs.bedrooms,
        bathrooms: specs.bathrooms,
        floor_area_sqm: specs.floorArea
      };

      const { data: newType, error: insertError } = await supabase
        .from('unit_types')
        .insert({
          project_id: config.projectId,
          name: houseTypeCode,
          specification_json: specJson
        })
        .select('id')
        .single();

      if (insertError) {
        console.error(`    ❌ Failed to create unit type ${houseTypeCode}:`, insertError.message);
      } else if (newType) {
        console.log(`    ✓ Created unit type: ${houseTypeCode} (beds: ${specs.bedrooms}, baths: ${specs.bathrooms}, sqm: ${specs.floorArea})`);
        unitTypeMap.set(houseTypeCode, newType.id);
      }
    }
  }

  console.log(`\n  🔗 Linking units to unit types...`);
  
  const { data: supabaseUnits, error: fetchUnitsError } = await supabase
    .from('units')
    .select('id, unit_number, address, unit_type_id')
    .eq('project_id', config.projectId);

  if (fetchUnitsError) {
    console.error('  ❌ Failed to fetch units:', fetchUnitsError.message);
    return;
  }

  console.log(`  📊 Found ${supabaseUnits?.length || 0} units in Supabase`);

  let updated = 0;
  let skipped = 0;

  for (const sbUnit of supabaseUnits || []) {
    const unitNumber = sbUnit.unit_number?.toString() || sbUnit.address?.match(/^(\d+)/)?.[1];
    if (!unitNumber) continue;

    const excelUnit = units.find(u => u.unitNumber === unitNumber || u.unitNumber === unitNumber.toString());
    if (!excelUnit) {
      skipped++;
      continue;
    }

    const correctUnitTypeId = unitTypeMap.get(excelUnit.houseTypeCode);
    if (!correctUnitTypeId) {
      console.log(`    ⚠️ No unit type found for ${unitNumber} (${excelUnit.houseTypeCode})`);
      continue;
    }

    if (sbUnit.unit_type_id !== correctUnitTypeId) {
      const { error: updateError } = await supabase
        .from('units')
        .update({ unit_type_id: correctUnitTypeId })
        .eq('id', sbUnit.id);

      if (updateError) {
        console.error(`    ❌ Failed to update unit ${unitNumber}:`, updateError.message);
      } else {
        updated++;
      }
    }
  }

  console.log(`  ✅ Updated ${updated} units, skipped ${skipped} (not in Excel)`);
}

async function main() {
  console.log('🚀 Starting Supabase Unit Type Fix...\n');

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  for (const project of PROJECTS) {
    const units = parseExcelFile(project.excelPath, project.projectName);
    await fixProjectUnitTypes(supabase, project, units);
  }

  console.log('\n✅ All projects processed!');
}

main().catch(console.error);
