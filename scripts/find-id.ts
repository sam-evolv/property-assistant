import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function find() {
  // Find the project with the most units
  const { data: units } = await supabase.from('units').select('project_id');

  // Count them
  const counts = {};
  units?.forEach(u => { counts[u.project_id] = (counts[u.project_id] || 0) + 1; });

  console.log("\n🔎 PROJECT CENSUS:");
  console.table(counts);
}
find();