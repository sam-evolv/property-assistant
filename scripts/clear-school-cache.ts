/**
 * Clear stale primary_school poi_cache entries for Árdan View scheme IDs
 * so the improved filter runs on the next live request.
 *
 * TO RUN: npx tsx scripts/clear-school-cache.ts
 */

import { createClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Árdan View scheme IDs
const SCHEME_IDS = [
  '34316432-f1e8-4297-b993-d9b5c88ee2d8',
  '84a559d1-89f1-4eb6-a48b-7ca068bcc164',
];

async function main() {
  console.log('Clearing stale primary_school cache for Árdan View...');

  const { data, error } = await supabase
    .from('poi_cache')
    .delete()
    .in('scheme_id', SCHEME_IDS)
    .like('category', 'primary_school%')
    .select();

  if (error) {
    console.error('Error clearing cache:', error.message);
    process.exit(1);
  }

  console.log(`Deleted ${data?.length ?? 0} stale cache entries.`);
  console.log('Done. The improved filter will run on the next live request.');
}

main();
