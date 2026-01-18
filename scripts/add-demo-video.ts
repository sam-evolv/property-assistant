import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const DEMO_TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
const DEMO_PROJECT_ID = 'b0000000-0000-0000-0000-000000000001';

async function addVideo() {
  console.log('=== ADD DEMO VIDEO ===\n');

  // 1. Check video_resources table structure
  console.log('1. Checking video_resources structure...');
  const { data: sample, error: sampleError } = await supabase
    .from('video_resources')
    .select('*')
    .limit(1)
    .single();

  if (sampleError) {
    console.log('  Error or no videos:', sampleError.message);
  } else if (sample) {
    console.log('  Columns:', Object.keys(sample));
  }

  // 2. Insert demo video
  console.log('\n2. Inserting demo video...');
  const videoId = 'e0000000-0000-0000-0000-000000000001';

  const { data: inserted, error: insertError } = await supabase
    .from('video_resources')
    .upsert({
      id: videoId,
      tenant_id: DEMO_TENANT_ID,
      development_id: DEMO_PROJECT_ID,
      provider: 'youtube',
      video_url: 'https://www.youtube.com/watch?v=kKRji-bDDos',
      embed_url: 'https://www.youtube.com/embed/kKRji-bDDos',
      video_id: 'kKRji-bDDos',
      title: 'Welcome to Your New Home - Heat Pump Guide',
      description: 'A comprehensive guide to using your air-to-water heat pump system efficiently. Learn about optimal settings, maintenance tips, and how to get the most from your heating system.',
      thumbnail_url: 'https://img.youtube.com/vi/kKRji-bDDos/maxresdefault.jpg',
      sort_order: 1,
      is_active: true,
    }, { onConflict: 'id' })
    .select()
    .single();

  if (insertError) {
    console.log('  Insert error:', insertError.message);
  } else {
    console.log('  ✅ Video inserted:', inserted?.title);
  }

  // 3. Verify video exists for the demo project
  console.log('\n3. Verifying videos for demo project...');
  const { data: videos, error: verifyError } = await supabase
    .from('video_resources')
    .select('id, title, development_id, is_active')
    .eq('development_id', DEMO_PROJECT_ID);

  if (verifyError) {
    console.log('  Verify error:', verifyError.message);
  } else {
    console.log('  Videos found:', videos?.length || 0);
    videos?.forEach(v => console.log(`  - ${v.title} (active: ${v.is_active})`));
  }

  console.log('\n✅ Done!');
}

addVideo();
