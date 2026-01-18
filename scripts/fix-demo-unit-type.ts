import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const DEMO_TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
const DEMO_PROJECT_ID = 'b0000000-0000-0000-0000-000000000001';
const DEMO_UNIT_TYPE_ID = 'd0000000-0000-0000-0000-000000000001';
const DEMO_UNIT_ID = 'c0000000-0000-0000-0000-000000000001';

async function fixDemo() {
  console.log('=== FIX DEMO UNIT TYPE AND FLOOR PLANS ===\n');

  // 1. Create or update unit_type "The Keeley"
  console.log('1. Creating/updating unit_type...');
  const { data: unitType, error: utError } = await supabase
    .from('unit_types')
    .upsert({
      id: DEMO_UNIT_TYPE_ID,
      project_id: DEMO_PROJECT_ID,
      name: 'The Keeley',
      code: 'KEELEY',
    }, { onConflict: 'id' })
    .select()
    .single();

  if (utError) {
    console.log('  Unit type error:', utError.message);
  } else {
    console.log('  ✅ Unit type:', unitType);
  }

  // 2. Update the unit to link to this unit_type
  console.log('\n2. Updating unit to link to unit_type...');
  const { error: unitError } = await supabase
    .from('units')
    .update({ unit_type_id: DEMO_UNIT_TYPE_ID })
    .eq('id', DEMO_UNIT_ID);

  if (unitError) {
    console.log('  Unit update error:', unitError.message);
  } else {
    console.log('  ✅ Unit updated');
  }

  // 3. Verify the unit now has unit_type
  const { data: unit } = await supabase
    .from('units')
    .select('id, unit_type_id, unit_types(id, name, code)')
    .eq('id', DEMO_UNIT_ID)
    .single();

  console.log('\n3. Verified unit:', unit);

  // 4. Update existing floor plan sections to have house_type_code in metadata
  console.log('\n4. Updating floor plan sections with house_type_code...');

  const { data: floorPlanSections } = await supabase
    .from('document_sections')
    .select('id, metadata')
    .eq('project_id', DEMO_PROJECT_ID);

  let updated = 0;
  for (const section of floorPlanSections || []) {
    const meta = section.metadata as any;
    const fileName = (meta?.file_name || '').toLowerCase();

    // Check if it's a floor plan
    if (fileName.includes('floor') || meta?.category === 'Floorplans') {
      // Add house_type_code to metadata
      const updatedMeta = {
        ...meta,
        house_type_code: 'The Keeley',
        doc_type: 'floorplan',
      };

      const { error: updateError } = await supabase
        .from('document_sections')
        .update({ metadata: updatedMeta })
        .eq('id', section.id);

      if (!updateError) {
        updated++;
        console.log(`  Updated: ${meta?.file_name}`);
      }
    }
  }
  console.log(`  ✅ Updated ${updated} floor plan sections`);

  // 5. Add a new floor plan section for The Keeley if none exist
  console.log('\n5. Adding Keeley floor plan section...');

  const sectionId = crypto.randomUUID();
  const fileUrl = `${supabaseUrl}/storage/v1/object/public/development_docs/${DEMO_TENANT_ID}/${DEMO_PROJECT_ID}/floor-plans/keeley-floorplan.pdf`;

  const { error: insertError } = await supabase
    .from('document_sections')
    .insert({
      id: sectionId,
      project_id: DEMO_PROJECT_ID,
      unit_type_id: DEMO_UNIT_TYPE_ID,
      content: `The Keeley - Floor Plan with room dimensions.
Ground Floor: Living Room 4.69m x 3.47m, Kitchen/Dining 5.37m x 3.26m, Utility 1.80m x 1.70m, WC 1.70m x 0.90m, Hall 1.70m x 3.95m.
First Floor: Bedroom 1 4.20m x 3.47m, Bedroom 2 3.40m x 2.90m, Bedroom 3 2.70m x 2.40m, Bathroom 2.10m x 1.80m, Landing 2.50m x 1.70m.
Total: 83.2 sq m (896 sq ft).`,
      metadata: {
        file_name: 'The Keeley - Floor Plans.pdf',
        file_url: fileUrl,
        title: 'The Keeley - Floor Plans',
        house_type_code: 'The Keeley',
        discipline: 'architectural',
        drawing_type: 'floor_plan',
        doc_type: 'floorplan',
        category: 'Floorplans',
        tags: ['floorplan', 'floor_plan', 'room_sizes', 'dimensions', 'keeley'],
      },
    });

  if (insertError) {
    console.log('  Insert error:', insertError.message);
  } else {
    console.log('  ✅ Added Keeley floor plan section');
  }

  // 6. Verify floor plans are now findable
  console.log('\n6. Verifying floor plans...');
  const { data: verifySections } = await supabase
    .from('document_sections')
    .select('id, metadata')
    .eq('project_id', DEMO_PROJECT_ID);

  const floorPlans = verifySections?.filter((s: any) => {
    const meta = s.metadata as any;
    const houseType = (meta?.house_type_code || '').toLowerCase();
    return houseType.includes('keeley');
  });

  console.log(`  Floor plans with "keeley" house_type: ${floorPlans?.length || 0}`);
  floorPlans?.forEach((fp: any) => {
    const meta = fp.metadata as any;
    console.log(`  - ${meta.file_name} (house_type: ${meta.house_type_code})`);
  });

  console.log('\n✅ Done! Try asking about room dimensions now.');
}

fixDemo();
