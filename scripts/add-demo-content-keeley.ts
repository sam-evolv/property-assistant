/**
 * ADD DEMO CONTENT - Keeley O'Grady / OpenHouse Park
 *
 * This script adds additional demo content for promotional videos:
 * 1. More noticeboard posts from residents
 * 2. A demo YouTube video
 * 3. Sample documents
 *
 * Prerequisites:
 * - Keeley O'Grady account must already exist
 * - Initial enhance-demo-keeley.ts should have been run
 *
 * TO RUN: npx tsx scripts/add-demo-content-keeley.ts
 */

import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { v4 as uuidv4 } from 'uuid';

// Check environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Database URL for Drizzle
const DATABASE_URL = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ Missing DATABASE_URL or SUPABASE_DB_URL');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Drizzle client for video_resources
const queryClient = postgres(DATABASE_URL);
const db = drizzle(queryClient);

// ============================================================================
// FIND EXISTING DATA
// ============================================================================

interface ExistingData {
  tenantId: string;
  developmentId: string;
  developmentDrizzleId?: string;
  unitId: string;
}

async function findExistingData(): Promise<ExistingData | null> {
  console.log('🔍 Searching for Keeley O\'Grady account...');

  // Find unit by purchaser name or address
  const { data: units } = await supabase
    .from('units')
    .select('id, tenant_id, development_id, project_id')
    .or('purchaser_name.ilike.%Keeley%O%Grady%,address.ilike.%OpenHouse Way%')
    .limit(1);

  if (!units || units.length === 0) {
    console.error('❌ Could not find Keeley O\'Grady unit');
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
  console.log('📋 Adding additional community noticeboard posts...');

  // New posts to add (in addition to the 6 from the first script)
  const newPosts = [
    {
      title: 'GAA Training for Kids ⚽🏑',
      content: `Hi neighbours! I'm a qualified GAA coach and thinking of organising free training sessions for kids in the estate during the summer.

Would be Sunday mornings 10am-11am on the green area.
Ages 5-12 welcome - focus on fun and basic skills!

Would there be interest? Reply below or drop a note to No. 12!`,
      author_name: 'Colm O\'Sullivan (No. 12)',
      priority: 0,
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
      title: 'Babysitter Recommendation Needed',
      content: `Hi all, we're looking for a reliable babysitter for occasional evenings. Our kids are 4 and 7.

Does anyone have recommendations for someone local they've used and trusted?

Thanks in advance!`,
      author_name: 'The Walsh Family (No. 14)',
      priority: 0,
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
      console.log(`  ℹ️  "${post.title.substring(0, 30)}..." already exists`);
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
      console.log(`  ⚠️  "${post.title.substring(0, 30)}...": ${error.message}`);
    } else {
      added++;
    }
  }

  console.log(`  ✅ Added ${added} new noticeboard posts`);
}

// ============================================================================
// ADD YOUTUBE VIDEO
// ============================================================================

async function addYouTubeVideo(data: ExistingData) {
  console.log('🎬 Adding demo YouTube video...');

  // YouTube video: https://www.youtube.com/watch?v=kKRji-bDDos
  const videoId = 'kKRji-bDDos';

  // Check if video already exists
  const checkResult = await db.execute(`
    SELECT id FROM video_resources
    WHERE development_id = '${data.developmentId}'
    AND video_id = '${videoId}'
    LIMIT 1
  `);

  if (checkResult.length > 0) {
    console.log('  ℹ️  Video already exists, skipping...');
    return;
  }

  // We need to get the Drizzle tenant ID (which might be different from Supabase tenant)
  // For the demo, we'll use the development_id which is the project_id from Supabase

  // Get tenant from tenants table by looking up the development
  const tenantResult = await db.execute(`
    SELECT t.id as tenant_id FROM tenants t
    INNER JOIN developments d ON d.tenant_id = t.id
    WHERE d.id = '${data.developmentId}'
    LIMIT 1
  `);

  let drizzleTenantId: string;

  if (tenantResult.length > 0) {
    drizzleTenantId = (tenantResult[0] as any).tenant_id;
  } else {
    // If no Drizzle tenant found, use the Supabase tenant_id
    drizzleTenantId = data.tenantId;
  }

  try {
    const newId = uuidv4();
    await db.execute(`
      INSERT INTO video_resources (
        id,
        tenant_id,
        development_id,
        provider,
        video_url,
        embed_url,
        video_id,
        title,
        description,
        thumbnail_url,
        sort_order,
        is_active
      ) VALUES (
        '${newId}',
        '${drizzleTenantId}',
        '${data.developmentId}',
        'youtube',
        'https://www.youtube.com/watch?v=${videoId}',
        'https://www.youtube.com/embed/${videoId}',
        '${videoId}',
        'Welcome to Your New Home - Heat Pump Guide',
        'A comprehensive guide to using your air-to-water heat pump system efficiently. Learn about optimal settings, maintenance tips, and how to get the most from your heating system.',
        'https://img.youtube.com/vi/${videoId}/maxresdefault.jpg',
        1,
        true
      )
    `);
    console.log('  ✅ Added YouTube video successfully');
  } catch (error: any) {
    console.log(`  ⚠️  Could not add video: ${error.message}`);
  }
}

// ============================================================================
// ADD SAMPLE DOCUMENTS
// ============================================================================

async function addSampleDocuments(data: ExistingData) {
  console.log('📄 Adding sample documents...');

  // Note: Documents require actual file uploads to Supabase storage
  // For the demo, we'll add document metadata records that point to placeholder URLs
  // In production, you'd upload actual PDF files first

  const sampleDocs = [
    {
      title: 'Heat Pump User Manual',
      document_type: 'manual',
      doc_kind: 'appliance_manual',
      discipline: 'MECH',
      is_important: true,
      category: 'Handover',
    },
    {
      title: 'Floor Plan - Type A3',
      document_type: 'drawing',
      doc_kind: 'floor_plan',
      discipline: 'ARCH',
      is_important: true,
      category: 'Floorplans',
    },
    {
      title: 'Fire Safety Certificate',
      document_type: 'certificate',
      doc_kind: 'fire_cert',
      discipline: 'FIRE',
      must_read: true,
      is_important: true,
      category: 'Fire Safety',
    },
    {
      title: 'HomeBond Warranty Certificate',
      document_type: 'certificate',
      doc_kind: 'warranty',
      discipline: 'LEGAL',
      is_important: true,
      category: 'Warranties',
    },
    {
      title: 'Parking Map & Allocation',
      document_type: 'document',
      doc_kind: 'parking',
      discipline: 'SITE',
      is_important: false,
      category: 'Parking',
    },
    {
      title: 'BER Certificate - A2 Rated',
      document_type: 'certificate',
      doc_kind: 'ber_cert',
      discipline: 'MECH',
      is_important: true,
      category: 'General',
    },
    {
      title: 'Snagging Checklist Template',
      document_type: 'form',
      doc_kind: 'snag_list',
      discipline: 'SITE',
      is_important: false,
      category: 'Snagging',
    },
    {
      title: 'Kitchen Appliance Guide',
      document_type: 'manual',
      doc_kind: 'appliance_manual',
      discipline: 'ELEC',
      is_important: false,
      category: 'Specifications',
    },
  ];

  // For demo purposes, we'll try to insert into Supabase documents table if it exists
  // The documents table in Drizzle schema is different from Supabase

  console.log('  ℹ️  Documents require file uploads to storage.');
  console.log('  ℹ️  For the demo, use the admin portal to upload actual PDF files.');
  console.log(`  ℹ️  Suggested documents for upload:`);

  for (const doc of sampleDocs) {
    console.log(`      - ${doc.title} (${doc.category})`);
  }
}

// ============================================================================
// ENSURE VIDEOS FEATURE IS ENABLED
// ============================================================================

async function checkVideosFeature() {
  console.log('🔧 Checking videos feature flag...');

  const envVar = process.env.FEATURE_VIDEOS_PURCHASER || process.env.FEATURE_VIDEOS;

  if (envVar === 'true') {
    console.log('  ✅ Videos feature is enabled');
  } else {
    console.log('  ⚠️  Videos feature may not be enabled in Vercel!');
    console.log('  ℹ️  Add FEATURE_VIDEOS_PURCHASER=true to Vercel environment variables');
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ADD DEMO CONTENT - Keeley O\'Grady / OpenHouse Park');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // Step 1: Find existing data
  const existingData = await findExistingData();

  if (!existingData) {
    console.error('');
    console.error('❌ Could not find existing Keeley O\'Grady account.');
    console.error('   Please run enhance-demo-keeley.ts first.');
    process.exit(1);
  }

  console.log('');
  console.log('📍 Found existing data:');
  console.log(`   Development ID: ${existingData.developmentId}`);
  console.log(`   Tenant ID: ${existingData.tenantId}`);
  console.log(`   Unit ID: ${existingData.unitId}`);
  console.log('');

  // Step 2: Add content
  try {
    await addNoticeboardPosts(existingData);
    await checkVideosFeature();
    await addYouTubeVideo(existingData);
    await addSampleDocuments(existingData);

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  ✅ DEMO CONTENT ADDED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('Summary:');
    console.log('  ✅ Additional noticeboard posts added');
    console.log('  ✅ YouTube video configured');
    console.log('  ℹ️  Documents need manual upload via admin portal');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in Vercel for maps');
    console.log('  2. Set FEATURE_VIDEOS_PURCHASER=true in Vercel for videos');
    console.log('  3. Upload PDF documents via admin portal');
    console.log('  4. Redeploy to apply environment variable changes');
    console.log('');
  } catch (error) {
    console.error('');
    console.error('❌ Failed to add demo content:', error);
    process.exit(1);
  } finally {
    await queryClient.end();
  }
}

main();
