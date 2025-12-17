export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { units, developments, houseTypes } from '@openhouse/db/schema';
import { eq, and } from 'drizzle-orm';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { nanoid } from 'nanoid';
import {
  mapAllColumns,
  mapRow,
  validateRequiredFields,
  getAdminSession,
} from '@openhouse/api';

interface ImportResult {
  rowIndex: number;
  status: 'inserted' | 'updated' | 'skipped' | 'error';
  unitNumber?: string;
  unitUid?: string;
  error?: string;
  details?: string;
}

/**
 * Generate a stable unique ID for a house
 * Uses deterministic approach: development_code + unit_number
 * Falls back to nanoid for uniqueness if needed
 */
function generateStableUnitUid(
  developmentCode: string,
  unitNumber: string,
  existingUid?: string
): string {
  if (existingUid && existingUid.trim() !== '') {
    return existingUid.trim();
  }
  
  // Create a stable, predictable UID based on development + unit
  const cleanUnitNumber = unitNumber.toString().trim().padStart(3, '0');
  return `${developmentCode}-${cleanUnitNumber}`;
}

/**
 * Parse CSV or XLSX file to array of records
 */
async function parseFile(file: File): Promise<any[]> {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    // Parse XLSX
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
  } else {
    // Parse CSV
    const text = await file.text();
    return parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  }
}

/**
 * Helper to safely parse decimal values
 */
function parseDecimal(val: any): string | null {
  if (!val || val === '') return null;
  const str = String(val).trim();
  const num = parseFloat(str);
  return isNaN(num) ? null : str;
}

/**
 * Helper to safely parse integer values
 */
function parseInteger(val: any): number | null {
  if (!val || val === '') return null;
  const num = typeof val === 'string' ? parseInt(val, 10) : val;
  return isNaN(num) ? null : num;
}

/**
 * Parse bedrooms from various formats like "3 Bedroom", "3 bed", "3", etc.
 */
function parseBedrooms(val: any): number | null {
  if (!val || val === '') return null;
  const str = String(val).trim();
  // Extract first number from string
  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Helper to safely get string values (empty string => null)
 */
function getString(val: any): string | null {
  return val && String(val).trim() !== '' ? String(val).trim() : null;
}

export async function POST(req: NextRequest) {
  console.log('================================================================================');
  console.log('📥 CSV/XLSX HOUSES IMPORT API - REQUEST RECEIVED');
  console.log('================================================================================');
  
  const results: ImportResult[] = [];
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errored = 0;
  
  try {
    // Authentication & Authorization
    const session = await getAdminSession();
    
    if (!session) {
      console.error('❌ Unauthorized: No valid session');
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }
    
    console.log(`✅ Authenticated: ${session.email} (${session.role})`);
    
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const developmentId = formData.get('developmentId') as string;
    
    console.log(`📁 File: ${file?.name || 'N/A'} (${file?.size || 0} bytes)`);
    console.log(`🏢 Development ID: ${developmentId}`);
    
    if (!file) {
      console.error('❌ Missing file');
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }
    
    if (!developmentId) {
      console.error('❌ Missing developmentId');
      return NextResponse.json({ error: 'Missing developmentId' }, { status: 400 });
    }

    // Fetch development
    console.log(`🔍 Fetching development from database...`);
    const dev = await db
      .select()
      .from(developments)
      .where(eq(developments.id, developmentId))
      .limit(1);
      
    if (!dev || dev.length === 0) {
      console.error(`❌ Development not found: ${developmentId}`);
      return NextResponse.json({ error: 'Development not found' }, { status: 404 });
    }

    const development = dev[0];
    
    // Tenant Authorization: Ensure admin can only import to their own tenant's developments
    if (development.tenant_id !== session.tenantId && session.role !== 'super_admin') {
      console.error(`❌ Forbidden: Admin ${session.email} cannot import to development ${developmentId} (different tenant)`);
      return NextResponse.json(
        { error: 'Forbidden. You can only import houses to your own developments.' },
        { status: 403 }
      );
    }
    
    console.log(`✅ Authorization passed: Admin has access to tenant ${development.tenant_id}`);
    
    // Ensure development has a code
    let developmentCode = development.code;
    if (!developmentCode || developmentCode.trim() === '') {
      developmentCode = development.name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      console.log(`⚠️  Development has no code, generated: ${developmentCode}`);
    }
    
    console.log(`✅ Development found: ${development.name} (${developmentCode})`);
    
    // Fetch valid house types for this development
    console.log(`🏗️  Fetching house types for development...`);
    const validHouseTypes = await db
      .select()
      .from(houseTypes)
      .where(eq(houseTypes.development_id, developmentId));
    
    const houseTypeCodesSet = new Set(validHouseTypes.map(ht => ht.house_type_code));
    console.log(`✅ Found ${validHouseTypes.length} house types: ${Array.from(houseTypeCodesSet).join(', ')}`);
    
    // Parse file (CSV or XLSX)
    console.log(`📄 Parsing file...`);
    const rawRecords = await parseFile(file);
    
    if (!rawRecords || rawRecords.length === 0) {
      console.error('❌ No data found in file');
      return NextResponse.json({ error: 'No data found in file' }, { status: 400 });
    }
    
    console.log(`✅ Detected ${rawRecords.length} rows`);
    
    // Map columns using universal mapper
    const headers = Object.keys(rawRecords[0]);
    console.log(`📋 CSV Headers:`, headers);
    
    const columnMappings = mapAllColumns(headers);
    console.log(`🔗 Column Mappings:`, Object.fromEntries(columnMappings));
    
    // Process each row
    console.log('\n📘 ROW VALIDATION & PROCESSING');
    console.log('================================================================================');
    
    for (let i = 0; i < rawRecords.length; i++) {
      const rowIndex = i + 1;
      const rawRow = rawRecords[i];
      
      // Map row to standard fields
      const mappedRow = mapRow(rawRow, columnMappings);
      
      // Validate required fields
      const validation = validateRequiredFields(mappedRow, rowIndex);
      
      if (!validation.valid) {
        console.error(`❌ Row ${rowIndex}: FAILED VALIDATION`);
        validation.errors.forEach(err => console.error(`   ${err}`));
        results.push({
          rowIndex,
          status: 'error',
          error: validation.errors.join('; '),
        });
        errored++;
        continue;
      }
      
      // Validate house type code
      if (validHouseTypes.length > 0 && !houseTypeCodesSet.has(mappedRow.house_type_code)) {
        console.error(`❌ Row ${rowIndex}: Invalid house_type_code "${mappedRow.house_type_code}"`);
        console.error(`   Valid types: ${Array.from(houseTypeCodesSet).join(', ')}`);
        results.push({
          rowIndex,
          status: 'error',
          unitNumber: mappedRow.unit_number,
          error: `Invalid house_type_code "${mappedRow.house_type_code}". Valid types: ${Array.from(houseTypeCodesSet).join(', ')}`,
        });
        errored++;
        continue;
      }
      
      // Normalize unit_number to 3-digit format for consistent matching
      const normalizedUnitNumber = String(mappedRow.unit_number).trim().padStart(3, '0');
      
      // Generate stable unique ID
      const unitUid = generateStableUnitUid(
        developmentCode,
        normalizedUnitNumber,
        mappedRow.unique_id
      );
      
      const unitCode = mappedRow.unit_code || normalizedUnitNumber;
      
      try {
        // Check if unit already exists (try both normalized and original format)
        const existing = await db
          .select()
          .from(units)
          .where(
            and(
              eq(units.tenant_id, development.tenant_id),
              eq(units.development_id, developmentId),
              eq(units.unit_number, normalizedUnitNumber)
            )
          )
          .limit(1);
        
        // Determine address components from CSV - no development-specific defaults
        const addressLine2 = getString(mappedRow.address_line_2);
        const city = getString(mappedRow.city);
        const stateProvince = getString(mappedRow.state_province);
        const country = getString(mappedRow.country);

        const unitData = {
          tenant_id: development.tenant_id,
          development_id: developmentId,
          development_code: developmentCode,
          unit_number: normalizedUnitNumber,
          unit_code: unitCode,
          unit_uid: unitUid,
          address_line_1: mappedRow.address || `${normalizedUnitNumber} ${development.name}`,
          address_line_2: addressLine2,
          city: city,
          state_province: stateProvince,
          postal_code: getString(mappedRow.postal_code),
          country: country,
          eircode: getString(mappedRow.eircode),
          property_type: getString(mappedRow.property_type) || 'House',
          property_designation: getString(mappedRow.property_designation),
          house_type_code: mappedRow.house_type_code,
          bedrooms: parseBedrooms(mappedRow.bedrooms),
          bathrooms: parseInteger(mappedRow.bathrooms),
          square_footage: parseInteger(mappedRow.square_footage) || parseDecimal(mappedRow.square_footage) as any,
          floor_area_m2: parseDecimal(mappedRow.floor_area_m2),
          purchaser_name: getString(mappedRow.purchaser_name),
          purchaser_email: getString(mappedRow.purchaser_email),
          purchaser_phone: getString(mappedRow.purchaser_phone),
          mrpn: getString(mappedRow.mrpn),
          electricity_account: getString(mappedRow.electricity_account),
          esb_eirgrid_number: getString(mappedRow.esb_eirgrid_number),
          metadata: { ...rawRow, bedrooms_raw: mappedRow.bedrooms },
        };
        
        if (existing && existing.length > 0) {
          // Update existing unit
          await db
            .update(units)
            .set(unitData)
            .where(eq(units.id, existing[0].id));
          
          console.log(`🔄 Row ${rowIndex}: UPDATED - Unit ${normalizedUnitNumber} (${unitUid})`);
          results.push({
            rowIndex,
            status: 'updated',
            unitNumber: normalizedUnitNumber,
            unitUid,
          });
          updated++;
        } else {
          // Insert new unit
          await db.insert(units).values(unitData);
          
          console.log(`✅ Row ${rowIndex}: INSERTED - Unit ${normalizedUnitNumber} (${unitUid})`);
          results.push({
            rowIndex,
            status: 'inserted',
            unitNumber: normalizedUnitNumber,
            unitUid,
          });
          inserted++;
        }
      } catch (error: any) {
        console.error(`❌ Row ${rowIndex}: DATABASE ERROR`);
        console.error(`   Unit: ${normalizedUnitNumber}`);
        console.error(`   Error: ${error.message}`);
        if (error.detail) console.error(`   Detail: ${error.detail}`);
        if (error.hint) console.error(`   Hint: ${error.hint}`);
        
        results.push({
          rowIndex,
          status: 'error',
          unitNumber: normalizedUnitNumber,
          error: error.message,
          details: error.detail || error.hint,
        });
        errored++;
      }
    }
    
    // Print summary
    console.log('\n================================================================================');
    console.log('🏁 IMPORT COMPLETED');
    console.log('================================================================================');
    console.log(`📊 Total rows: ${rawRecords.length}`);
    console.log(`✅ Inserted: ${inserted}`);
    console.log(`🔄 Updated: ${updated}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errored}`);
    console.log('================================================================================\n');

    return NextResponse.json({
      success: errored === 0,
      summary: {
        total: rawRecords.length,
        inserted,
        updated,
        skipped,
        errors: errored,
      },
      results,
    });
  } catch (error: any) {
    console.error('❌ [HOUSES IMPORT] FATAL ERROR:', error);
    console.error('Stack:', error.stack);
    console.log('================================================================================\n');
    
    return NextResponse.json({
      success: false,
      error: error.message,
      summary: {
        total: 0,
        inserted,
        updated,
        skipped,
        errors: errored + 1,
      },
      results,
    }, { status: 500 });
  }
}
