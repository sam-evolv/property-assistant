import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const DEMO_PROJECT_ID = 'b0000000-0000-0000-0000-000000000001';
const DEMO_UNIT_TYPE_ID = 'd0000000-0000-0000-0000-000000000001';
const DEMO_UNIT_ID = 'c0000000-0000-0000-0000-000000000001';

async function fix() {
  console.log('=== FIX UNIT TYPE ===\n');

  // 1. Check unit_types table structure
  console.log('1. Checking unit_types structure...');
  const { data: sample } = await supabase
    .from('unit_types')
    .select('*')
    .limit(1)
    .single();

  if (sample) {
    console.log('  Columns:', Object.keys(sample));
    console.log('  Sample:', sample);
  } else {
    console.log('  No existing unit_types found');
  }

  // 2. Create unit_type with only valid columns
  console.log('\n2. Creating unit_type "The Keeley"...');
  const { data: unitType, error: utError } = await supabase
    .from('unit_types')
    .upsert({
      id: DEMO_UNIT_TYPE_ID,
      project_id: DEMO_PROJECT_ID,
      name: 'The Keeley',
    }, { onConflict: 'id' })
    .select()
    .single();

  if (utError) {
    console.log('  Error:', utError.message);

    // Try insert if upsert fails
    const { data: inserted, error: insertErr } = await supabase
      .from('unit_types')
      .insert({
        id: DEMO_UNIT_TYPE_ID,
        project_id: DEMO_PROJECT_ID,
        name: 'The Keeley',
      })
      .select()
      .single();

    if (insertErr) {
      console.log('  Insert also failed:', insertErr.message);
    } else {
      console.log('  ✅ Inserted:', inserted);
    }
  } else {
    console.log('  ✅ Created:', unitType);
  }

  // 3. Update unit to use this unit_type
  console.log('\n3. Linking unit to unit_type...');
  const { error: linkError } = await supabase
    .from('units')
    .update({ unit_type_id: DEMO_UNIT_TYPE_ID })
    .eq('id', DEMO_UNIT_ID);

  if (linkError) {
    console.log('  Error:', linkError.message);
  } else {
    console.log('  ✅ Unit linked');
  }

  // 4. Verify
  console.log('\n4. Verifying setup...');
  const { data: unit } = await supabase
    .from('units')
    .select('id, unit_type_id, unit_types(id, name)')
    .eq('id', DEMO_UNIT_ID)
    .single();

  console.log('  Unit:', unit);

  const unitTypes = unit?.unit_types;
  const houseName = Array.isArray(unitTypes) ? unitTypes[0]?.name : unitTypes?.name;
  console.log('  House type name:', houseName);

  console.log('\n✅ Done! The unit should now resolve to "The Keeley" house type.');
}

fix();
