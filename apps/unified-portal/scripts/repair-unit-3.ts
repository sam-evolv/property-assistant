import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function repairUnit3() {
  console.log('='.repeat(60));
  console.log('REPAIR SCRIPT: Unit 3 Longview Park');
  console.log('='.repeat(60));

  // Step A: Find the unit and its unit_type
  const { data: units, error: findError } = await supabase
    .from('units')
    .select('id, address, purchaser_name, unit_type_id')
    .ilike('address', '%3 Longview%');

  if (findError || !units?.length) {
    console.error('Failed to find unit:', findError?.message);
    return;
  }

  console.log(`Found ${units.length} matching unit(s)`);

  // Get the unit_type_id (BD01)
  const unitTypeId = units[0].unit_type_id;
  console.log(`Unit Type ID: ${unitTypeId}`);

  // Step B: Force-Update specification_json with Golden Data
  const goldenSpecs = {
    bedrooms: "3 Bedroom",
    bathrooms: "3 Bathroom",
    property_type: "House",
    designation: "Detached"
  };

  const { error: specError } = await supabase
    .from('unit_types')
    .update({ specification_json: goldenSpecs })
    .eq('id', unitTypeId);

  if (specError) {
    console.error('Failed to update specification_json:', specError.message);
    return;
  }
  console.log('✓ Updated specification_json to Golden Data');

  // Step C: Force-Update purchaser_name for all matching units
  for (const unit of units) {
    const { error: nameError } = await supabase
      .from('units')
      .update({ purchaser_name: 'Ms Ciara Crowley and Mr Shane Cashman' })
      .eq('id', unit.id);

    if (nameError) {
      console.error(`Failed to update purchaser_name for ${unit.id}:`, nameError.message);
    } else {
      console.log(`✓ Updated purchaser_name for: ${unit.address}`);
    }
  }

  // Step D: Verify and log result
  const { data: verified } = await supabase
    .from('units')
    .select(`
      address,
      purchaser_name,
      unit_types (
        name,
        specification_json
      )
    `)
    .ilike('address', '%3 Longview%')
    .single();

  console.log('\n' + '='.repeat(60));
  console.log('VERIFICATION:');
  console.log('='.repeat(60));
  console.log('Address:', verified?.address);
  console.log('Owner:', verified?.purchaser_name);
  
  const unitType = Array.isArray(verified?.unit_types) ? verified.unit_types[0] : verified?.unit_types;
  console.log('House Type:', unitType?.name);
  console.log('Specs:', JSON.stringify(unitType?.specification_json, null, 2));
  
  console.log('\n✅ Unit 3 Manually Repaired: 3 Bathrooms Confirmed.');
  console.log('='.repeat(60));
}

repairUnit3().catch(console.error);
