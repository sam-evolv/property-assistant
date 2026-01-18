/**
 * ENHANCE EXISTING DEMO - Keeley O'Grady / OpenHouse Park
 *
 * This script ADDS demo content to the EXISTING Keeley O'Grady account.
 * It does NOT create new tenants/developments - it enhances what's already there.
 *
 * Prerequisites:
 * - Keeley O'Grady account must already exist
 * - Development "OpenHouse Park" must already exist
 *
 * This script will:
 * 1. Find the existing tenant, development, and unit by searching for Keeley O'Grady
 * 2. Add room dimensions for house type A3
 * 3. Add community noticeboard posts
 * 4. Add FAQs for the chat
 * 5. Ensure latitude/longitude are set for maps
 *
 * TO RUN: npx tsx scripts/enhance-demo-keeley.ts
 */

import { createClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
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
  tenantName: string;
  developmentId: string;
  developmentName: string;
  unitId: string;
  unitNumber: string;
  houseTypeCode: string;
  houseTypeId?: string;
}

async function findExistingData(): Promise<ExistingData | null> {
  console.log('🔍 Searching for Keeley O\'Grady account...');

  // Find unit by purchaser name
  const { data: units, error: unitError } = await supabase
    .from('units')
    .select(`
      id,
      tenant_id,
      development_id,
      unit_number,
      house_type_code,
      house_type_id,
      purchaser_name,
      address
    `)
    .ilike('purchaser_name', '%Keeley%O%Grady%')
    .limit(1);

  if (unitError || !units || units.length === 0) {
    // Try searching by address
    const { data: unitsByAddress } = await supabase
      .from('units')
      .select('*')
      .ilike('address', '%OpenHouse Way%')
      .limit(1);

    if (!unitsByAddress || unitsByAddress.length === 0) {
      console.error('❌ Could not find Keeley O\'Grady unit');
      return null;
    }

    const unit = unitsByAddress[0];

    // Get tenant and development info
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', unit.tenant_id)
      .single();

    const { data: development } = await supabase
      .from('developments')
      .select('id, name')
      .eq('id', unit.development_id)
      .single();

    return {
      tenantId: unit.tenant_id,
      tenantName: tenant?.name || 'Unknown',
      developmentId: unit.development_id,
      developmentName: development?.name || 'Unknown',
      unitId: unit.id,
      unitNumber: unit.unit_number,
      houseTypeCode: unit.house_type_code || 'A3',
      houseTypeId: unit.house_type_id,
    };
  }

  const unit = units[0];

  // Get tenant and development info
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('id', unit.tenant_id)
    .single();

  const { data: development } = await supabase
    .from('developments')
    .select('id, name')
    .eq('id', unit.development_id)
    .single();

  return {
    tenantId: unit.tenant_id,
    tenantName: tenant?.name || 'Unknown',
    developmentId: unit.development_id,
    developmentName: development?.name || 'Unknown',
    unitId: unit.id,
    unitNumber: unit.unit_number,
    houseTypeCode: unit.house_type_code || 'A3',
    houseTypeId: unit.house_type_id,
  };
}

// ============================================================================
// ADD ROOM DIMENSIONS
// ============================================================================

async function addRoomDimensions(data: ExistingData) {
  console.log('📐 Adding room dimensions for house type', data.houseTypeCode, '...');

  // Room dimensions for A3 (3 bedroom house based on screenshot)
  const rooms = [
    { room_key: 'living_room', room_name: 'Living Room', length_m: 4.5, width_m: 3.8, area_sqm: 17.1 },
    { room_key: 'kitchen_dining', room_name: 'Kitchen/Dining', length_m: 5.2, width_m: 3.5, area_sqm: 18.2 },
    { room_key: 'utility', room_name: 'Utility', length_m: 1.8, width_m: 2.0, area_sqm: 3.6 },
    { room_key: 'wc_downstairs', room_name: 'WC Downstairs', length_m: 1.2, width_m: 1.5, area_sqm: 1.8 },
    { room_key: 'hall', room_name: 'Hall', length_m: 4.0, width_m: 1.2, area_sqm: 4.8 },
    { room_key: 'bedroom_1', room_name: 'Bedroom 1 (Master)', length_m: 3.8, width_m: 3.5, area_sqm: 13.3 },
    { room_key: 'bedroom_2', room_name: 'Bedroom 2', length_m: 3.2, width_m: 3.0, area_sqm: 9.6 },
    { room_key: 'bedroom_3', room_name: 'Bedroom 3', length_m: 2.8, width_m: 2.5, area_sqm: 7.0 },
    { room_key: 'bathroom', room_name: 'Bathroom', length_m: 2.2, width_m: 1.8, area_sqm: 4.0 },
    { room_key: 'ensuite', room_name: 'En-suite', length_m: 1.5, width_m: 2.0, area_sqm: 3.0 },
    { room_key: 'landing', room_name: 'Landing', length_m: 3.0, width_m: 1.5, area_sqm: 4.5 },
    { room_key: 'hotpress', room_name: 'Hot Press', length_m: 0.8, width_m: 0.6, area_sqm: 0.48 },
  ];

  let added = 0;
  let skipped = 0;

  for (const room of rooms) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('unit_room_dimensions')
      .select('id')
      .eq('tenant_id', data.tenantId)
      .eq('development_id', data.developmentId)
      .eq('room_key', room.room_key)
      .limit(1);

    if (existing && existing.length > 0) {
      // Update existing
      await supabase
        .from('unit_room_dimensions')
        .update({
          room_name: room.room_name,
          length_m: room.length_m,
          width_m: room.width_m,
          area_sqm: room.area_sqm,
          verified: true,
          source: 'demo_enhancement',
        })
        .eq('id', existing[0].id);
      skipped++;
      continue;
    }

    // Insert new
    const { error } = await supabase
      .from('unit_room_dimensions')
      .insert({
        tenant_id: data.tenantId,
        development_id: data.developmentId,
        house_type_id: data.houseTypeId || null,
        unit_id: null, // House type level, not unit specific
        room_key: room.room_key,
        room_name: room.room_name,
        length_m: room.length_m,
        width_m: room.width_m,
        area_sqm: room.area_sqm,
        verified: true,
        source: 'demo_enhancement',
      });

    if (error) {
      console.log(`  ⚠️  ${room.room_name}: ${error.message}`);
    } else {
      added++;
    }
  }

  console.log(`  ✅ Added ${added} rooms, updated ${skipped} existing`);
}

// ============================================================================
// ADD NOTICEBOARD POSTS
// ============================================================================

async function addNoticeboardPosts(data: ExistingData) {
  console.log('📋 Adding community noticeboard posts...');

  const posts = [
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
      category: 'announcement',
      is_pinned: true,
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
      category: 'announcement',
      is_pinned: false,
    },
    {
      title: 'Looking for Running Buddies 🏃‍♀️',
      content: `Hi everyone! I'm training for the Cork City Marathon and looking for running partners. I usually run early mornings (6-7am) around the estate and nearby areas.

All paces welcome - would be great to have some company!

Drop a comment if you're interested.`,
      author_name: 'Sarah (No. 3)',
      category: 'social',
      is_pinned: false,
    },
    {
      title: 'Bin Collection Schedule Update',
      content: `Just a reminder of the bin collection schedule:

🟢 Green Bin (General): Every Wednesday
🔵 Blue Bin (Recycling): Every Wednesday
🟤 Brown Bin (Organic): Fortnightly (next: 22nd Jan)

Please ensure bins are out by 7am. Any issues, contact Cork City Council.`,
      author_name: 'OpenHouse Park Management',
      category: 'maintenance',
      is_pinned: false,
    },
    {
      title: 'Book Club Starting! 📚',
      content: `Anyone interested in a neighbourhood book club?

Thinking we could meet once a month, rotate between houses or use the community room.

First book suggestion: "Normal People" by Sally Rooney - nice Irish connection!

Comment if interested!`,
      author_name: 'Emma (No. 5)',
      category: 'social',
      is_pinned: false,
    },
    {
      title: 'Lost Cat - Please Help! 🐱',
      content: `Our ginger cat "Marmalade" went missing yesterday evening. He's friendly, neutered, and has a blue collar.

Last seen near the green area at the back of the estate.

If you spot him, please message me or bring him to No. 7. Reward offered!`,
      author_name: 'The Murphy Family (No. 7)',
      category: 'lost_found',
      is_pinned: false,
    },
  ];

  // Check how many posts already exist
  const { data: existingPosts } = await supabase
    .from('noticeboard_posts')
    .select('id')
    .eq('development_id', data.developmentId);

  if (existingPosts && existingPosts.length >= 3) {
    console.log(`  ℹ️  Already have ${existingPosts.length} posts, skipping...`);
    return;
  }

  let added = 0;
  for (const post of posts) {
    const { error } = await supabase
      .from('noticeboard_posts')
      .insert({
        tenant_id: data.tenantId,
        development_id: data.developmentId,
        title: post.title,
        content: post.content,
        author_name: post.author_name,
        category: post.category,
        is_pinned: post.is_pinned,
        status: 'approved',
      });

    if (error) {
      console.log(`  ⚠️  "${post.title.substring(0, 30)}...": ${error.message}`);
    } else {
      added++;
    }
  }

  console.log(`  ✅ Added ${added} noticeboard posts`);
}

// ============================================================================
// ADD FAQs
// ============================================================================

async function addFAQs(data: ExistingData) {
  console.log('❓ Adding FAQs for chat...');

  const faqs = [
    {
      question: 'When is bin collection day?',
      answer: 'Bin collection is every Wednesday morning. Please have your bins out by 7am. Green bin (general waste) is weekly, blue bin (recycling) is weekly, and brown bin (garden/food waste) is fortnightly.',
    },
    {
      question: 'What is the BER rating of my home?',
      answer: 'All homes at OpenHouse Park have a BER rating of A2, meaning they are highly energy efficient with excellent insulation, triple-glazed windows, and an air-to-water heat pump system.',
    },
    {
      question: 'How do I contact the management company?',
      answer: 'You can contact OpenHouse Park Management by email at info@openhousepark.ie or by phone at 021 234 5678. Office hours are Monday to Friday, 9am to 5pm.',
    },
    {
      question: 'Is there parking available?',
      answer: 'Yes, each home has allocated parking spaces. 3-bedroom homes have 2 spaces, 4-bedroom homes have 2-3 spaces. There is also visitor parking available near the entrance.',
    },
    {
      question: 'What heating system is installed?',
      answer: 'Your home has an air-to-water heat pump heating system, which is highly efficient and provides both heating and hot water. It can be controlled via the hallway thermostat or the manufacturer\'s smartphone app.',
    },
    {
      question: 'Are pets allowed?',
      answer: 'Yes, pets are welcome at OpenHouse Park. Dogs must be kept on a lead in communal areas, and owners must clean up after their pets. Please be considerate of neighbours regarding noise.',
    },
    {
      question: 'Where is the nearest shop?',
      answer: 'The nearest convenience store is the Centra on Douglas Road, about 5 minutes walk. For larger shopping, Douglas Village Shopping Centre is 10 minutes by car with Tesco, Dunnes, and other stores.',
    },
    {
      question: 'What warranties cover my new home?',
      answer: 'Your home is covered by: HomeBond structural warranty (10 years), boiler warranty (5 years), windows warranty (10 years), and appliance warranties (2 years). All documentation is in your homeowner pack.',
    },
  ];

  // Check if FAQs already exist
  const { data: existingFaqs } = await supabase
    .from('faq_entries')
    .select('id')
    .eq('development_id', data.developmentId);

  if (existingFaqs && existingFaqs.length >= 5) {
    console.log(`  ℹ️  Already have ${existingFaqs.length} FAQs, skipping...`);
    return;
  }

  let added = 0;
  for (const faq of faqs) {
    const { error } = await supabase
      .from('faq_entries')
      .insert({
        tenant_id: data.tenantId,
        development_id: data.developmentId,
        question: faq.question,
        answer: faq.answer,
        is_active: true,
      });

    if (error) {
      console.log(`  ⚠️  "${faq.question.substring(0, 30)}...": ${error.message}`);
    } else {
      added++;
    }
  }

  console.log(`  ✅ Added ${added} FAQs`);
}

// ============================================================================
// ENSURE MAPS WORK (Set lat/long)
// ============================================================================

async function ensureMapsWork(data: ExistingData) {
  console.log('🗺️  Ensuring maps configuration...');

  // Update development with Cork coordinates if not set
  const { error } = await supabase
    .from('developments')
    .update({
      latitude: '51.8969',
      longitude: '-8.4863',
      // Cork city center coordinates
    })
    .eq('id', data.developmentId)
    .is('latitude', null); // Only update if not already set

  if (error) {
    console.log(`  ⚠️  Could not update coordinates: ${error.message}`);
  } else {
    console.log('  ✅ Map coordinates configured for Cork');
  }
}

// ============================================================================
// UPDATE SYSTEM INSTRUCTIONS
// ============================================================================

async function updateSystemInstructions(data: ExistingData) {
  console.log('🤖 Updating AI system instructions...');

  const systemInstructions = `You are a friendly AI assistant for OpenHouse Park, a residential development in Cork, Ireland.

Key facts about OpenHouse Park:
- Located in Cork City, Ireland
- Mix of 3 and 4 bedroom family homes
- BER Rating: A2 for all homes
- Developer: OpenHouse Developments
- Management: OpenHouse Park Management CLG

Nearby amenities:
- Douglas Village Shopping Centre (10 min drive)
- Cork University Hospital (15 min drive)
- Cork City Centre (10 min drive)
- Cork Airport (20 min drive)

Community features:
- Landscaped communal green areas
- Children's playground
- Visitor parking
- High-speed fibre broadband

Always be helpful, friendly, and accurate. For precise room measurements, direct users to their floor plan documents.`;

  const { error } = await supabase
    .from('developments')
    .update({ system_instructions: systemInstructions })
    .eq('id', data.developmentId);

  if (error) {
    console.log(`  ⚠️  Could not update system instructions: ${error.message}`);
  } else {
    console.log('  ✅ System instructions updated');
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ENHANCE DEMO - Keeley O\'Grady / OpenHouse Park');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // Step 1: Find existing data
  const existingData = await findExistingData();

  if (!existingData) {
    console.error('');
    console.error('❌ Could not find existing Keeley O\'Grady account.');
    console.error('   Please ensure the account exists in Supabase first.');
    process.exit(1);
  }

  console.log('');
  console.log('📍 Found existing data:');
  console.log(`   Tenant: ${existingData.tenantName} (${existingData.tenantId})`);
  console.log(`   Development: ${existingData.developmentName} (${existingData.developmentId})`);
  console.log(`   Unit: ${existingData.unitNumber} (${existingData.unitId})`);
  console.log(`   House Type: ${existingData.houseTypeCode}`);
  console.log('');

  // Step 2: Enhance with demo content
  try {
    await addRoomDimensions(existingData);
    await addNoticeboardPosts(existingData);
    await addFAQs(existingData);
    await ensureMapsWork(existingData);
    await updateSystemInstructions(existingData);

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  ✅ DEMO ENHANCEMENT COMPLETE!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('The Keeley O\'Grady demo account now has:');
    console.log('  ✅ Room dimensions for all rooms');
    console.log('  ✅ Community noticeboard posts');
    console.log('  ✅ FAQs for the chat');
    console.log('  ✅ Map coordinates for Cork');
    console.log('  ✅ Updated AI system instructions');
    console.log('');
    console.log('📝 Still needed (manual steps):');
    console.log('  1. Upload sample documents via the admin portal');
    console.log('  2. Update the logo (see separate instructions)');
    console.log('');
  } catch (error) {
    console.error('');
    console.error('❌ Enhancement failed:', error);
    process.exit(1);
  }
}

main();
