import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debug() {
  console.log('=== DEBUG VIDEO MISMATCH ===\n');

  // 1. List ALL units and their project_ids
  console.log('1. All units in database:');
  const { data: units, error: unitsError } = await supabase
    .from('units')
    .select('id, address, project_id')
    .limit(20);

  if (unitsError) {
    console.log('  Error:', unitsError.message);
  } else if (!units?.length) {
    console.log('  NO UNITS FOUND!');
  } else {
    units.forEach(u => console.log(`  - ${u.id} | project: ${u.project_id} | ${u.address}`));
  }

  // 2. List ALL video_resources
  console.log('\n2. All videos in database:');
  const { data: videos, error: videosError } = await supabase
    .from('video_resources')
    .select('id, title, development_id, is_active')
    .limit(20);

  if (videosError) {
    console.log('  Error:', videosError.message);
  } else if (!videos?.length) {
    console.log('  NO VIDEOS FOUND!');
  } else {
    videos.forEach(v => console.log(`  - ${v.title} | development_id: ${v.development_id} | active: ${v.is_active}`));
  }

  // 3. MISMATCH ANALYSIS
  console.log('\n3. MISMATCH ANALYSIS:');
  if (units?.length && videos?.length) {
    const unitProjectIds = new Set(units.map(u => u.project_id));
    const videoDevIds = new Set(videos.map(v => v.development_id));

    console.log('  Unit project_ids:', [...unitProjectIds]);
    console.log('  Video development_ids:', [...videoDevIds]);

    const matching = [...unitProjectIds].filter(id => videoDevIds.has(id));
    if (matching.length === 0) {
      console.log('\n  ❌ NO MATCH! Videos have development_id that does not match any unit project_id');
      
      if (units.length > 0) {
        const correctProjectId = units[0].project_id;
        console.log(`\n  FIX: Update videos to use development_id = '${correctProjectId}'`);
      }
    } else {
      console.log('\n  ✅ Match found:', matching);
    }
  }
}

debug();
