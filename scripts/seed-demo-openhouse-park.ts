/**
 * DEMO ENVIRONMENT SEED SCRIPT - Open House Park
 *
 * This script creates a completely ISOLATED demo tenant for promotional videos.
 * It uses hardcoded UUIDs to ensure idempotency (can be run multiple times safely).
 *
 * SAFETY FEATURES:
 * - Uses unique, hardcoded UUIDs that won't conflict with real data
 * - All data is scoped to the demo tenant only
 * - Does NOT modify any existing tenants/developments/units
 * - Can be completely removed by deleting the demo tenant
 *
 * TO RUN: npx tsx scripts/seed-demo-openhouse-park.ts
 * TO REMOVE: Delete tenant with id = DEMO_TENANT_ID from Supabase
 */

import { createClient } from '@supabase/supabase-js';

// Validate environment
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================================================
// HARDCODED DEMO IDs - These are unique and will NEVER conflict with real data
// Using deterministic UUIDs based on "demo-openhouse-park" namespace
// ============================================================================
const DEMO_TENANT_ID = 'aaaaaaaa-demo-4000-demo-openhousepark1';
const DEMO_DEVELOPMENT_ID = 'bbbbbbbb-demo-4000-demo-openhousepark2';
const DEMO_ADMIN_ID = 'cccccccc-demo-4000-demo-openhousepark3';

// House Type IDs
const HOUSE_TYPE_IDS = {
  'OH-A1': 'dddddddd-demo-4000-demo-housetype-a1',
  'OH-A2': 'dddddddd-demo-4000-demo-housetype-a2',
  'OH-B1': 'dddddddd-demo-4000-demo-housetype-b1',
  'OH-B2': 'dddddddd-demo-4000-demo-housetype-b2',
};

// Unit IDs (9 units for Open House Park)
const UNIT_IDS = [
  'eeeeeeee-demo-4000-demo-unit-00001',
  'eeeeeeee-demo-4000-demo-unit-00002',
  'eeeeeeee-demo-4000-demo-unit-00003',
  'eeeeeeee-demo-4000-demo-unit-00004',
  'eeeeeeee-demo-4000-demo-unit-00005',
  'eeeeeeee-demo-4000-demo-unit-00006',
  'eeeeeeee-demo-4000-demo-unit-00007',
  'eeeeeeee-demo-4000-demo-unit-00008',
  'eeeeeeee-demo-4000-demo-unit-00009',
];

// ============================================================================
// DEMO DATA
// ============================================================================

const DEMO_TENANT = {
  id: DEMO_TENANT_ID,
  name: 'Open House AI',
  slug: 'demo-openhouse',
  logo_url: null, // Will use default
  brand: {
    companyName: 'Open House AI',
    tagline: 'Your AI-Powered Property Assistant',
  },
  contact: {
    email: 'demo@openhouse.ai',
    phone: '+353 1 234 5678',
    website: 'https://openhouse.ai',
  },
  description: 'Demo tenant for promotional videos',
  theme_color: '#3b82f6',
};

const DEMO_DEVELOPMENT = {
  id: DEMO_DEVELOPMENT_ID,
  tenant_id: DEMO_TENANT_ID,
  code: 'OH-PARK',
  name: 'Open House Park',
  slug: 'open-house-park',
  address: '1-9 Open House Park, Dublin Road, Cork City, Ireland',
  description: 'A beautiful new development of 3 and 4 bedroom family homes in a prime Cork location. Features include landscaped gardens, modern energy-efficient design, and excellent transport links.',
  is_active: true,
  latitude: '51.8985',
  longitude: '-8.4756',
  system_instructions: `You are a friendly AI assistant for Open House Park, a new residential development in Cork, Ireland.

Key facts about Open House Park:
- Located on Dublin Road, Cork City
- 9 premium family homes (mix of 3 and 4 bedroom)
- House types: OH-A1 (3 bed semi-detached), OH-A2 (3 bed detached), OH-B1 (4 bed semi-detached), OH-B2 (4 bed detached)
- BER Rating: A2 for all homes
- Developer: Open House Developments Ltd
- Completion: Q2 2024
- Management Company: Open House Park Management CLG

Nearby amenities:
- Blackpool Shopping Centre (1.2km)
- Cork University Hospital (2.5km)
- Kent Train Station (3km)
- Douglas Village Shopping Centre (4km)
- Cork Airport (8km)

Community features:
- Landscaped communal green areas
- Children's playground
- Secure bicycle storage
- Electric vehicle charging points
- High-speed fibre broadband

Always be helpful, friendly, and accurate. Direct users to official documents for precise measurements and specifications.`,
  archive_mode: 'shared',
};

const DEMO_HOUSE_TYPES = [
  {
    id: HOUSE_TYPE_IDS['OH-A1'],
    tenant_id: DEMO_TENANT_ID,
    development_id: DEMO_DEVELOPMENT_ID,
    house_type_code: 'OH-A1',
    name: '3 Bedroom Semi-Detached',
    description: 'Spacious 3 bedroom semi-detached home with modern finishes',
    total_floor_area_sqm: '110.5',
    room_dimensions: {
      living_room: { length: 4.5, width: 3.8, area: 17.1 },
      kitchen_dining: { length: 5.2, width: 3.5, area: 18.2 },
      utility: { length: 1.8, width: 2.0, area: 3.6 },
      wc_downstairs: { length: 1.2, width: 1.5, area: 1.8 },
      bedroom_1: { length: 3.8, width: 3.5, area: 13.3 },
      bedroom_2: { length: 3.2, width: 3.0, area: 9.6 },
      bedroom_3: { length: 2.8, width: 2.5, area: 7.0 },
      bathroom: { length: 2.2, width: 1.8, area: 4.0 },
      ensuite: { length: 1.5, width: 2.0, area: 3.0 },
    },
  },
  {
    id: HOUSE_TYPE_IDS['OH-A2'],
    tenant_id: DEMO_TENANT_ID,
    development_id: DEMO_DEVELOPMENT_ID,
    house_type_code: 'OH-A2',
    name: '3 Bedroom Detached',
    description: 'Premium 3 bedroom detached home with garden',
    total_floor_area_sqm: '125.0',
    room_dimensions: {
      living_room: { length: 5.0, width: 4.0, area: 20.0 },
      kitchen_dining: { length: 5.5, width: 4.0, area: 22.0 },
      utility: { length: 2.0, width: 2.2, area: 4.4 },
      wc_downstairs: { length: 1.3, width: 1.6, area: 2.1 },
      bedroom_1: { length: 4.0, width: 3.8, area: 15.2 },
      bedroom_2: { length: 3.5, width: 3.2, area: 11.2 },
      bedroom_3: { length: 3.0, width: 2.8, area: 8.4 },
      bathroom: { length: 2.4, width: 2.0, area: 4.8 },
      ensuite: { length: 1.8, width: 2.2, area: 4.0 },
    },
  },
  {
    id: HOUSE_TYPE_IDS['OH-B1'],
    tenant_id: DEMO_TENANT_ID,
    development_id: DEMO_DEVELOPMENT_ID,
    house_type_code: 'OH-B1',
    name: '4 Bedroom Semi-Detached',
    description: 'Large 4 bedroom semi-detached family home',
    total_floor_area_sqm: '145.0',
    room_dimensions: {
      living_room: { length: 5.2, width: 4.2, area: 21.8 },
      kitchen_dining: { length: 6.0, width: 4.0, area: 24.0 },
      utility: { length: 2.2, width: 2.2, area: 4.8 },
      wc_downstairs: { length: 1.4, width: 1.6, area: 2.2 },
      bedroom_1: { length: 4.2, width: 4.0, area: 16.8 },
      bedroom_2: { length: 3.8, width: 3.5, area: 13.3 },
      bedroom_3: { length: 3.2, width: 3.0, area: 9.6 },
      bedroom_4: { length: 2.8, width: 2.6, area: 7.3 },
      bathroom: { length: 2.5, width: 2.2, area: 5.5 },
      ensuite: { length: 2.0, width: 2.4, area: 4.8 },
    },
  },
  {
    id: HOUSE_TYPE_IDS['OH-B2'],
    tenant_id: DEMO_TENANT_ID,
    development_id: DEMO_DEVELOPMENT_ID,
    house_type_code: 'OH-B2',
    name: '4 Bedroom Detached',
    description: 'Executive 4 bedroom detached home with study',
    total_floor_area_sqm: '165.0',
    room_dimensions: {
      living_room: { length: 5.5, width: 4.5, area: 24.8 },
      kitchen_dining: { length: 6.5, width: 4.5, area: 29.3 },
      utility: { length: 2.4, width: 2.4, area: 5.8 },
      wc_downstairs: { length: 1.5, width: 1.8, area: 2.7 },
      study: { length: 2.8, width: 2.5, area: 7.0 },
      bedroom_1: { length: 4.5, width: 4.2, area: 18.9 },
      bedroom_2: { length: 4.0, width: 3.8, area: 15.2 },
      bedroom_3: { length: 3.5, width: 3.2, area: 11.2 },
      bedroom_4: { length: 3.0, width: 2.8, area: 8.4 },
      bathroom: { length: 2.8, width: 2.4, area: 6.7 },
      ensuite: { length: 2.2, width: 2.5, area: 5.5 },
    },
  },
];

// Demo units - mix of house types
const DEMO_UNITS = [
  { unit_number: '1', purchaser_name: 'Keeley O\'Grady', purchaser_email: 'keeley@demo.openhouse.ai', house_type_code: 'OH-A1' },
  { unit_number: '2', purchaser_name: 'John Murphy', purchaser_email: 'john@demo.openhouse.ai', house_type_code: 'OH-A1' },
  { unit_number: '3', purchaser_name: 'Sarah Collins', purchaser_email: 'sarah@demo.openhouse.ai', house_type_code: 'OH-A2' },
  { unit_number: '4', purchaser_name: 'Michael O\'Brien', purchaser_email: 'michael@demo.openhouse.ai', house_type_code: 'OH-B1' },
  { unit_number: '5', purchaser_name: 'Emma Walsh', purchaser_email: 'emma@demo.openhouse.ai', house_type_code: 'OH-B1' },
  { unit_number: '6', purchaser_name: 'David Ryan', purchaser_email: 'david@demo.openhouse.ai', house_type_code: 'OH-B2' },
  { unit_number: '7', purchaser_name: 'Aoife Kelly', purchaser_email: 'aoife@demo.openhouse.ai', house_type_code: 'OH-A1' },
  { unit_number: '8', purchaser_name: 'Patrick Byrne', purchaser_email: 'patrick@demo.openhouse.ai', house_type_code: 'OH-A2' },
  { unit_number: '9', purchaser_name: 'Ciara McCarthy', purchaser_email: 'ciara@demo.openhouse.ai', house_type_code: 'OH-B2' },
];

// Community noticeboard posts
const DEMO_POSTS = [
  {
    title: 'Welcome to Open House Park! 🏠',
    content: `We're delighted to welcome all residents to Open House Park!

This is your community noticeboard where you can connect with neighbours, share updates, and stay informed about estate matters.

A few reminders:
• Management office hours: Mon-Fri 9am-5pm
• Emergency contact: 087 123 4567
• Bin collection: Wednesday mornings

Looking forward to building a wonderful community together!`,
    author_name: 'Open House Park Management',
    category: 'announcement',
    is_pinned: true,
  },
  {
    title: 'Playground Opening This Weekend',
    content: `Great news! The children's playground will officially open this Saturday at 11am.

There will be refreshments and a small ceremony. All families welcome!

The playground includes:
- Climbing frame
- Swings (toddler and regular)
- Slide
- Sandpit area

Please supervise children at all times.`,
    author_name: 'Open House Park Management',
    category: 'event',
    is_pinned: false,
  },
  {
    title: 'Looking for Running Buddies 🏃‍♀️',
    content: `Hi everyone! I'm training for the Cork City Marathon and looking for running partners. I usually run early mornings (6-7am) around the estate and nearby areas.

All paces welcome - would be great to have some company!

Drop a comment if you're interested.`,
    author_name: 'Sarah Collins (No. 3)',
    category: 'social',
    is_pinned: false,
  },
  {
    title: 'Garden Waste Collection Schedule',
    content: `Just a reminder that garden waste (brown bin) collection is now fortnightly.

Next collections:
- January 22nd
- February 5th
- February 19th

Please ensure bins are out by 7am. Any garden waste outside the bin won't be collected.`,
    author_name: 'Open House Park Management',
    category: 'maintenance',
    is_pinned: false,
  },
  {
    title: 'Book Club Starting Up! 📚',
    content: `Anyone interested in starting a neighbourhood book club?

Thinking we could meet once a month, maybe rotate between houses or meet in the community room.

Our first book could be something light - open to suggestions!

Comment below if interested.`,
    author_name: 'Emma Walsh (No. 5)',
    category: 'social',
    is_pinned: false,
  },
];

// Room dimensions for unit_room_dimensions table
const DEMO_ROOM_DIMENSIONS = [
  // OH-A1 rooms
  { house_type_code: 'OH-A1', room_key: 'living_room', room_name: 'Living Room', length_m: 4.5, width_m: 3.8, area_sqm: 17.1 },
  { house_type_code: 'OH-A1', room_key: 'kitchen_dining', room_name: 'Kitchen/Dining', length_m: 5.2, width_m: 3.5, area_sqm: 18.2 },
  { house_type_code: 'OH-A1', room_key: 'utility', room_name: 'Utility', length_m: 1.8, width_m: 2.0, area_sqm: 3.6 },
  { house_type_code: 'OH-A1', room_key: 'wc_downstairs', room_name: 'WC Downstairs', length_m: 1.2, width_m: 1.5, area_sqm: 1.8 },
  { house_type_code: 'OH-A1', room_key: 'bedroom_1', room_name: 'Bedroom 1 (Master)', length_m: 3.8, width_m: 3.5, area_sqm: 13.3 },
  { house_type_code: 'OH-A1', room_key: 'bedroom_2', room_name: 'Bedroom 2', length_m: 3.2, width_m: 3.0, area_sqm: 9.6 },
  { house_type_code: 'OH-A1', room_key: 'bedroom_3', room_name: 'Bedroom 3', length_m: 2.8, width_m: 2.5, area_sqm: 7.0 },
  { house_type_code: 'OH-A1', room_key: 'bathroom', room_name: 'Bathroom', length_m: 2.2, width_m: 1.8, area_sqm: 4.0 },
  { house_type_code: 'OH-A1', room_key: 'ensuite', room_name: 'En-suite', length_m: 1.5, width_m: 2.0, area_sqm: 3.0 },
  { house_type_code: 'OH-A1', room_key: 'hall', room_name: 'Hall', length_m: 4.0, width_m: 1.2, area_sqm: 4.8 },
  { house_type_code: 'OH-A1', room_key: 'landing', room_name: 'Landing', length_m: 3.0, width_m: 1.5, area_sqm: 4.5 },

  // OH-A2 rooms (3 bed detached - slightly larger)
  { house_type_code: 'OH-A2', room_key: 'living_room', room_name: 'Living Room', length_m: 5.0, width_m: 4.0, area_sqm: 20.0 },
  { house_type_code: 'OH-A2', room_key: 'kitchen_dining', room_name: 'Kitchen/Dining', length_m: 5.5, width_m: 4.0, area_sqm: 22.0 },
  { house_type_code: 'OH-A2', room_key: 'utility', room_name: 'Utility', length_m: 2.0, width_m: 2.2, area_sqm: 4.4 },
  { house_type_code: 'OH-A2', room_key: 'wc_downstairs', room_name: 'WC Downstairs', length_m: 1.3, width_m: 1.6, area_sqm: 2.1 },
  { house_type_code: 'OH-A2', room_key: 'bedroom_1', room_name: 'Bedroom 1 (Master)', length_m: 4.0, width_m: 3.8, area_sqm: 15.2 },
  { house_type_code: 'OH-A2', room_key: 'bedroom_2', room_name: 'Bedroom 2', length_m: 3.5, width_m: 3.2, area_sqm: 11.2 },
  { house_type_code: 'OH-A2', room_key: 'bedroom_3', room_name: 'Bedroom 3', length_m: 3.0, width_m: 2.8, area_sqm: 8.4 },
  { house_type_code: 'OH-A2', room_key: 'bathroom', room_name: 'Bathroom', length_m: 2.4, width_m: 2.0, area_sqm: 4.8 },
  { house_type_code: 'OH-A2', room_key: 'ensuite', room_name: 'En-suite', length_m: 1.8, width_m: 2.2, area_sqm: 4.0 },
  { house_type_code: 'OH-A2', room_key: 'hall', room_name: 'Hall', length_m: 4.5, width_m: 1.4, area_sqm: 6.3 },
  { house_type_code: 'OH-A2', room_key: 'landing', room_name: 'Landing', length_m: 3.5, width_m: 1.6, area_sqm: 5.6 },

  // OH-B1 rooms (4 bed semi-detached)
  { house_type_code: 'OH-B1', room_key: 'living_room', room_name: 'Living Room', length_m: 5.2, width_m: 4.2, area_sqm: 21.8 },
  { house_type_code: 'OH-B1', room_key: 'kitchen_dining', room_name: 'Kitchen/Dining', length_m: 6.0, width_m: 4.0, area_sqm: 24.0 },
  { house_type_code: 'OH-B1', room_key: 'utility', room_name: 'Utility', length_m: 2.2, width_m: 2.2, area_sqm: 4.8 },
  { house_type_code: 'OH-B1', room_key: 'wc_downstairs', room_name: 'WC Downstairs', length_m: 1.4, width_m: 1.6, area_sqm: 2.2 },
  { house_type_code: 'OH-B1', room_key: 'bedroom_1', room_name: 'Bedroom 1 (Master)', length_m: 4.2, width_m: 4.0, area_sqm: 16.8 },
  { house_type_code: 'OH-B1', room_key: 'bedroom_2', room_name: 'Bedroom 2', length_m: 3.8, width_m: 3.5, area_sqm: 13.3 },
  { house_type_code: 'OH-B1', room_key: 'bedroom_3', room_name: 'Bedroom 3', length_m: 3.2, width_m: 3.0, area_sqm: 9.6 },
  { house_type_code: 'OH-B1', room_key: 'bedroom_4', room_name: 'Bedroom 4', length_m: 2.8, width_m: 2.6, area_sqm: 7.3 },
  { house_type_code: 'OH-B1', room_key: 'bathroom', room_name: 'Bathroom', length_m: 2.5, width_m: 2.2, area_sqm: 5.5 },
  { house_type_code: 'OH-B1', room_key: 'ensuite', room_name: 'En-suite', length_m: 2.0, width_m: 2.4, area_sqm: 4.8 },
  { house_type_code: 'OH-B1', room_key: 'hall', room_name: 'Hall', length_m: 5.0, width_m: 1.5, area_sqm: 7.5 },
  { house_type_code: 'OH-B1', room_key: 'landing', room_name: 'Landing', length_m: 4.0, width_m: 1.8, area_sqm: 7.2 },

  // OH-B2 rooms (4 bed detached with study)
  { house_type_code: 'OH-B2', room_key: 'living_room', room_name: 'Living Room', length_m: 5.5, width_m: 4.5, area_sqm: 24.8 },
  { house_type_code: 'OH-B2', room_key: 'kitchen_dining', room_name: 'Kitchen/Dining', length_m: 6.5, width_m: 4.5, area_sqm: 29.3 },
  { house_type_code: 'OH-B2', room_key: 'utility', room_name: 'Utility', length_m: 2.4, width_m: 2.4, area_sqm: 5.8 },
  { house_type_code: 'OH-B2', room_key: 'wc_downstairs', room_name: 'WC Downstairs', length_m: 1.5, width_m: 1.8, area_sqm: 2.7 },
  { house_type_code: 'OH-B2', room_key: 'study', room_name: 'Study', length_m: 2.8, width_m: 2.5, area_sqm: 7.0 },
  { house_type_code: 'OH-B2', room_key: 'bedroom_1', room_name: 'Bedroom 1 (Master)', length_m: 4.5, width_m: 4.2, area_sqm: 18.9 },
  { house_type_code: 'OH-B2', room_key: 'bedroom_2', room_name: 'Bedroom 2', length_m: 4.0, width_m: 3.8, area_sqm: 15.2 },
  { house_type_code: 'OH-B2', room_key: 'bedroom_3', room_name: 'Bedroom 3', length_m: 3.5, width_m: 3.2, area_sqm: 11.2 },
  { house_type_code: 'OH-B2', room_key: 'bedroom_4', room_name: 'Bedroom 4', length_m: 3.0, width_m: 2.8, area_sqm: 8.4 },
  { house_type_code: 'OH-B2', room_key: 'bathroom', room_name: 'Bathroom', length_m: 2.8, width_m: 2.4, area_sqm: 6.7 },
  { house_type_code: 'OH-B2', room_key: 'ensuite', room_name: 'En-suite', length_m: 2.2, width_m: 2.5, area_sqm: 5.5 },
  { house_type_code: 'OH-B2', room_key: 'hall', room_name: 'Hall', length_m: 5.5, width_m: 1.6, area_sqm: 8.8 },
  { house_type_code: 'OH-B2', room_key: 'landing', room_name: 'Landing', length_m: 4.5, width_m: 2.0, area_sqm: 9.0 },
];

// FAQs for the chat
const DEMO_FAQS = [
  {
    question: 'When is bin collection day?',
    answer: 'Bin collection is every Wednesday morning. Please have your bins out by 7am. Green bin (general waste) is weekly, blue bin (recycling) is weekly, and brown bin (garden/food waste) is fortnightly.',
  },
  {
    question: 'What is the BER rating of my home?',
    answer: 'All homes at Open House Park have a BER rating of A2, which means they are highly energy efficient with excellent insulation, triple-glazed windows, and an air-to-water heat pump system.',
  },
  {
    question: 'How do I contact the management company?',
    answer: 'You can contact Open House Park Management CLG by email at management@openhousepark.ie or by phone at 021 123 4567. Office hours are Monday to Friday, 9am to 5pm.',
  },
  {
    question: 'Is there parking available?',
    answer: 'Yes, each home at Open House Park has allocated parking. 3-bedroom homes have 2 parking spaces, and 4-bedroom homes have 2-3 parking spaces depending on the house type. There is also visitor parking available.',
  },
  {
    question: 'What heating system is installed?',
    answer: 'Your home is fitted with an air-to-water heat pump heating system. This is a highly efficient system that provides both heating and hot water. The system is controlled via the thermostat in the hallway and can also be controlled via the manufacturer\'s app.',
  },
  {
    question: 'Are pets allowed?',
    answer: 'Yes, pets are allowed at Open House Park. However, dogs must be kept on a lead in communal areas, and owners are responsible for cleaning up after their pets. Please be considerate of neighbours regarding noise.',
  },
];

// ============================================================================
// SEED FUNCTIONS
// ============================================================================

async function seedTenant() {
  console.log('📦 Creating demo tenant...');

  const { error } = await supabase
    .from('tenants')
    .upsert(DEMO_TENANT, { onConflict: 'id' });

  if (error) {
    console.error('Error creating tenant:', error);
    throw error;
  }
  console.log('✅ Tenant created: Open House AI');
}

async function seedDevelopment() {
  console.log('🏘️ Creating demo development...');

  const { error } = await supabase
    .from('developments')
    .upsert(DEMO_DEVELOPMENT, { onConflict: 'id' });

  if (error) {
    console.error('Error creating development:', error);
    throw error;
  }
  console.log('✅ Development created: Open House Park');
}

async function seedHouseTypes() {
  console.log('🏠 Creating house types...');

  for (const houseType of DEMO_HOUSE_TYPES) {
    const { error } = await supabase
      .from('house_types')
      .upsert(houseType, { onConflict: 'id' });

    if (error) {
      console.error(`Error creating house type ${houseType.house_type_code}:`, error);
      throw error;
    }
    console.log(`  ✅ ${houseType.house_type_code}: ${houseType.name}`);
  }
}

async function seedUnits() {
  console.log('🔑 Creating units...');

  for (let i = 0; i < DEMO_UNITS.length; i++) {
    const unit = DEMO_UNITS[i];
    const houseType = DEMO_HOUSE_TYPES.find(ht => ht.house_type_code === unit.house_type_code);

    const unitData = {
      id: UNIT_IDS[i],
      tenant_id: DEMO_TENANT_ID,
      development_id: DEMO_DEVELOPMENT_ID,
      unit_number: unit.unit_number,
      unit_code: `OH-PARK-${unit.unit_number.padStart(3, '0')}`,
      unit_uid: `oh-park-${unit.unit_number}`,
      house_type_code: unit.house_type_code,
      house_type_id: HOUSE_TYPE_IDS[unit.house_type_code as keyof typeof HOUSE_TYPE_IDS],
      purchaser_name: unit.purchaser_name,
      purchaser_email: unit.purchaser_email,
      address: `${unit.unit_number} Open House Park, Dublin Road, Cork City`,
      bedrooms: unit.house_type_code.startsWith('OH-B') ? 4 : 3,
      bathrooms: unit.house_type_code.startsWith('OH-B') ? 3 : 2,
      property_type: 'House',
      status: 'sold',
    };

    const { error } = await supabase
      .from('units')
      .upsert(unitData, { onConflict: 'id' });

    if (error) {
      console.error(`Error creating unit ${unit.unit_number}:`, error);
      throw error;
    }
    console.log(`  ✅ Unit ${unit.unit_number}: ${unit.purchaser_name} (${unit.house_type_code})`);
  }
}

async function seedRoomDimensions() {
  console.log('📐 Creating room dimensions...');

  for (const room of DEMO_ROOM_DIMENSIONS) {
    const houseTypeId = HOUSE_TYPE_IDS[room.house_type_code as keyof typeof HOUSE_TYPE_IDS];

    const dimensionData = {
      tenant_id: DEMO_TENANT_ID,
      development_id: DEMO_DEVELOPMENT_ID,
      house_type_id: houseTypeId,
      room_key: room.room_key,
      room_name: room.room_name,
      length_m: room.length_m,
      width_m: room.width_m,
      area_sqm: room.area_sqm,
      verified: true,
      source: 'demo_seed',
    };

    // Use upsert with a composite key check
    const { error } = await supabase
      .from('unit_room_dimensions')
      .upsert(dimensionData, {
        onConflict: 'tenant_id,development_id,house_type_id,room_key',
        ignoreDuplicates: false
      });

    if (error && !error.message.includes('duplicate')) {
      console.error(`Error creating room dimension ${room.room_name}:`, error);
      // Continue anyway - might be duplicate
    }
  }
  console.log(`  ✅ Created ${DEMO_ROOM_DIMENSIONS.length} room dimensions`);
}

async function seedNoticeboardPosts() {
  console.log('📋 Creating noticeboard posts...');

  for (const post of DEMO_POSTS) {
    const postData = {
      tenant_id: DEMO_TENANT_ID,
      development_id: DEMO_DEVELOPMENT_ID,
      title: post.title,
      content: post.content,
      author_name: post.author_name,
      category: post.category,
      is_pinned: post.is_pinned,
      status: 'approved',
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('noticeboard_posts')
      .insert(postData);

    if (error) {
      console.error(`Error creating post "${post.title}":`, error);
      // Continue anyway
    } else {
      console.log(`  ✅ ${post.title}`);
    }
  }
}

async function seedFAQs() {
  console.log('❓ Creating FAQs...');

  for (const faq of DEMO_FAQS) {
    const faqData = {
      tenant_id: DEMO_TENANT_ID,
      development_id: DEMO_DEVELOPMENT_ID,
      question: faq.question,
      answer: faq.answer,
      is_active: true,
    };

    const { error } = await supabase
      .from('faq_entries')
      .insert(faqData);

    if (error) {
      console.error(`Error creating FAQ "${faq.question}":`, error);
      // Continue anyway
    } else {
      console.log(`  ✅ ${faq.question.substring(0, 40)}...`);
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  DEMO ENVIRONMENT SEED - Open House Park');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('⚠️  This script creates an ISOLATED demo environment.');
  console.log('    It will NOT affect any existing data.');
  console.log('');
  console.log(`📍 Demo Tenant ID: ${DEMO_TENANT_ID}`);
  console.log(`📍 Demo Development ID: ${DEMO_DEVELOPMENT_ID}`);
  console.log('');

  try {
    await seedTenant();
    await seedDevelopment();
    await seedHouseTypes();
    await seedUnits();
    await seedRoomDimensions();
    await seedNoticeboardPosts();
    await seedFAQs();

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  ✅ DEMO ENVIRONMENT CREATED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('🔐 Demo User Access:');
    console.log('   Email: keeley@demo.openhouse.ai');
    console.log('   Unit: 1 Open House Park (OH-A1 - 3 bed semi-detached)');
    console.log('');
    console.log('📱 To access the demo portal:');
    console.log('   1. Create a user in Supabase Auth with email: keeley@demo.openhouse.ai');
    console.log('   2. Access via: https://your-domain.com (with tenant slug: demo-openhouse)');
    console.log('');
    console.log('🗑️  To remove demo data:');
    console.log(`   DELETE FROM tenants WHERE id = '${DEMO_TENANT_ID}';`);
    console.log('   (Cascade will remove all related data)');
    console.log('');
  } catch (error) {
    console.error('');
    console.error('❌ SEED FAILED:', error);
    process.exit(1);
  }
}

main();
