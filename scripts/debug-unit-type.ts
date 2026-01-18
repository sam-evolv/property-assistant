import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debug() {
  console.log('=== DEBUG UNIT TYPE ===\n');

  // 1. Get unit type
  const { data: unitType } = await supabase
    .from('unit_types')
    .select('*')
    .eq('id', 'd0000000-0000-0000-0000-000000000001')
    .single();

  console.log('1. Unit type d000...001:', unitType);

  // 2. Get all unit_types for the demo project
  const { data: allUnitTypes } = await supabase
    .from('unit_types')
    .select('*')
    .eq('project_id', 'b0000000-0000-0000-0000-000000000001');

  console.log('\n2. All unit types for demo project:', allUnitTypes);

  // 3. Check the unit
  const { data: unit } = await supabase
    .from('units')
    .select('*, unit_types(id, name, code)')
    .eq('id', 'c0000000-0000-0000-0000-000000000001')
    .single();

  console.log('\n3. Unit with unit_type:', unit);

  // 4. Check a sample document_section metadata
  const { data: sections } = await supabase
    .from('document_sections')
    .select('id, metadata')
    .eq('project_id', 'b0000000-0000-0000-0000-000000000001')
    .limit(3);

  console.log('\n4. Sample document_sections metadata:');
  sections?.forEach((s, i) => {
    console.log(`  ${i + 1}.`, JSON.stringify(s.metadata, null, 2).substring(0, 500));
  });

  // 5. Check how other working portals store floor plans
  // Get a sample from Longview or Rathard
  const { data: workingSections } = await supabase
    .from('document_sections')
    .select('id, project_id, metadata')
    .neq('project_id', 'b0000000-0000-0000-0000-000000000001')
    .limit(5);

  console.log('\n5. Sample sections from other projects:');
  workingSections?.forEach((s, i) => {
    const meta = s.metadata as any;
    console.log(`  ${i + 1}. project: ${s.project_id}, file: ${meta?.file_name}, house_type: ${meta?.house_type_code}`);
  });
}

debug();
