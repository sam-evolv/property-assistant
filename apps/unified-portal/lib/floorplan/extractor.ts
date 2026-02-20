import OpenAI from 'openai';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractedRoom {
  room_name: string;
  room_key: string;
  floor: string | null;
  length_m: number | null;
  width_m: number | null;
  area_sqm: number | null;
  ceiling_height_m: number | null;
  confidence: number;
}

export interface ExtractionResult {
  rooms: ExtractedRoom[];
  house_type_code: string | null;
  total_floor_area_sqm: number | null;
  extraction_method: 'text_parse' | 'gpt4o_text' | 'failed';
  confidence: number;
  raw_text_length: number;
}

// ---------------------------------------------------------------------------
// Floor plan detection
// ---------------------------------------------------------------------------

const FLOOR_PLAN_PATTERNS =
  /\b(floor|plan|ga\b|type|layout|section|elevation)/i;

export function isFloorPlan(
  fileName: string,
  discipline: string | null,
): boolean {
  if (discipline === 'architectural') return true;
  return FLOOR_PLAN_PATTERNS.test(fileName);
}

// ---------------------------------------------------------------------------
// Room-key canonicalisation
// ---------------------------------------------------------------------------

const ROOM_KEY_MAP: Record<string, string> = {
  'living room': 'living_room',
  lounge: 'living_room',
  'sitting room': 'living_room',
  kitchen: 'kitchen',
  'kitchen/dining': 'kitchen_dining',
  'kitchen dining': 'kitchen_dining',
  'kitchen / dining': 'kitchen_dining',
  'master bedroom': 'master_bedroom',
  'main bedroom': 'master_bedroom',
  'bedroom 1': 'master_bedroom',
  'bedroom 2': 'bedroom_2',
  'bedroom 3': 'bedroom_3',
  'bedroom 4': 'bedroom_4',
  'en-suite': 'en_suite',
  ensuite: 'en_suite',
  'en suite': 'en_suite',
  bathroom: 'bathroom',
  wc: 'wc',
  cloakroom: 'wc',
  utility: 'utility',
  'utility room': 'utility',
  hall: 'hall',
  hallway: 'hall',
  'entrance hall': 'hall',
  landing: 'landing',
  study: 'study',
  'home office': 'study',
  garage: 'garage',
  store: 'store',
  'storage': 'store',
  'dining room': 'dining_room',
  dining: 'dining_room',
  'hot press': 'hot_press',
  'airing cupboard': 'hot_press',
  porch: 'porch',
};

function toRoomKey(roomName: string): string {
  const lower = roomName.toLowerCase().trim();
  if (ROOM_KEY_MAP[lower]) return ROOM_KEY_MAP[lower];

  // Handle "Bedroom N" variants
  const bedroomMatch = lower.match(/^bedroom\s+(\d+)$/);
  if (bedroomMatch) {
    const n = parseInt(bedroomMatch[1], 10);
    return n === 1 ? 'master_bedroom' : `bedroom_${n}`;
  }

  // Fallback: slugify
  return lower
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// ---------------------------------------------------------------------------
// GPT-4o-mini extraction prompt
// ---------------------------------------------------------------------------

const EXTRACTION_PROMPT = `You are extracting room dimensions from an architectural floor plan PDF.
The text below was extracted from the PDF using OCR/text layer extraction.

Extract ALL rooms and their dimensions. Return a JSON object:
{
  "house_type_code": "<type code if found, e.g. 'Type A', 'BS01', 'A1' — null if not found>",
  "total_floor_area_sqm": <number or null>,
  "rooms": [
    {
      "room_name": "<exact name from drawing>",
      "room_key": "<snake_case canonical name, e.g. 'living_room', 'master_bedroom', 'bedroom_2', 'en_suite', 'bathroom', 'kitchen', 'kitchen_dining', 'utility', 'wc', 'hall', 'landing', 'study', 'garage', 'store'>",
      "floor": "<'Ground', 'First', 'Second', or null if unclear>",
      "length_m": <number in metres, null if not found>,
      "width_m": <number in metres, null if not found>,
      "area_sqm": <number in m², null if not found>,
      "ceiling_height_m": <number in metres, null if not found>,
      "confidence": <0.0-1.0>
    }
  ]
}

Important:
- Convert mm to metres (divide by 1000). E.g. 4200mm → 4.2m
- Convert feet/inches to metres if needed
- Include ALL rooms including bathrooms, WC, utility, hall, landing
- If a dimension string is "4200 x 3800", that's length=4.2, width=3.8
- Return ONLY valid JSON, no markdown`;

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

export async function extractFloorPlanRooms(
  pdfBuffer: Buffer,
  openaiApiKey: string,
): Promise<ExtractionResult> {
  // 1. Extract text from PDF
  let extractedText = '';
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfMod = (await import('pdf-parse')) as any;
    const pdfParse = pdfMod.default ?? pdfMod;
    const pdfData = await pdfParse(pdfBuffer);
    extractedText = pdfData.text?.trim() || '';
  } catch (err) {
    console.warn(
      '[FloorPlan] PDF text extraction failed:',
      err instanceof Error ? err.message : 'err',
    );
    return {
      rooms: [],
      house_type_code: null,
      total_floor_area_sqm: null,
      extraction_method: 'failed',
      confidence: 0,
      raw_text_length: 0,
    };
  }

  // 2. If text too short, bail
  if (extractedText.length < 100) {
    return {
      rooms: [],
      house_type_code: null,
      total_floor_area_sqm: null,
      extraction_method: 'failed',
      confidence: 0,
      raw_text_length: extractedText.length,
    };
  }

  // 3. Send to GPT-4o-mini for structured extraction
  try {
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Cap text to avoid token overflow (~30k chars ≈ 8k tokens)
    const truncatedText =
      extractedText.length > 30000
        ? extractedText.slice(0, 30000) + '\n[...truncated]'
        : extractedText;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.1,
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: `PDF text:\n${truncatedText}` },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return {
        rooms: [],
        house_type_code: null,
        total_floor_area_sqm: null,
        extraction_method: 'failed',
        confidence: 0,
        raw_text_length: extractedText.length,
      };
    }

    // 4. Parse JSON response
    const parsed = JSON.parse(raw) as {
      house_type_code?: string | null;
      total_floor_area_sqm?: number | null;
      rooms?: Array<{
        room_name?: string;
        room_key?: string;
        floor?: string | null;
        length_m?: number | null;
        width_m?: number | null;
        area_sqm?: number | null;
        ceiling_height_m?: number | null;
        confidence?: number;
      }>;
    };

    const rooms: ExtractedRoom[] = (parsed.rooms || [])
      .filter((r) => r.room_name)
      .map((r) => ({
        room_name: r.room_name!,
        room_key: toRoomKey(r.room_key || r.room_name!),
        floor: r.floor || null,
        length_m: typeof r.length_m === 'number' ? r.length_m : null,
        width_m: typeof r.width_m === 'number' ? r.width_m : null,
        area_sqm: typeof r.area_sqm === 'number' ? r.area_sqm : null,
        ceiling_height_m:
          typeof r.ceiling_height_m === 'number' ? r.ceiling_height_m : null,
        confidence: typeof r.confidence === 'number' ? r.confidence : 0.5,
      }));

    // Compute overall confidence as average of room confidences
    const avgConfidence =
      rooms.length > 0
        ? rooms.reduce((sum, r) => sum + r.confidence, 0) / rooms.length
        : 0;

    return {
      rooms,
      house_type_code: parsed.house_type_code || null,
      total_floor_area_sqm:
        typeof parsed.total_floor_area_sqm === 'number'
          ? parsed.total_floor_area_sqm
          : null,
      extraction_method: 'gpt4o_text',
      confidence: Math.round(avgConfidence * 1000) / 1000,
      raw_text_length: extractedText.length,
    };
  } catch (err) {
    console.error(
      '[FloorPlan] GPT extraction failed:',
      err instanceof Error ? err.message : 'err',
    );
    return {
      rooms: [],
      house_type_code: null,
      total_floor_area_sqm: null,
      extraction_method: 'failed',
      confidence: 0,
      raw_text_length: extractedText.length,
    };
  }
}
