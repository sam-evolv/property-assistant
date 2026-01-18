import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Demo IDs
const DEMO_UNIT_ID = 'c0000000-0000-0000-0000-000000000001';
const DEMO_PROJECT_ID = 'b0000000-0000-0000-0000-000000000001';

async function debugVideos() {
  console.log('=== DEBUG VIDEOS ===\n');

  // 1. Check the unit
  console.log('1. Checking unit...');
  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('id, project_id, tenant_id')
    .eq('id', DEMO_UNIT_ID)
    .single();

  if (unitError) {
    console.log('  Unit error:', unitError.message);
  } else {
    console.log('  Unit:', unit);
  }

  // 2. Check video_resources table via Supabase
  console.log('\n2. Checking video_resources via Supabase...');
  const { data: videos, error: videoError } = await supabase
    .from('video_resources')
    .select('*')
    .eq('development_id', DEMO_PROJECT_ID);

  if (videoError) {
    console.log('  Video error:', videoError.message);
  } else {
    console.log('  Videos found:', videos?.length || 0);
    if (videos && videos.length > 0) {
      videos.forEach((v, i) => {
        console.log(`  Video ${i + 1}:`, {
          id: v.id,
          title: v.title,
          development_id: v.development_id,
          is_active: v.is_active,
          provider: v.provider,
        });
      });
    }
  }

  // 3. Check all videos in the table
  console.log('\n3. Checking ALL video_resources...');
  const { data: allVideos, error: allError } = await supabase
    .from('video_resources')
    .select('id, title, development_id, tenant_id, is_active')
    .limit(10);

  if (allError) {
    console.log('  All videos error:', allError.message);
  } else {
    console.log('  Total videos:', allVideos?.length || 0);
    allVideos?.forEach((v, i) => {
      console.log(`  ${i + 1}.`, v);
    });
  }

  // 4. Try to insert a test video
  console.log('\n4. Attempting to insert demo video...');
  const testVideoId = 'e0000000-0000-0000-0000-000000000001';

  const { data: insertData, error: insertError } = await supabase
    .from('video_resources')
    .upsert({
      id: testVideoId,
      tenant_id: 'a0000000-0000-0000-0000-000000000001',
      development_id: DEMO_PROJECT_ID,
      provider: 'youtube',
      video_url: 'https://www.youtube.com/watch?v=kKRji-bDDos',
      embed_url: 'https://www.youtube.com/embed/kKRji-bDDos',
      video_id: 'kKRji-bDDos',
      title: 'Welcome to Your New Home - Heat Pump Guide',
      description: 'A comprehensive guide to using your air-to-water heat pump system efficiently.',
      thumbnail_url: 'https://img.youtube.com/vi/kKRji-bDDos/maxresdefault.jpg',
      sort_order: 1,
      is_active: true,
    }, {
      onConflict: 'id'
    })
    .select();

  if (insertError) {
    console.log('  Insert error:', insertError.message);
    console.log('  Error details:', insertError);
  } else {
    console.log('  Insert success:', insertData);
  }

  // 5. Verify the video now exists
  console.log('\n5. Verifying video after insert...');
  const { data: verifyVideos, error: verifyError } = await supabase
    .from('video_resources')
    .select('*')
    .eq('development_id', DEMO_PROJECT_ID);

  if (verifyError) {
    console.log('  Verify error:', verifyError.message);
  } else {
    console.log('  Videos for demo project:', verifyVideos?.length || 0);
    verifyVideos?.forEach((v, i) => {
      console.log(`  ${i + 1}. ${v.title} (active: ${v.is_active})`);
    });
  }
}

debugVideos();
