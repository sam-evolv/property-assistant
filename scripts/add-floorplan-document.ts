import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Demo IDs
const DEMO_TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
const DEMO_PROJECT_ID = 'b0000000-0000-0000-0000-000000000001';

async function addFloorPlanDocument() {
  console.log('=== ADD FLOOR PLAN DOCUMENT ===\n');

  // 1. Find the development in Drizzle (same as Supabase project)
  console.log('1. Looking up development/project...');

  // The developments table in Drizzle corresponds to projects in Supabase
  // Check if there's a development record
  const { data: developments, error: devError } = await supabase
    .from('developments')
    .select('id, code, name, tenant_id')
    .limit(5);

  console.log('  Developments found:', developments?.length || 0);
  developments?.forEach(d => console.log('  -', d));

  // 2. Check the unit to get house_type_code
  console.log('\n2. Getting unit info...');
  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('id, unit_type_id, tenant_id, project_id')
    .eq('id', 'c0000000-0000-0000-0000-000000000001')
    .single();

  if (unitError) {
    console.log('  Unit error:', unitError.message);
  } else {
    console.log('  Unit:', unit);
  }

  // 3. Get unit_type to find the house type code
  console.log('\n3. Getting unit type...');
  if (unit?.unit_type_id) {
    const { data: unitType } = await supabase
      .from('unit_types')
      .select('id, code, name')
      .eq('id', unit.unit_type_id)
      .single();

    console.log('  Unit type:', unitType);
  }

  // 4. Check existing documents table structure
  console.log('\n4. Checking documents table...');
  const { data: existingDocs, error: docsError } = await supabase
    .from('documents')
    .select('id, title, document_type, house_type_code, development_id, file_url')
    .limit(5);

  if (docsError) {
    console.log('  Documents error:', docsError.message);
  } else {
    console.log('  Sample documents:');
    existingDocs?.forEach(d => console.log('  -', d));
  }

  // 5. Find or determine the correct development_id for Drizzle documents table
  // The documents table has development_id which should reference developments table
  console.log('\n5. Getting house types...');
  const { data: houseTypes, error: htError } = await supabase
    .from('house_types')
    .select('id, house_type_code, name, development_id')
    .limit(10);

  if (htError) {
    console.log('  House types error:', htError.message);
  } else {
    console.log('  House types found:', houseTypes?.length || 0);
    houseTypes?.forEach(ht => console.log('  -', ht));
  }

  // 6. Insert the floor plan document
  console.log('\n6. Inserting floor plan document...');

  // We need to find or create the proper development_id
  // For now, let's use the first development or create one
  let developmentId = developments?.[0]?.id;

  if (!developmentId) {
    console.log('  No development found, checking if we need to create one...');

    // Try inserting into developments table
    const { data: newDev, error: createDevError } = await supabase
      .from('developments')
      .insert({
        id: DEMO_PROJECT_ID,
        tenant_id: DEMO_TENANT_ID,
        code: 'OPENHOUSE',
        name: 'OpenHouse Park',
      })
      .select()
      .single();

    if (createDevError) {
      console.log('  Create development error:', createDevError.message);
      // Try using the project_id directly
      developmentId = DEMO_PROJECT_ID;
    } else {
      developmentId = newDev.id;
      console.log('  Created development:', newDev);
    }
  }

  // The house_type_code should match what's in unit_types or house_types
  // Based on the setup, it's likely "KEELEY" or similar
  const houseTypeCode = 'KEELEY';

  // Create the document record
  const documentId = 'f0000000-0000-0000-0000-000000000001';

  const { data: docData, error: docError } = await supabase
    .from('documents')
    .upsert({
      id: documentId,
      tenant_id: DEMO_TENANT_ID,
      development_id: developmentId,
      house_type_code: houseTypeCode,
      document_type: 'architectural_floor_plan',
      title: 'The Keeley - Floor Plan',
      file_name: 'keeley-floorplan.pdf',
      relative_path: `${DEMO_TENANT_ID}/${DEMO_PROJECT_ID}/floor-plans/keeley-floorplan.pdf`,
      file_url: `${supabaseUrl}/storage/v1/object/public/development_docs/${DEMO_TENANT_ID}/${DEMO_PROJECT_ID}/floor-plans/keeley-floorplan.pdf`,
      status: 'active',
      processing_status: 'completed',
    }, {
      onConflict: 'id'
    })
    .select()
    .single();

  if (docError) {
    console.log('  Document insert error:', docError.message);
    console.log('  Error details:', docError);
  } else {
    console.log('  ✅ Document created:', docData);
  }

  // 7. Verify the document
  console.log('\n7. Verifying floor plan document...');
  const { data: verifyDoc } = await supabase
    .from('documents')
    .select('*')
    .eq('document_type', 'architectural_floor_plan')
    .eq('house_type_code', houseTypeCode);

  console.log('  Floor plan documents:', verifyDoc?.length || 0);
  verifyDoc?.forEach(d => console.log('  -', { id: d.id, title: d.title, house_type_code: d.house_type_code, file_url: d.file_url }));
}

addFloorPlanDocument();
