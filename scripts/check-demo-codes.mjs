import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  console.log('=== CHECK DEMO ACCESS CODES ===\n');

  // Check for OH-PARK codes
  console.log('1. Looking for OH-PARK codes:');
  const { data: ohPark, error: ohErr } = await supabase
    .from('units')
    .select('id, unit_uid, unit_code, address')
    .or('unit_uid.ilike.%OH-PARK%,unit_code.ilike.%OH-PARK%')
    .limit(10);

  if (ohErr) {
    console.log('  Error:', ohErr.message);
  } else if (!ohPark?.length) {
    console.log('  NO OH-PARK codes found!');
  } else {
    ohPark.forEach(u => console.log(`  - ${u.unit_uid || u.unit_code} | ${u.address}`));
  }

  // Check for OpenHouse development
  console.log('\n2. Looking for OpenHouse development:');
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .ilike('name', '%openhouse%');

  if (!projects?.length) {
    console.log('  NO OpenHouse project found!');
  } else {
    projects.forEach(p => console.log(`  - ${p.id} | ${p.name}`));

    // Check units for this project
    if (projects[0]) {
      console.log('\n3. Units in OpenHouse project:');
      const { data: units } = await supabase
        .from('units')
        .select('id, unit_uid, unit_code, address')
        .eq('project_id', projects[0].id)
        .limit(10);

      if (!units?.length) {
        console.log('  NO units found for OpenHouse project!');
      } else {
        units.forEach(u => console.log(`  - ${u.unit_uid || u.unit_code || u.id} | ${u.address}`));
      }
    }
  }

  // Also check what columns exist
  console.log('\n4. Sample unit to see available columns:');
  const { data: sample } = await supabase
    .from('units')
    .select('*')
    .limit(1)
    .single();

  if (sample) {
    console.log('  Columns:', Object.keys(sample).join(', '));
  }
}

check();
