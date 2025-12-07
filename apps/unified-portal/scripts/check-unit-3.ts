import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkUnit3() {
  console.log('='.repeat(60));
  console.log('PHASE 1: DATABASE TRUTH VERIFICATION');
  console.log('='.repeat(60));
  console.log('');

  const { data: units, error } = await supabase
    .from('units')
    .select(`
      id,
      address,
      purchaser_name,
      unit_types (
        name,
        specification_json
      )
    `)
    .ilike('address', '3 Longview%');

  if (error) {
    console.error('Database query failed:', error.message);
    process.exit(1);
  }

  if (!units || units.length === 0) {
    console.log('No units found matching "3 Longview%"');
    console.log('Trying broader search...');
    
    const { data: allUnits } = await supabase
      .from('units')
      .select('id, address, purchaser_name')
      .limit(10);
    
    console.log('\nSample units in database:');
    allUnits?.forEach(u => console.log(`  - ${u.address} (${u.purchaser_name})`));
    process.exit(1);
  }

  console.log(`Found ${units.length} unit(s) matching "3 Longview%":\n`);

  for (const unit of units) {
    console.log('---');
    console.log(`Address: ${unit.address}`);
    console.log(`Owner: ${unit.purchaser_name}`);
    
    const unitType = Array.isArray(unit.unit_types) ? unit.unit_types[0] : unit.unit_types;
    
    if (unitType) {
      console.log(`House Type: ${unitType.name}`);
      console.log(`Specification JSON:`, JSON.stringify(unitType.specification_json, null, 2));
      
      const specs = unitType.specification_json || {};
      const bathrooms = specs.bathrooms || specs.Bathrooms;
      const bedrooms = specs.bedrooms || specs.Bedrooms;
      
      console.log(`\nExtracted Values:`);
      console.log(`  Bedrooms: ${bedrooms}`);
      console.log(`  Bathrooms: ${bathrooms}`);
      
      if (bathrooms === 3 || bathrooms === '3') {
        console.log('\n✅ DATABASE HAS CORRECT DATA: 3 Bathrooms confirmed!');
        console.log('Proceed to Phase 2: Force Feed the Chat API');
      } else {
        console.log(`\n⚠️ Bathroom count is ${bathrooms}, not 3`);
      }
    } else {
      console.log('⚠️ No unit_types linked to this unit');
    }
  }
  
  console.log('\n' + '='.repeat(60));
}

checkUnit3().catch(console.error);
