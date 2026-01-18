/**
 * DEBUG - Check what tenant_id the demo unit actually maps to
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function debug() {
  const unitId = 'c0000000-0000-0000-0000-000000000001';

  // Get unit
  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('*')
    .eq('id', unitId)
    .single();

  console.log('Unit:', unit);
  console.log('Unit Error:', unitError);

  if (unit?.project_id) {
    // Get project
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', unit.project_id)
      .single();

    console.log('\nProject:', project);

    // Check noticeboard posts for this tenant
    if (project?.tenant_id) {
      const { data: posts, error: postsError } = await supabase
        .from('noticeboard_posts')
        .select('id, title, tenant_id, development_id, active')
        .eq('tenant_id', project.tenant_id)
        .limit(5);

      console.log('\nNoticeboard posts for tenant', project.tenant_id, ':');
      console.log(posts);
      console.log('Posts Error:', postsError);
    }

    // Also check with the demo tenant ID we used
    const demoTenantId = 'a0000000-0000-0000-0000-000000000001';
    const { data: demoPosts, error: demoPostsError } = await supabase
      .from('noticeboard_posts')
      .select('id, title, tenant_id, development_id, active')
      .eq('tenant_id', demoTenantId)
      .limit(5);

    console.log('\nNoticeboard posts for DEMO tenant', demoTenantId, ':');
    console.log(demoPosts);
    console.log('Demo Posts Error:', demoPostsError);
  }

  // Check video_resources
  const { data: videos } = await supabase
    .from('video_resources')
    .select('*')
    .limit(5);

  console.log('\nVideo resources:');
  console.log(videos);
}

debug().catch(console.error);
