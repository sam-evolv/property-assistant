/**
 * UPDATE ROOM DIMENSIONS - From Actual Floor Plan
 *
 * Updates room dimensions to match the floor plan image provided.
 *
 * Run: npx tsx scripts/update-demo-room-dimensions.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DEMO_TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
const DEMO_DEVELOPMENT_ID = 'b0000000-0000-0000-0000-000000000001';

// Room dimensions from the floor plan image
const FLOOR_PLAN_DIMENSIONS = [
  // Ground Floor
  { room_key: 'living_room', room_name: 'Living Room', length_m: 4.27, width_m: 3.66, area_sqm: 15.63 },
  { room_key: 'dining_room', room_name: 'Dining Room', length_m: 3.05, width_m: 2.75, area_sqm: 8.39 },
  { room_key: 'kitchen', room_name: 'Kitchen', length_m: 3.35, width_m: 2.44, area_sqm: 8.17 },
  { room_key: 'hall', room_name: 'Hall', length_m: 3.58, width_m: 2.00, area_sqm: 7.16 },
  { room_key: 'wc_downstairs', room_name: 'WC (Ground Floor)', length_m: 1.52, width_m: 1.02, area_sqm: 1.55 },

  // First Floor
  { room_key: 'bedroom_1', room_name: 'Bedroom 1 (Master)', length_m: 3.60, width_m: 3.39, area_sqm: 12.20 },
  { room_key: 'bedroom_2', room_name: 'Bedroom 2', length_m: 3.25, width_m: 2.86, area_sqm: 9.30 },
  { room_key: 'bedroom_3', room_name: 'Bedroom 3', length_m: 2.92, width_m: 2.62, area_sqm: 7.65 },
  { room_key: 'ensuite', room_name: 'Ensuite', length_m: 2.16, width_m: 1.95, area_sqm: 4.21 },
  { room_key: 'bathroom', room_name: 'Bathroom', length_m: 1.37, width_m: 0.91, area_sqm: 1.25 }, // WC on first floor
  { room_key: 'landing', room_name: 'Landing', length_m: 2.52, width_m: 2.10, area_sqm: 5.29 },
  { room_key: 'storage', room_name: 'Storage', length_m: 1.16, width_m: 0.70, area_sqm: 0.81 },
];

async function updateRoomDimensions() {
  console.log('📐 Updating room dimensions from floor plan...\n');

  // First get the house type ID
  const { data: houseType } = await supabase
    .from('unit_types')
    .select('id')
    .eq('project_id', DEMO_DEVELOPMENT_ID)
    .limit(1);

  const houseTypeId = houseType?.[0]?.id;
  console.log('House Type ID:', houseTypeId || 'Not found');

  let updated = 0;
  let inserted = 0;

  for (const room of FLOOR_PLAN_DIMENSIONS) {
    // Check if exists
    const { data: existing } = await supabase
      .from('unit_room_dimensions')
      .select('id')
      .eq('tenant_id', DEMO_TENANT_ID)
      .eq('development_id', DEMO_DEVELOPMENT_ID)
      .eq('room_key', room.room_key)
      .limit(1);

    if (existing && existing.length > 0) {
      // Update existing
      const { error } = await supabase
        .from('unit_room_dimensions')
        .update({
          room_name: room.room_name,
          length_m: room.length_m,
          width_m: room.width_m,
          area_sqm: room.area_sqm,
          verified: true,
          source: 'floor_plan_image',
        })
        .eq('id', existing[0].id);

      if (!error) {
        updated++;
        console.log(`  ✓ Updated: ${room.room_name} (${room.length_m}m × ${room.width_m}m)`);
      }
    } else {
      // Insert new
      const insertData: any = {
        tenant_id: DEMO_TENANT_ID,
        development_id: DEMO_DEVELOPMENT_ID,
        room_key: room.room_key,
        room_name: room.room_name,
        length_m: room.length_m,
        width_m: room.width_m,
        area_sqm: room.area_sqm,
        verified: true,
        source: 'floor_plan_image',
      };

      if (houseTypeId) {
        insertData.house_type_id = houseTypeId;
      }

      const { error } = await supabase
        .from('unit_room_dimensions')
        .insert(insertData);

      if (!error) {
        inserted++;
        console.log(`  + Inserted: ${room.room_name} (${room.length_m}m × ${room.width_m}m)`);
      } else {
        console.log(`  ⚠️ ${room.room_name}: ${error.message}`);
      }
    }
  }

  console.log(`\n✅ Updated ${updated}, Inserted ${inserted} room dimensions`);
}

updateRoomDimensions().catch(console.error);
