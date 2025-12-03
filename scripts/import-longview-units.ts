import { db } from '../packages/db/client';
import { units, developments } from '../packages/db/schema';
import { eq, and } from 'drizzle-orm';
import { readFile } from 'fs/promises';
import { parse } from 'csv-parse/sync';

async function importLongviewUnits() {
  console.log('='.repeat(80));
  console.log('📊 IMPORTING LONGVIEW PARK UNITS FROM CSV');
  console.log('='.repeat(80));

  // Read CSV
  const csvContent = await readFile('/tmp/longview_units.csv', 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`Found ${records.length} units in CSV\n`);

  // Get Longview Park development
  const [development] = await db
    .select()
    .from(developments)
    .where(eq(developments.name, 'Longview Park'))
    .limit(1);

  if (!development) {
    throw new Error('Longview Park development not found!');
  }

  console.log(`Development: ${development.name} (${development.id})`);
  console.log(`Tenant: ${development.tenant_id}\n`);

  let updated = 0;
  let created = 0;

  for (const record of records) {
    const unitUid = record.unit_uid;
    const houseTypeCode = record.house_type_code;
    
    // Parse bedrooms and bathrooms (e.g., "3 Bedroom" -> 3)
    const bedroomsMatch = record.bedrooms_raw?.match(/(\d+)/);
    const bathroomsMatch = record.bathrooms?.match(/(\d+)/);
    const bedrooms = bedroomsMatch ? parseInt(bedroomsMatch[1]) : null;
    const bathrooms = bathroomsMatch ? parseInt(bathroomsMatch[1]) : null;
    
    // Parse square footage
    const squareFootage = record.square_footage ? parseFloat(record.square_footage) : null;

    // Check if unit exists
    const [existingUnit] = await db
      .select()
      .from(units)
      .where(
        and(
          eq(units.unit_uid, unitUid),
          eq(units.tenant_id, development.tenant_id)
        )
      )
      .limit(1);

    const unitData = {
      tenant_id: development.tenant_id,
      development_id: development.id,
      development_code: record.development_code,
      unit_number: record.unit_number,
      unit_uid: unitUid,
      unit_code: unitUid,
      house_type_code: houseTypeCode,
      purchaser_name: record.purchaser_name,
      purchaser_email: null,
      purchaser_phone: null,
      address_line_1: record.address_line_1,
      property_designation: record.property_designation,
      property_type: record.property_type_raw,
      bedrooms,
      bathrooms,
      square_footage: squareFootage ? Math.round(squareFootage) : null,
      floor_area_m2: squareFootage ? (squareFootage * 0.092903).toFixed(2) : null, // Convert sq ft to m²
    };

    if (existingUnit) {
      // Update existing
      await db
        .update(units)
        .set(unitData)
        .where(eq(units.id, existingUnit.id));
      updated++;
      console.log(`✓ Updated: ${unitUid} (${houseTypeCode}) - ${bedrooms}bed/${bathrooms}bath - ${squareFootage}sqft`);
    } else {
      // Create new
      await db.insert(units).values(unitData);
      created++;
      console.log(`+ Created: ${unitUid} (${houseTypeCode}) - ${bedrooms}bed/${bathrooms}bath - ${squareFootage}sqft`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('IMPORT COMPLETE');
  console.log('='.repeat(80));
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Total: ${records.length}`);
  console.log('='.repeat(80));
}

importLongviewUnits()
  .then(() => {
    console.log('\n✅ Import successful!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });
