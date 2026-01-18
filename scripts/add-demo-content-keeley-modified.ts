/**
 * ADD DEMO CONTENT - Keeley O'Grady / OpenHouse Park (Modified Version)
 * Uses Supabase client instead of Drizzle for database operations
 */

import { createClient } from '@supabase/supabase-js';

// Check environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================================================
// FIND EXISTING DATA
// ============================================================================

interface ExistingData {
  tenantId: string;
  developmentId: string;
  unitId: string;
}

async function findExistingData(): Promise<ExistingData | null> {
  console.log('Searching for Keeley O\'Grady account...');

  // Find unit by purchaser name or address
  const { data: units } = await supabase
    .from('units')
    .select('id, tenant_id, development_id, project_id')
    .or('purchaser_name.ilike.%Keeley%O%Grady%,address.ilike.%OpenHouse Way%')
    .limit(1);

  if (!units || units.length === 0) {
    console.error('Could not find Keeley O\'Grady unit');
    return null;
  }

  const unit = units[0];

  return {
    tenantId: unit.tenant_id,
    developmentId: unit.development_id || unit.project_id,
    unitId: unit.id,
  };
}

// ============================================================================
// ADD NOTICEBOARD POSTS
// ============================================================================

async function addNoticeboardPosts(data: ExistingData) {
  console.log('Adding additional community noticeboard posts...');

  const newPosts = [
    {
      title: 'GAA Training for Kids',
      content: `Hi neighbours! I'm a qualified GAA coach and thinking of organising free training sessions for kids in the estate during the summer.

Would be Sunday mornings 10am-11am on the green area.
Ages 5-12 welcome - focus on fun and basic skills!

Would there be interest? Reply below or drop a note to No. 12!`,
      author_name: 'Colm O\'Sullivan (No. 12)',
      priority: 0,
    },
    {
      title: 'Garden Maintenance Day',
      content: `The management company has confirmed the communal garden maintenance day is Saturday 25th January.

Please move any items from the communal areas by Friday evening to allow the team full access.

Areas to be maintained:
- Front entrance landscaping
- Communal green area
- Hedge trimming along boundary
- Playground surroundings

Thank you for your cooperation!`,
      author_name: 'OpenHouse Park Management',
      priority: 1,
    },
    {
      title: 'Babysitter Recommendation Needed',
      content: `Hi all, we're looking for a reliable babysitter for occasional evenings. Our kids are 4 and 7.

Does anyone have recommendations for someone local they've used and trusted?

Thanks in advance!`,
      author_name: 'The Walsh Family (No. 14)',
      priority: 0,
    },
    {
      title: 'Electricity Outage Notice',
      content: `Just received notice from ESB:

**Planned outage:** Tuesday 28th January, 9am - 4pm

This affects all of OpenHouse Park. Please plan accordingly - charge devices, prepare for no heating during this time.

ESB advise this is for network upgrades.`,
      author_name: 'OpenHouse Park Management',
      priority: 2,
    },
    {
      title: 'Free Piano - Collection Only',
      content: `We have an upright piano that needs a new home. It's an older model but still in tune and plays beautifully.

Free to whoever can collect it! You'll need 2-3 people and a van.

First come, first served - message me at No. 8.`,
      author_name: 'Maria (No. 8)',
      priority: 0,
    },
    {
      title: 'Neighbourhood Watch Meeting',
      content: `Our first Neighbourhood Watch meeting is scheduled for:

Thursday 30th January
7:30pm
Community Room (beside the playground)

Agenda:
1. Introduction & elect coordinator
2. Crime prevention tips from local Gardai
3. WhatsApp group setup
4. Any other business

Tea/coffee provided. All residents welcome!`,
      author_name: 'Padraig (No. 2)',
      priority: 1,
    },
    {
      title: 'Spotted: Hedgehog Family!',
      content: `Great news for nature lovers - spotted a hedgehog family near the back hedge last night around 9pm!

Please be mindful if you're gardening in that area. Let's help our prickly friends thrive!

If anyone has tips on making the estate more hedgehog-friendly, please share.`,
      author_name: 'Ciara (No. 16)',
      priority: 0,
    },
    {
      title: 'Heat Pump Tip - Winter Settings',
      content: `Fellow residents, quick tip for the cold weather:

Your air-to-water heat pump works best when set to a CONSTANT lower temperature (19-20 degrees C) rather than turning it up and down.

The "weather compensation" feature adjusts automatically. Setting it to 25 degrees C doesn't heat faster - it just wastes electricity!

Check your manual or ask me at No. 6 if you need help with settings.`,
      author_name: 'Brendan (No. 6) - Heating Engineer',
      priority: 1,
    },
  ];

  let added = 0;
  for (const post of newPosts) {
    // Check if post with same title exists
    const { data: existing } = await supabase
      .from('noticeboard_posts')
      .select('id')
      .eq('development_id', data.developmentId)
      .eq('title', post.title)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`  "${post.title.substring(0, 30)}..." already exists`);
      continue;
    }

    const { error } = await supabase
      .from('noticeboard_posts')
      .insert({
        tenant_id: data.tenantId,
        development_id: data.developmentId,
        title: post.title,
        content: post.content,
        author_name: post.author_name,
        priority: post.priority,
        active: true,
      });

    if (error) {
      console.log(`  "${post.title.substring(0, 30)}...": ${error.message}`);
    } else {
      added++;
    }
  }

  console.log(`  Added ${added} new noticeboard posts`);
}

// ============================================================================
// ADD YOUTUBE VIDEO
// ============================================================================

async function addYouTubeVideo(data: ExistingData) {
  console.log('Adding demo YouTube video...');

  // YouTube video: https://www.youtube.com/watch?v=kKRji-bDDos
  const videoId = 'kKRji-bDDos';

  // Try using Supabase to insert into video_resources table
  // First check if the table exists and if video already exists
  const { data: existing, error: checkError } = await supabase
    .from('video_resources')
    .select('id')
    .eq('development_id', data.developmentId)
    .eq('video_id', videoId)
    .limit(1);

  if (checkError) {
    // Table might not exist in Supabase, or different structure
    console.log(`  Could not check video_resources table: ${checkError.message}`);
    console.log(`  The video_resources table may need to be populated via different method.`);
    console.log(`  Video details to add manually:`);
    console.log(`    - Provider: youtube`);
    console.log(`    - Video ID: ${videoId}`);
    console.log(`    - URL: https://www.youtube.com/watch?v=${videoId}`);
    console.log(`    - Title: Welcome to Your New Home - Heat Pump Guide`);
    return;
  }

  if (existing && existing.length > 0) {
    console.log('  Video already exists, skipping...');
    return;
  }

  // Generate a UUID-like string
  const newId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });

  const { error: insertError } = await supabase
    .from('video_resources')
    .insert({
      id: newId,
      tenant_id: data.tenantId,
      development_id: data.developmentId,
      provider: 'youtube',
      video_url: `https://www.youtube.com/watch?v=${videoId}`,
      embed_url: `https://www.youtube.com/embed/${videoId}`,
      video_id: videoId,
      title: 'Welcome to Your New Home - Heat Pump Guide',
      description: 'A comprehensive guide to using your air-to-water heat pump system efficiently. Learn about optimal settings, maintenance tips, and how to get the most from your heating system.',
      thumbnail_url: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      sort_order: 1,
      is_active: true,
    });

  if (insertError) {
    console.log(`  Could not add video: ${insertError.message}`);
  } else {
    console.log('  Added YouTube video successfully');
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('');
  console.log('===================================================================');
  console.log('  ADD DEMO CONTENT - Keeley O\'Grady / OpenHouse Park');
  console.log('===================================================================');
  console.log('');

  // Step 1: Find existing data
  const existingData = await findExistingData();

  if (!existingData) {
    console.error('');
    console.error('Could not find existing Keeley O\'Grady account.');
    console.error('Please run enhance-demo-keeley.ts first.');
    process.exit(1);
  }

  console.log('');
  console.log('Found existing data:');
  console.log(`   Development ID: ${existingData.developmentId}`);
  console.log(`   Tenant ID: ${existingData.tenantId}`);
  console.log(`   Unit ID: ${existingData.unitId}`);
  console.log('');

  // Step 2: Add content
  try {
    await addNoticeboardPosts(existingData);
    await addYouTubeVideo(existingData);

    console.log('');
    console.log('===================================================================');
    console.log('  DEMO CONTENT ADDED SUCCESSFULLY!');
    console.log('===================================================================');
    console.log('');
    console.log('Summary:');
    console.log('  - Additional noticeboard posts added');
    console.log('  - YouTube video configured (if table accessible)');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in Vercel for maps');
    console.log('  2. Set FEATURE_VIDEOS_PURCHASER=true in Vercel for videos');
    console.log('  3. Redeploy to apply environment variable changes');
    console.log('');
  } catch (error) {
    console.error('');
    console.error('Failed to add demo content:', error);
    process.exit(1);
  }
}

main();
