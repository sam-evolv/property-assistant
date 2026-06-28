import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validatePurchaserToken } from '@openhouse/api/qr-tokens';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url!, key!);
}

const DOC_BASE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://portal.openhouseai.ie'
).replace(/\/+$/, '');

interface HomeModelRoom {
  name: string;
  floor: string | null;
  length_m: number | null;
  width_m: number | null;
  area_sqm: number | null;
  source: 'unit' | 'house_type';
}

interface HomeModelResponse {
  unit_id: string;
  address: string | null;
  eircode: string | null;
  house_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor_area_m2: number | null;
  ber: string | null;
  rooms: HomeModelRoom[];
  floor_plan_url: string | null;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toStr(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function absoluteDocUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${DOC_BASE_URL}/${url.replace(/^\/+/, '')}`;
}

// GET /api/purchaser/home-model?unitUid=...&token=...
// Returns the home's rooms (with dimensions), floor plan URL, and key facts.
// Powers the visual home model in the My Home tab.
export async function GET(request: NextRequest) {
  const supabase = getSupabaseClient();
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');

    if (!unitUid) {
      return NextResponse.json({ error: 'Unit UID required' }, { status: 400, headers: NO_STORE });
    }

    const tokenResult = await validatePurchaserToken(token || unitUid, unitUid);
    if (!tokenResult.valid || !tokenResult.unitId) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: NO_STORE });
    }

    const supabaseUnitId = tokenResult.unitId;

    // Load unit + unit_type (floor plan + spec) in one query.
    const { data: unitRow, error: unitErr } = await supabase
      .from('units')
      .select(
        'unit_number, address, eircode, bedrooms, bathrooms, floor_area_m2, house_type_code, unit_type_id, unit_types(name, floor_plan_pdf_url)',
      )
      .eq('id', supabaseUnitId)
      .maybeSingle();

    if (unitErr || !unitRow) {
      return NextResponse.json({ rooms: [], floor_plan_url: null }, { headers: NO_STORE });
    }

    const row = unitRow as Record<string, unknown>;
    const utRaw = row.unit_types;
    const ut = (Array.isArray(utRaw) ? utRaw[0] : utRaw) as Record<string, unknown> | null | undefined;
    const rawFloorPlan = ut ? toStr(ut.floor_plan_pdf_url) : null;
    const floorPlanUrl = rawFloorPlan ? absoluteDocUrl(rawFloorPlan) : null;

    // Load rooms recorded for this specific unit.
    const { data: unitRooms } = await supabase
      .from('unit_room_dimensions')
      .select('room_name, floor, length_m, width_m, area_sqm')
      .eq('unit_id', supabaseUnitId)
      .eq('verified', true)
      .order('floor', { ascending: true })
      .order('room_name', { ascending: true });

    const rooms: HomeModelRoom[] = (unitRooms ?? []).map((r) => ({
      name: toStr(r.room_name) ?? '',
      floor: toStr(r.floor),
      length_m: toNum(r.length_m),
      width_m: toNum(r.width_m),
      area_sqm: toNum(r.area_sqm),
      source: 'unit' as const,
    }));

    // If no unit-specific rooms, fall back to house_type typical rooms.
    if (rooms.length === 0 && row.unit_type_id) {
      const { data: houseTypeRooms } = await supabase
        .from('unit_room_dimensions')
        .select('room_name, floor, length_m, width_m, area_sqm')
        .eq('house_type_id', row.unit_type_id as string)
        .order('floor', { ascending: true })
        .order('room_name', { ascending: true });

      if (houseTypeRooms && houseTypeRooms.length > 0) {
        const fallback = houseTypeRooms.map((r) => ({
          name: toStr(r.room_name) ?? '',
          floor: toStr(r.floor),
          length_m: toNum(r.length_m),
          width_m: toNum(r.width_m),
          area_sqm: toNum(r.area_sqm),
          source: 'house_type' as const,
        }));
        rooms.push(...fallback);
      }
    }

    const response: HomeModelResponse = {
      unit_id: supabaseUnitId,
      address: toStr(row.address),
      eircode: toStr(row.eircode),
      house_type: ut ? toStr(ut.name) : toStr(row.house_type_code),
      bedrooms: toNum(row.bedrooms),
      bathrooms: toNum(row.bathrooms),
      floor_area_m2: toNum(row.floor_area_m2),
      ber: null,
      rooms,
      floor_plan_url: floorPlanUrl,
    };

    return NextResponse.json(response, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ rooms: [], floor_plan_url: null }, { headers: NO_STORE });
  }
}
