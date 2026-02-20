export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min for 9 house types

/**
 * ONE-TIME INTERNAL ROUTE — bulk extract room dimensions for all Longview Park house types.
 * Auth: requires X-Service-Key header matching SUPABASE_SERVICE_ROLE_KEY.
 * DELETE THIS FILE after use.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const TENANT_ID = '4cee69c6-be4b-486e-9c33-2b5a7d30e287';
const DEV_ID    = '57dc3919-2725-4575-8046-9179075ac88e';

const HOUSE_TYPE_IDS: Record<string, string> = {
  'BD01': '86732528-ce23-4bff-8096-977410e4212a',
  'BD02': '27a8e88f-b526-45a8-bdbf-6a80cf4a706c',
  'BD03': '6a1efa5a-0057-471d-adb3-19fd14184208',
  'BD04': '1684055c-01c7-464f-a05b-240122c2b07a',
  'BD05': 'f50617fa-bf5a-4736-a8d5-72a712ffface',
  'BD17': '1bb69b9a-07de-432d-810c-19fabca8302a',
  'BS02': 'a3a829f9-fdc1-4cb5-8a60-024e36a0de65',
  'BS03': 'b54cb571-3499-47c3-9316-ab51956ef0ee',
  'BS04': '48b2b751-371e-478f-b92c-c5b4a3e352a3',
};

const RS_STORAGE_PATHS: Record<string, string> = {
  'BD01': `${DEV_ID}/1765222806182-24007HD-RS-BD01-01-B.pdf`,
  'BD02': `${DEV_ID}/1765291241301-24007HD-RS-BD02-01-B.pdf`,
  'BD03': `${DEV_ID}/1765291244525-24007HD-RS-BD03-01-B.pdf`,
  'BD04': `${DEV_ID}/1765291249404-24007HD-RS-BD04-01-B.pdf`,
  'BD05': `${DEV_ID}/1765291253655-24007HD-RS-BD05-01-B.pdf`,
  'BD17': `${DEV_ID}/1765291256465-24007HD-RS-BD17-01-A.pdf`,
  'BS02': `${DEV_ID}/1765291263879-24007HD-RS-BS02-01-D.pdf`,
  'BS03': `${DEV_ID}/1765291268600-24007HD-RS-BS03-01-C.pdf`,
  'BS04': `${DEV_ID}/1765291274284-24007HD-RS-BS04-01-C.pdf`,
};

const ROOM_KEY_MAP: Record<string, string> = {
  'living room': 'living_room', 'lounge': 'living_room', 'sitting room': 'living_room',
  'kitchen': 'kitchen', 'kitchen/dining': 'kitchen_dining', 'kitchen dining': 'kitchen_dining',
  'kitchen/dining area': 'kitchen_dining', 'dining room': 'dining_room',
  'master bedroom': 'master_bedroom', 'main bedroom': 'master_bedroom', 'bedroom 1': 'master_bedroom',
  'bedroom 2': 'bedroom_2', 'bedroom 3': 'bedroom_3', 'bedroom 4': 'bedroom_4',
  'en-suite': 'en_suite', 'ensuite': 'en_suite', 'en suite': 'en_suite',
  'bathroom': 'bathroom',
  'utility': 'utility', 'utility room': 'utility',
  'hall': 'hall', 'hallway': 'hall', 'entrance hall': 'hall',
  'landing': 'landing',
  'study': 'study', 'home office': 'study',
  'garage': 'garage', 'store': 'store', 'storage': 'store',
  'hot press': 'hot_press', 'airing cupboard': 'hot_press',
};

function toRoomKey(name: string, floor: string | null): string {
  const lower = name.toLowerCase().trim();
  const isUpperFloor = floor && /first|second|1st|2nd|upper/i.test(floor);
  const isGroundFloor = !floor || /ground|lower/i.test(floor);
  if (lower === 'wc' || lower === 'cloakroom' || lower === 'toilet') {
    return isUpperFloor ? 'wc_first' : 'wc_ground';
  }
  if (ROOM_KEY_MAP[lower]) return ROOM_KEY_MAP[lower];
  const bm = lower.match(/^bedroom\s*(\d+)$/);
  if (bm) return parseInt(bm[1]) === 1 ? 'master_bedroom' : `bedroom_${bm[1]}`;
  return lower.replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/, '');
}

export async function POST(request: NextRequest) {
  // Auth check
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const provided = request.headers.get('x-service-key');
  if (!provided || provided !== serviceKey) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  const results: Record<string, any> = {};

  for (const [houseType, htId] of Object.entries(HOUSE_TYPE_IDS)) {
    const storagePath = RS_STORAGE_PATHS[houseType];
    console.log(`[BulkExtract] Processing ${houseType}...`);

    try {
      // Skip if already has data
      const { count } = await supabase
        .from('unit_room_dimensions')
        .select('*', { count: 'exact', head: true })
        .eq('development_id', DEV_ID)
        .eq('house_type_id', htId);
      
      if ((count ?? 0) > 0) {
        results[houseType] = { skipped: true, reason: `already has ${count} rows` };
        console.log(`[BulkExtract] ${houseType}: skipping (${count} rows exist)`);
        continue;
      }

      // Download PDF
      const { data: fileData, error: dlErr } = await supabase.storage
        .from('development_docs').download(storagePath);
      if (dlErr || !fileData) {
        results[houseType] = { error: `download failed: ${dlErr?.message}` };
        continue;
      }

      // Extract text with pdf-parse
      const pdfMod = await import('pdf-parse') as any;
      const pdfParse = pdfMod.default ?? pdfMod;
      const buf = Buffer.from(await fileData.arrayBuffer());
      const pdfData = await pdfParse(buf);
      const text = pdfData.text?.trim() || '';
      console.log(`[BulkExtract] ${houseType}: ${text.length} chars extracted`);

      if (text.length < 50) {
        results[houseType] = { error: 'insufficient text' };
        continue;
      }

      // GPT-4o-mini extraction
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: `Extract room dimensions from this Room Sizes drawing for House Type ${houseType}.

Return JSON: {"rooms": [{"room_name": string, "floor": "Ground"|"First"|"Second"|null, "length_m": number|null, "width_m": number|null, "area_sqm": number|null}]}

Rules:
- Convert mm to metres (4000mm = 4.0m)
- Include ALL rooms (bedrooms, WC, bathroom, kitchen, living, utility, hall, landing, en-suite, storage)
- Infer floor: living/kitchen/hall/wc = Ground; bedrooms/landing/bathroom = First
- Return ONLY valid JSON

Text:
${text.slice(0, 6000)}`
        }],
      });

      const parsed = JSON.parse(completion.choices[0].message.content || '{}');
      const rooms: any[] = parsed.rooms || [];
      console.log(`[BulkExtract] ${houseType}: ${rooms.length} rooms from GPT`);

      // Insert rooms
      let inserted = 0;
      const insertedRooms: any[] = [];
      for (const room of rooms) {
        if (!room.room_name) continue;
        const roomKey = toRoomKey(room.room_name, room.floor);
        const { error: insErr } = await supabase.from('unit_room_dimensions').insert({
          tenant_id: TENANT_ID,
          development_id: DEV_ID,
          house_type_id: htId,
          room_name: room.room_name,
          room_key: roomKey,
          floor: room.floor || null,
          length_m: room.length_m || null,
          width_m: room.width_m || null,
          area_sqm: room.area_sqm || null,
          source: 'room_sizes_doc',
          verified: true,
        });
        if (!insErr) { inserted++; insertedRooms.push(`${roomKey}: ${room.length_m}x${room.width_m}m`); }
        else console.warn(`[BulkExtract] ${houseType} ${roomKey} insert error:`, insErr.message);
      }

      results[houseType] = { inserted, total: rooms.length, rooms: insertedRooms };
      console.log(`[BulkExtract] ${houseType}: inserted ${inserted}/${rooms.length}`);

    } catch (e: any) {
      results[houseType] = { error: e.message };
      console.error(`[BulkExtract] ${houseType} error:`, e.message);
    }
  }

  return NextResponse.json({ success: true, results });
}
