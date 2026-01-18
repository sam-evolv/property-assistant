/**
 * COMPLETE DEMO SETUP - OpenHouse Park Demo
 *
 * This script sets up ALL demo content:
 * 1. Noticeboard posts (14 total)
 * 2. YouTube video for the videos tab
 * 3. Ensures coordinates are set for maps
 *
 * Run from the project root with environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL=https://mddxbilpjukwskeefakz.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<your-key>
 *
 * Command:
 *   npx tsx scripts/setup-demo-complete.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing environment variables!');
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Demo IDs - these are the fixed IDs for the OpenHouse Park demo
const DEMO_TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
const DEMO_DEVELOPMENT_ID = 'b0000000-0000-0000-0000-000000000001';
const DEMO_UNIT_ID = 'c0000000-0000-0000-0000-000000000001';

// ============================================================================
// VERIFY DEMO DATA EXISTS
// ============================================================================

async function verifyDemoExists() {
  console.log('🔍 Verifying demo account exists...');

  const { data: unit, error } = await supabase
    .from('units')
    .select('id, tenant_id, development_id, purchaser_name, address')
    .eq('id', DEMO_UNIT_ID)
    .single();

  if (error || !unit) {
    // Try to find by address
    const { data: unitByAddress } = await supabase
      .from('units')
      .select('id, tenant_id, development_id, purchaser_name, address')
      .ilike('address', '%OpenHouse Way%')
      .limit(1);

    if (!unitByAddress || unitByAddress.length === 0) {
      console.error('❌ Demo account not found!');
      console.error('   Looking for unit with address containing "OpenHouse Way"');
      return null;
    }

    const foundUnit = unitByAddress[0];
    console.log(`✅ Found demo unit: ${foundUnit.purchaser_name} at ${foundUnit.address}`);
    return {
      tenantId: foundUnit.tenant_id,
      developmentId: foundUnit.development_id,
      unitId: foundUnit.id,
    };
  }

  console.log(`✅ Found demo unit: ${unit.purchaser_name} at ${unit.address}`);
  return {
    tenantId: unit.tenant_id,
    developmentId: unit.development_id,
    unitId: unit.id,
  };
}

// ============================================================================
// ADD NOTICEBOARD POSTS
// ============================================================================

async function addNoticeboardPosts(tenantId: string, developmentId: string) {
  console.log('\n📋 Adding noticeboard posts...');

  const posts = [
    // Management posts
    {
      title: 'Welcome to OpenHouse Park! 🏠',
      content: `We're delighted to welcome all residents to OpenHouse Park!

This is your community noticeboard where you can connect with neighbours, share updates, and stay informed about estate matters.

A few reminders:
• Management office hours: Mon-Fri 9am-5pm
• Emergency contact: 087 123 4567
• Bin collection: Wednesday mornings

Looking forward to building a wonderful community together!`,
      author_name: 'OpenHouse Park Management',
      priority: 2,
    },
    {
      title: 'Playground Now Open! 🎠',
      content: `Great news! The children's playground is now officially open.

The playground includes:
- Climbing frame
- Swings (toddler and regular)
- Slide
- Sandpit area

Please supervise children at all times and report any maintenance issues to management.`,
      author_name: 'OpenHouse Park Management',
      priority: 1,
    },
    {
      title: 'Bin Collection Schedule Update',
      content: `Just a reminder of the bin collection schedule:

🟢 Green Bin (General): Every Wednesday
🔵 Blue Bin (Recycling): Every Wednesday
🟤 Brown Bin (Organic): Fortnightly (next: 22nd Jan)

Please ensure bins are out by 7am. Any issues, contact Cork City Council.`,
      author_name: 'OpenHouse Park Management',
      priority: 1,
    },
    {
      title: 'Garden Maintenance Day 🌱',
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
      title: 'Electricity Outage Notice ⚡',
      content: `Just received notice from ESB:

**Planned outage:** Tuesday 28th January, 9am - 4pm

This affects all of OpenHouse Park. Please plan accordingly - charge devices, prepare for no heating during this time.

ESB advise this is for network upgrades.`,
      author_name: 'OpenHouse Park Management',
      priority: 2,
    },
    // Resident posts
    {
      title: 'Looking for Running Buddies 🏃‍♀️',
      content: `Hi everyone! I'm training for the Cork City Marathon and looking for running partners. I usually run early mornings (6-7am) around the estate and nearby areas.

All paces welcome - would be great to have some company!

Drop a comment if you're interested.`,
      author_name: 'Sarah (No. 3)',
      priority: 0,
    },
    {
      title: 'Book Club Starting! 📚',
      content: `Anyone interested in a neighbourhood book club?

Thinking we could meet once a month, rotate between houses or use the community room.

First book suggestion: "Normal People" by Sally Rooney - nice Irish connection!

Comment if interested!`,
      author_name: 'Emma (No. 5)',
      priority: 0,
    },
    {
      title: 'Lost Cat - Please Help! 🐱',
      content: `Our ginger cat "Marmalade" went missing yesterday evening. He's friendly, neutered, and has a blue collar.

Last seen near the green area at the back of the estate.

If you spot him, please message me or bring him to No. 7. Reward offered!`,
      author_name: 'The Murphy Family (No. 7)',
      priority: 0,
    },
    {
      title: 'GAA Training for Kids ⚽',
      content: `Hi neighbours! I'm a qualified GAA coach and thinking of organising free training sessions for kids in the estate during the summer.

Would be Sunday mornings 10am-11am on the green area.
Ages 5-12 welcome - focus on fun and basic skills!

Would there be interest? Reply below or drop a note to No. 12!`,
      author_name: 'Colm O\'Sullivan (No. 12)',
      priority: 0,
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
      title: 'Free Piano - Collection Only 🎹',
      content: `We have an upright piano that needs a new home. It's an older model but still in tune and plays beautifully.

Free to whoever can collect it! You'll need 2-3 people and a van.

First come, first served - message me at No. 8.`,
      author_name: 'Maria (No. 8)',
      priority: 0,
    },
    {
      title: 'Neighbourhood Watch Meeting',
      content: `Our first Neighbourhood Watch meeting is scheduled for:

📅 Thursday 30th January
🕖 7:30pm
📍 Community Room (beside the playground)

Agenda:
1. Introduction & elect coordinator
2. Crime prevention tips from local Gardaí
3. WhatsApp group setup
4. Any other business

Tea/coffee provided. All residents welcome!`,
      author_name: 'Pádraig (No. 2)',
      priority: 1,
    },
    {
      title: 'Spotted: Hedgehog Family! 🦔',
      content: `Great news for nature lovers - spotted a hedgehog family near the back hedge last night around 9pm!

Please be mindful if you're gardening in that area. Let's help our prickly friends thrive!

If anyone has tips on making the estate more hedgehog-friendly, please share.`,
      author_name: 'Ciara (No. 16)',
      priority: 0,
    },
    {
      title: 'Heat Pump Tip - Winter Settings',
      content: `Fellow residents, quick tip for the cold weather:

Your air-to-water heat pump works best when set to a CONSTANT lower temperature (19-20°C) rather than turning it up and down.

The "weather compensation" feature adjusts automatically. Setting it to 25°C doesn't heat faster - it just wastes electricity!

Check your manual or ask me at No. 6 if you need help with settings.`,
      author_name: 'Brendan (No. 6) - Heating Engineer',
      priority: 1,
    },
  ];

  // First, clear existing posts for this development (optional - comment out if you want to keep existing)
  // await supabase.from('noticeboard_posts').delete().eq('development_id', developmentId);

  let added = 0;
  let skipped = 0;

  for (const post of posts) {
    // Check if exists
    const { data: existing } = await supabase
      .from('noticeboard_posts')
      .select('id')
      .eq('development_id', developmentId)
      .eq('title', post.title)
      .limit(1);

    if (existing && existing.length > 0) {
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from('noticeboard_posts')
      .insert({
        tenant_id: tenantId,
        development_id: developmentId,
        title: post.title,
        content: post.content,
        author_name: post.author_name,
        priority: post.priority,
        active: true,
      });

    if (error) {
      console.log(`   ⚠️ ${post.title.substring(0, 30)}...: ${error.message}`);
    } else {
      added++;
    }
  }

  console.log(`   ✅ Added ${added} posts, ${skipped} already existed`);
}

// ============================================================================
// ADD VIDEO RESOURCE
// ============================================================================

async function addVideoResource(tenantId: string, developmentId: string) {
  console.log('\n🎬 Adding YouTube video...');

  const videoId = 'kKRji-bDDos';

  // Check if video already exists
  const { data: existing, error: checkError } = await supabase
    .from('video_resources')
    .select('id')
    .eq('development_id', developmentId)
    .eq('video_id', videoId)
    .limit(1);

  if (checkError) {
    console.log(`   ⚠️ Could not check video_resources: ${checkError.message}`);
    console.log('   ℹ️ The video_resources table might be in Drizzle DB, not Supabase');
    return;
  }

  if (existing && existing.length > 0) {
    console.log('   ℹ️ Video already exists');
    return;
  }

  const { error } = await supabase
    .from('video_resources')
    .insert({
      tenant_id: tenantId,
      development_id: developmentId,
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

  if (error) {
    console.log(`   ⚠️ Could not add video: ${error.message}`);
  } else {
    console.log('   ✅ Video added successfully');
  }
}

// ============================================================================
// ENSURE MAP COORDINATES
// ============================================================================

async function ensureMapCoordinates(developmentId: string) {
  console.log('\n🗺️ Ensuring map coordinates...');

  // Cork coordinates
  const { error } = await supabase
    .from('developments')
    .update({
      latitude: 51.8969,
      longitude: -8.4863,
    })
    .eq('id', developmentId);

  if (error) {
    console.log(`   ⚠️ Could not update coordinates: ${error.message}`);
  } else {
    console.log('   ✅ Coordinates set for Cork');
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  COMPLETE DEMO SETUP - OpenHouse Park');
  console.log('═══════════════════════════════════════════════════════════════');

  const demoData = await verifyDemoExists();

  if (!demoData) {
    process.exit(1);
  }

  console.log(`\n📍 Using IDs:`);
  console.log(`   Tenant: ${demoData.tenantId}`);
  console.log(`   Development: ${demoData.developmentId}`);
  console.log(`   Unit: ${demoData.unitId}`);

  await addNoticeboardPosts(demoData.tenantId, demoData.developmentId);
  await addVideoResource(demoData.tenantId, demoData.developmentId);
  await ensureMapCoordinates(demoData.developmentId);

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ✅ DEMO SETUP COMPLETE!');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to Vercel (not just GOOGLE_MAPS_API_KEY)');
  console.log('  2. Redeploy to pick up the new env variable');
  console.log('  3. Upload floor plan PDFs via admin portal for document attachments');
  console.log('');
}

main().catch(console.error);
