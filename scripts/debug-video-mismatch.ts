import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
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

  // 3. List ALL projects
  console.log('\n3. All projects in database:');
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, name')
    .limit(20);

  if (projectsError) {
    console.log('  Error:', projectsError.message);
  } else if (!projects?.length) {
    console.log('  NO PROJECTS FOUND!');
  } else {
    projects.forEach(p => console.log(`  - ${p.id} | ${p.name}`));
  }

  // 4. Check if there's a mismatch
  console.log('\n4. MISMATCH ANALYSIS:');
  if (units?.length && videos?.length) {
    const unitProjectIds = new Set(units.map(u => u.project_id));
    const videoDevIds = new Set(videos.map(v => v.development_id));

    console.log('  Unit project_ids:', [...unitProjectIds]);
    console.log('  Video development_ids:', [...videoDevIds]);

    const matching = [...unitProjectIds].filter(id => videoDevIds.has(id));
    if (matching.length === 0) {
      console.log('\n  ❌ NO MATCH! Videos have development_id that doesn\'t match any unit\'s project_id');
      console.log('  This is why videos don\'t show!');

      // Suggest fix
      if (units.length > 0) {
        const correctProjectId = units[0].project_id;
        console.log(`\n  FIX: Update videos to use development_id = '${correctProjectId}'`);
      }
    } else {
      console.log('\n  ✅ Match found:', matching);
    }
  }

  console.log('\n=== DONE ===');
}

debug();
