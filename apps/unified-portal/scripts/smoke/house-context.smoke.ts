/**
 * House context loader — smoke test (Sprint 4).
 *
 * Plain TypeScript, no test runner. Mocks the Supabase service-role client (no
 * network, no DB) and exercises loadHouseContext() against five cases:
 *   1. Full data — structure matches the HouseContext type; numerics coerced.
 *   2. House-type fallback — empty unit-keyed rooms fall back to house_type rows,
 *      tagged source 'house_type', and the fallback query is shaped correctly.
 *   3. Token budget — many rooms trip the guard and the rooms array is trimmed.
 *   4. Token budget stage 2 — verbose scheme notes are dropped after room trim.
 *   5. Partial data — scheme_profile missing yields scheme: null, rest intact.
 *
 * Run:
 *   npx tsx apps/unified-portal/scripts/smoke/house-context.smoke.ts
 *
 * Exit 0 = all cases pass. Exit 1 = a case failed.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { loadHouseContext, type HouseContext } from '../../lib/house-context';

let failures = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

type Row = Record<string, unknown>;

interface Fixtures {
  developments?: Row | null;
  units?: Row | null;
  scheme_profile?: Row | null;
  rooms_by_unit?: Row[];
  rooms_by_housetype?: Row[];
}

interface RecordedCall {
  table: string;
  filters: Record<string, unknown>;
  isNull: string[];
}

// A mock Supabase client: a chainable, awaitable query builder that records the
// table + filters it was given and returns canned data on resolution. Supports
// the exact chain the loader uses: select / eq / is / order / maybeSingle, plus
// awaiting the builder directly (for the multi-row room queries).
function makeSupabase(fixtures: Fixtures): { client: SupabaseClient; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const from = (table: string) => {
    const state: RecordedCall = { table, filters: {}, isNull: [] };
    const resolve = () => {
      calls.push({ table, filters: { ...state.filters }, isNull: [...state.isNull] });
      let data: unknown = null;
      if (table === 'developments') data = fixtures.developments ?? null;
      else if (table === 'units') data = fixtures.units ?? null;
      else if (table === 'scheme_profile') data = fixtures.scheme_profile ?? null;
      else if (table === 'unit_room_dimensions') {
        const isHouseType = state.isNull.includes('unit_id') || 'house_type_id' in state.filters;
        data = (isHouseType ? fixtures.rooms_by_housetype : fixtures.rooms_by_unit) ?? [];
      }
      return Promise.resolve({ data, error: null });
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {
      select: () => builder,
      eq: (col: string, val: unknown) => {
        state.filters[col] = val;
        return builder;
      },
      is: (col: string, val: unknown) => {
        if (val === null) state.isNull.push(col);
        return builder;
      },
      order: () => builder,
      maybeSingle: () => resolve(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      then: (onF: any, onR: any) => resolve().then(onF, onR),
    };
    return builder;
  };
  return { client: { from } as unknown as SupabaseClient, calls };
}

const BASE_PARAMS = { tenantId: 'tenant-1', developmentId: 'dev-1', unitId: 'unit-1' };

async function run(): Promise<void> {
  // --- Case 1: full data ---
  {
    console.log('Case 1: full data — structure + numeric coercion');
    const { client } = makeSupabase({
      developments: { name: 'Longview Park', address: '1 Longview Rd, Cork', project_type: 'residential' },
      units: {
        unit_number: '12',
        address: '12 Longview Park',
        eircode: 'T12 AB34',
        bedrooms: 3,
        bathrooms: 2,
        floor_area_m2: '110.5', // string in, number out
        property_type: 'semi-detached',
        handover_date: '2025-03-01',
        house_type_code: 'TYPE-B',
        project_id: 'proj-1',
        unit_type_id: 'ut-1',
        unit_types: { name: 'The Birch', floor_plan_pdf_url: 'https://x/plan.pdf' },
      },
      scheme_profile: {
        heating_type: 'Air-to-water heat pump',
        heating_controls: 'Honeywell room stat',
        broadband_type: 'FTTH',
        water_billing: 'Uisce Eireann',
        waste_setup: 'three-bin kerbside',
        waste_provider: 'Panda',
        parking_type: 'driveway',
        parking_notes: 'two spaces',
        bin_storage_notes: 'side passage',
        emergency_contact_phone: '021 000 0000',
        emergency_contact_notes: 'out of hours via managing agent',
        managing_agent_name: 'ABC Property Management',
      },
      rooms_by_unit: [
        { room_name: 'Living Room', floor: 'Ground', length_m: '4.1', width_m: '3.8', area_sqm: '15.58' },
        { room_name: 'Kitchen', floor: 'Ground', length_m: 3.0, width_m: 3.5, area_sqm: 10.5 },
      ],
    });
    const ctx: HouseContext = await loadHouseContext({ ...BASE_PARAMS, supabase: client });

    check(
      'top-level keys match HouseContext',
      JSON.stringify(Object.keys(ctx).sort()) ===
        JSON.stringify(['development', 'floor_plan_url', 'rooms', 'scheme', 'unit']),
      Object.keys(ctx).join(','),
    );
    check('development.name', ctx.development.name === 'Longview Park', ctx.development.name);
    check('development.project_type', ctx.development.project_type === 'residential');
    check('unit.unit_number', ctx.unit.unit_number === '12', String(ctx.unit.unit_number));
    check('unit.bedrooms is number 3', ctx.unit.bedrooms === 3, String(ctx.unit.bedrooms));
    check(
      'unit.floor_area_m2 coerced string->number',
      ctx.unit.floor_area_m2 === 110.5 && typeof ctx.unit.floor_area_m2 === 'number',
      String(ctx.unit.floor_area_m2),
    );
    check('unit.handover_date ISO', ctx.unit.handover_date === '2025-03-01', String(ctx.unit.handover_date));
    check('unit.unit_type_name from embed', ctx.unit.unit_type_name === 'The Birch', String(ctx.unit.unit_type_name));
    check('floor_plan_url from unit_types', ctx.floor_plan_url === 'https://x/plan.pdf', String(ctx.floor_plan_url));
    check('scheme present', ctx.scheme !== null);
    check('scheme.heating_type', ctx.scheme?.heating_type === 'Air-to-water heat pump', String(ctx.scheme?.heating_type));
    check('scheme.managing_agent_name', ctx.scheme?.managing_agent_name === 'ABC Property Management');
    check('rooms length 2', ctx.rooms.length === 2, String(ctx.rooms.length));
    check('room[0] name', ctx.rooms[0]?.name === 'Living Room', ctx.rooms[0]?.name);
    check(
      'room[0] length coerced string->number',
      ctx.rooms[0]?.length_m === 4.1 && typeof ctx.rooms[0]?.length_m === 'number',
      String(ctx.rooms[0]?.length_m),
    );
    check('room[0] source is unit', ctx.rooms[0]?.source === 'unit', ctx.rooms[0]?.source);
  }

  // --- Case 2: house-type fallback ---
  {
    console.log("Case 2: house-type fallback when unit has no unit-keyed rooms");
    const { client, calls } = makeSupabase({
      developments: { name: 'Longview Park', address: null, project_type: null },
      units: {
        unit_number: '7',
        address: '7 Longview Park',
        eircode: null,
        bedrooms: 2,
        bathrooms: 1,
        floor_area_m2: 85,
        property_type: 'apartment',
        handover_date: null,
        house_type_code: 'TYPE-A',
        project_id: 'proj-1',
        unit_type_id: 'ut-9',
        unit_types: { name: 'The Ash', floor_plan_pdf_url: null },
      },
      scheme_profile: null,
      rooms_by_unit: [], // none recorded for this specific unit
      rooms_by_housetype: [
        { room_name: 'Living Room', floor: 'Ground', length_m: 4.0, width_m: 3.7, area_sqm: 14.8 },
        { room_name: 'Bedroom 1', floor: 'First', length_m: 3.2, width_m: 3.0, area_sqm: 9.6 },
      ],
    });
    const ctx = await loadHouseContext({ ...BASE_PARAMS, supabase: client });

    check('rooms from fallback (length 2)', ctx.rooms.length === 2, String(ctx.rooms.length));
    check('fallback room source is house_type', ctx.rooms[0]?.source === 'house_type', ctx.rooms[0]?.source);
    check('fallback room name', ctx.rooms[0]?.name === 'Living Room', ctx.rooms[0]?.name);

    const urdCalls = calls.filter((c) => c.table === 'unit_room_dimensions');
    check('tried unit-keyed query first', urdCalls.some((c) => c.filters.unit_id === 'unit-1' && c.isNull.length === 0));
    check(
      'fallback query keyed by house_type_id = unit.unit_type_id and unit_id IS NULL',
      urdCalls.some((c) => c.filters.house_type_id === 'ut-9' && c.filters.verified === true && c.isNull.includes('unit_id')),
      JSON.stringify(urdCalls),
    );
  }

  // --- Case 3: token budget — many rooms trimmed to 8 ---
  {
    console.log('Case 3: token budget guard trims a long rooms array to 8');
    const manyRooms: Row[] = [];
    for (let i = 1; i <= 40; i++) {
      manyRooms.push({
        room_name: `Bedroom number ${i} with a deliberately long descriptive name`,
        floor: i % 2 === 0 ? 'Ground floor' : 'First floor',
        length_m: 4.12,
        width_m: 3.87,
        area_sqm: 15.94,
      });
    }
    const { client } = makeSupabase({
      developments: { name: 'Big Scheme', address: 'somewhere', project_type: 'residential' },
      units: {
        unit_number: '1',
        address: 'a',
        eircode: null,
        bedrooms: 40,
        bathrooms: 10,
        floor_area_m2: 500,
        property_type: 'house',
        handover_date: null,
        house_type_code: 'X',
        project_id: 'proj-1',
        unit_type_id: 'ut-1',
        unit_types: { name: 'Mansion', floor_plan_pdf_url: null },
      },
      scheme_profile: null, // isolate the room-truncation branch
      rooms_by_unit: manyRooms,
    });
    const ctx = await loadHouseContext({ ...BASE_PARAMS, supabase: client });
    check('rooms truncated to 8', ctx.rooms.length === 8, String(ctx.rooms.length));
    check('kept rooms keep unit source', ctx.rooms.every((r) => r.source === 'unit'));
  }

  // --- Case 4: token budget stage 2 — drop verbose scheme notes ---
  {
    console.log('Case 4: token budget guard drops verbose scheme notes (stage 2)');
    const bulky = 'x'.repeat(1500);
    const { client } = makeSupabase({
      developments: { name: 'Scheme', address: null, project_type: null },
      units: {
        unit_number: '2',
        address: 'b',
        eircode: null,
        bedrooms: 2,
        bathrooms: 1,
        floor_area_m2: 80,
        property_type: 'house',
        handover_date: null,
        house_type_code: 'Y',
        project_id: 'proj-1',
        unit_type_id: 'ut-1',
        unit_types: { name: 'Type', floor_plan_pdf_url: null },
      },
      scheme_profile: {
        heating_type: 'Gas boiler',
        heating_controls: 'wall thermostat',
        broadband_type: 'FTTH',
        water_billing: 'Uisce Eireann',
        waste_setup: 'three-bin',
        waste_provider: 'Greenstar',
        parking_type: 'on-street',
        parking_notes: bulky,
        bin_storage_notes: bulky,
        emergency_contact_phone: '999',
        emergency_contact_notes: bulky,
        managing_agent_name: 'Agent',
      },
      rooms_by_unit: [
        { room_name: 'Living Room', floor: 'Ground', length_m: 4.0, width_m: 3.5, area_sqm: 14 },
        { room_name: 'Kitchen', floor: 'Ground', length_m: 3, width_m: 3, area_sqm: 9 },
      ],
    });
    const ctx = await loadHouseContext({ ...BASE_PARAMS, supabase: client });
    check('rooms untouched (2, below the 8 cap)', ctx.rooms.length === 2, String(ctx.rooms.length));
    check('scheme still present', ctx.scheme !== null);
    check('parking_notes dropped', ctx.scheme?.parking_notes === null);
    check('bin_storage_notes dropped', ctx.scheme?.bin_storage_notes === null);
    check('emergency_contact_notes dropped', ctx.scheme?.emergency_contact_notes === null);
    check('non-notes scheme fields kept', ctx.scheme?.heating_type === 'Gas boiler', String(ctx.scheme?.heating_type));
    check('emergency_contact_phone kept', ctx.scheme?.emergency_contact_phone === '999', String(ctx.scheme?.emergency_contact_phone));
  }

  // --- Case 5: partial data — scheme_profile missing ---
  {
    console.log('Case 5: partial data — scheme_profile missing returns scheme: null');
    const { client } = makeSupabase({
      developments: { name: 'Longview Park', address: '1 Longview Rd', project_type: 'residential' },
      units: {
        unit_number: '5',
        address: '5 Longview Park',
        eircode: 'T12 ZZ99',
        bedrooms: 3,
        bathrooms: 2,
        floor_area_m2: 100,
        property_type: 'house',
        handover_date: '2024-12-10',
        house_type_code: 'TYPE-C',
        project_id: 'proj-1',
        unit_type_id: 'ut-1',
        unit_types: { name: 'The Oak', floor_plan_pdf_url: 'https://x/oak.pdf' },
      },
      scheme_profile: null, // no scheme row for this project
      rooms_by_unit: [{ room_name: 'Hall', floor: 'Ground', length_m: 2, width_m: 1.5, area_sqm: 3 }],
    });
    const ctx = await loadHouseContext({ ...BASE_PARAMS, supabase: client });
    check('scheme is null', ctx.scheme === null, JSON.stringify(ctx.scheme));
    check('development still loaded', ctx.development.name === 'Longview Park');
    check('unit still loaded', ctx.unit.unit_number === '5', String(ctx.unit.unit_number));
    check('rooms still loaded', ctx.rooms.length === 1 && ctx.rooms[0]?.source === 'unit');
    check('floor_plan_url still loaded', ctx.floor_plan_url === 'https://x/oak.pdf');
  }

  console.log('');
  if (failures > 0) {
    console.log(`SMOKE FAILED — ${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log('SMOKE PASSED — all cases green.');
  process.exit(0);
}

run().catch((err) => {
  console.error('SMOKE ERRORED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
