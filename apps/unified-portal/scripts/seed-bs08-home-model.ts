#!/usr/bin/env tsx
/**
 * Seed the BS08 visual home model used by the Golden Home demo.
 *
 * This writes verified, house-type-level rows to unit_room_dimensions. The
 * purchaser home-model API falls back to these rows when a specific unit has no
 * unit-level dimensions, so 34 Bayly can still render a full room grid.
 *
 * Safe default: dry-run. Add --apply to write rows.
 *
 * Run from apps/unified-portal:
 *   npx tsx scripts/seed-bs08-home-model.ts
 *   npx tsx scripts/seed-bs08-home-model.ts --apply
 *
 * Optional env:
 *   BS08_PROJECT_ID       defaults to the Golden Home project id below
 *   BS08_HOUSE_TYPE_CODE  defaults to BS08
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const APPLY = process.argv.includes('--apply');
const PROJECT_ID = process.env.BS08_PROJECT_ID || '84a559d1-89f1-4eb6-a48b-7ca068bcc164';
const HOUSE_TYPE_CODE = (process.env.BS08_HOUSE_TYPE_CODE || 'BS08').toUpperCase();

const ROOMS = [
  { room_name: 'Kitchen / Dining', floor: 'ground', length_m: 3.6, width_m: 5.8, area_sqm: 20.9 },
  { room_name: 'Living Room', floor: 'ground', length_m: 3.8, width_m: 4.1, area_sqm: 15.6 },
  { room_name: 'Hall', floor: 'ground', length_m: 1.9, width_m: 5.3, area_sqm: 10.1 },
  { room_name: 'Utility', floor: 'ground', length_m: 2.2, width_m: 1.6, area_sqm: 3.5 },
  { room_name: 'WC', floor: 'ground', length_m: 1.5, width_m: 1.6, area_sqm: 2.4 },
  { room_name: 'Main Bedroom', floor: 'first', length_m: 3.6, width_m: 4.0, area_sqm: 14.4 },
  { room_name: 'Bedroom 2', floor: 'first', length_m: 3.2, width_m: 3.9, area_sqm: 12.5 },
  { room_name: 'Bedroom 3', floor: 'first', length_m: 2.5, width_m: 3.3, area_sqm: 8.3 },
  { room_name: 'Bathroom', floor: 'first', length_m: 2.1, width_m: 2.0, area_sqm: 4.2 },
  { room_name: 'En-suite', floor: 'first', length_m: 2.1, width_m: 1.5, area_sqm: 3.2 },
];

function roomKey(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function requireSingle<T>(label: string, query: PromiseLike<{ data: T | null; error: any }>): Promise<T> {
  const { data, error } = await query;
  if (error || !data) {
    console.error(`Could not resolve ${label}:`, error?.message || 'not found');
    process.exit(1);
  }
  return data;
}

async function main() {
  console.log(`${APPLY ? 'Applying' : 'Dry-running'} BS08 home model seed`);
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`House type: ${HOUSE_TYPE_CODE}`);

  const unitType = await requireSingle<any>(
    'unit_types row',
    supabase
      .from('unit_types')
      .select('id, name, project_id, specification_json')
      .eq('project_id', PROJECT_ID)
      .eq('name', HOUSE_TYPE_CODE)
      .maybeSingle(),
  );

  const sampleUnit = await requireSingle<any>(
    'sample unit for tenant/development ids',
    supabase
      .from('units')
      .select('id, tenant_id, development_id, project_id, unit_type_id, house_type_code, unit_number, address')
      .or(`unit_type_id.eq.${unitType.id},house_type_code.eq.${HOUSE_TYPE_CODE}`)
      .limit(1)
      .maybeSingle(),
  );

  const tenantId = sampleUnit.tenant_id;
  const developmentId = sampleUnit.development_id || sampleUnit.project_id || PROJECT_ID;

  if (!tenantId || !developmentId) {
    console.error('Sample unit is missing tenant_id or development_id/project_id. Cannot seed safely.');
    process.exit(1);
  }

  console.log(`Resolved unit type id: ${unitType.id}`);
  console.log(`Resolved tenant id: ${tenantId}`);
  console.log(`Resolved development id: ${developmentId}`);
  console.log(`Sample unit: ${sampleUnit.unit_number || sampleUnit.address || sampleUnit.id}`);

  let inserted = 0;
  let updated = 0;

  for (const room of ROOMS) {
    const payload = {
      tenant_id: tenantId,
      development_id: developmentId,
      house_type_id: unitType.id,
      unit_id: null,
      room_name: room.room_name,
      room_key: roomKey(room.room_name),
      floor: room.floor,
      length_m: String(room.length_m),
      width_m: String(room.width_m),
      area_sqm: String(room.area_sqm),
      source: 'schedule_pdf',
      verified: true,
      notes: 'Seeded from BS08 room size schedule for Golden Home demo.',
    };

    const { data: existing, error: existingError } = await supabase
      .from('unit_room_dimensions')
      .select('id')
      .eq('house_type_id', payload.house_type_id)
      .is('unit_id', null)
      .eq('room_key', payload.room_key)
      .eq('floor', payload.floor)
      .eq('source', payload.source)
      .maybeSingle();

    if (existingError) {
      console.error(`Failed checking ${room.room_name}:`, existingError.message);
      process.exit(1);
    }

    if (!APPLY) {
      console.log(`${existing ? 'Would update' : 'Would insert'}: ${room.room_name} (${room.length_m}m × ${room.width_m}m)`);
      continue;
    }

    if (existing) {
      const { error } = await supabase
        .from('unit_room_dimensions')
        .update(payload)
        .eq('id', existing.id);
      if (error) {
        console.error(`Failed updating ${room.room_name}:`, error.message);
        process.exit(1);
      }
      updated += 1;
    } else {
      const { error } = await supabase.from('unit_room_dimensions').insert(payload);
      if (error) {
        console.error(`Failed inserting ${room.room_name}:`, error.message);
        process.exit(1);
      }
      inserted += 1;
    }
  }

  if (!APPLY) {
    console.log('\nDry run complete. Re-run with --apply to write rows.');
  } else {
    console.log(`\nSeed complete. Inserted ${inserted}, updated ${updated}.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
