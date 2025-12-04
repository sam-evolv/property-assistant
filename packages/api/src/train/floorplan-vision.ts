import OpenAI from 'openai';
import { getDocumentProxy } from 'unpdf';
import { db } from '@openhouse/db/client';
import { unit_room_dimensions } from '@openhouse/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { normalizeToCanonicalRoomName } from '../normalize-room-name';

type CreateCanvasFn = (width: number, height: number) => any;

let cachedCreateCanvas: CreateCanvasFn | null = null;

async function loadCanvas(): Promise<CreateCanvasFn | null> {
  if (cachedCreateCanvas) return cachedCreateCanvas;
  
  try {
    const canvasModule = await import('canvas');
    cachedCreateCanvas = canvasModule.createCanvas;
    return cachedCreateCanvas;
  } catch (error) {
    console.warn('[floorplan-vision] Canvas library not available:', error);
    return null;
  }
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export interface FloorplanVisionInput {
  tenant_id: string;
  development_id: string;
  house_type_id: string;
  unit_type_code: string;
  document_id: string;
  buffer: Buffer;
  fileName: string;
}

export interface FloorplanVisionOutput {
  house_type_code: string;
  levels: Array<{
    level_name: string;
    rooms: Array<{
      room_name: string;
      area_m2: number;
      length_m?: number;
      width_m?: number;
    }>;
  }>;
}

export interface RoomDimensionExtractionResult {
  success: boolean;
  roomsExtracted: number;
  error?: string;
  rawPayload?: FloorplanVisionOutput;
}

const FLOORPLAN_VISION_SYSTEM_PROMPT = `You are an expert architectural drafter analyzing floor plan drawings.

Your task is to identify all habitable rooms and internal spaces with their names and areas in square metres (m²).

CRITICAL RULES:
1. ONLY use exact numeric values printed on the plan (e.g., "14.0 m² Kitchen/Dining", "2.4 m² Toilet")
2. DO NOT infer, estimate, or calculate areas if not explicitly shown
3. If you see dimensions like "3.8m x 4.2m", you MAY calculate area (3.8 × 4.2 = 15.96 m²)
4. Extract ALL visible room labels and their associated area values
5. Preserve the exact room names as they appear on the plan

OUTPUT FORMAT (strict JSON):
{
  "house_type_code": "BD01",
  "levels": [
    {
      "level_name": "Ground Floor",
      "rooms": [
        { "room_name": "Kitchen/Dining", "area_m2": 14.0, "length_m": 4.2, "width_m": 3.3 },
        { "room_name": "Toilet", "area_m2": 2.4 }
      ]
    },
    {
      "level_name": "First Floor",
      "rooms": [
        { "room_name": "Bedroom 1", "area_m2": 12.5 }
      ]
    }
  ]
}

Include length_m and width_m ONLY if explicit dimension measurements are visible (e.g., "3.8m x 4.2m").
If only area is shown (e.g., "14.0 m²"), omit length_m and width_m.`;

const FLOORPLAN_VISION_JSON_SCHEMA = {
  type: "object",
  properties: {
    house_type_code: { type: "string" },
    levels: {
      type: "array",
      items: {
        type: "object",
        properties: {
          level_name: { type: "string" },
          rooms: {
            type: "array",
            items: {
              type: "object",
              properties: {
                room_name: { type: "string" },
                area_m2: { type: "number" },
                length_m: { type: "number" },
                width_m: { type: "number" }
              },
              required: ["room_name", "area_m2"],
              additionalProperties: false
            }
          }
        },
        required: ["level_name", "rooms"],
        additionalProperties: false
      }
    }
  },
  required: ["house_type_code", "levels"],
  additionalProperties: false
};

async function renderPDFPageToBase64(pdf: any, pageNum: number): Promise<string> {
  const createCanvas = await loadCanvas();
  if (!createCanvas) {
    throw new Error('Canvas library not available for PDF rendering');
  }
  
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 2.0 });
  
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d');
  
  const renderContext = {
    canvasContext: context,
    viewport: viewport,
    canvas: canvas,
  };
  
  await (page.render(renderContext as any) as any).promise;
  
  const imageBuffer = canvas.toBuffer('image/png');
  return imageBuffer.toString('base64');
}

async function callVisionForFloorplan(
  base64Image: string,
  fileName: string,
  unit_type_code: string
): Promise<FloorplanVisionOutput> {
  console.log(`  Calling OpenAI Vision for floorplan: ${fileName}...`);
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: FLOORPLAN_VISION_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${base64Image}`,
              detail: 'high',
            },
          },
          {
            type: 'text',
            text: `Extract room dimensions from this ${unit_type_code} floor plan. Return ONLY exact values printed on the drawing.`,
          },
        ],
      },
    ],
    max_tokens: 4096,
    temperature: 0.1,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "floorplan_dimensions",
        strict: true,
        schema: FLOORPLAN_VISION_JSON_SCHEMA,
      },
    },
  });
  
  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error('No content returned from OpenAI Vision');
  }
  
  const parsed = JSON.parse(content) as FloorplanVisionOutput;
  console.log(`  ✅ Vision extraction successful: ${parsed.levels.reduce((acc, l) => acc + l.rooms.length, 0)} rooms found`);
  
  return parsed;
}

function normalizeRoomName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s*\/\s*/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export async function extractRoomDimensionsFromFloorplan(
  input: FloorplanVisionInput
): Promise<RoomDimensionExtractionResult> {
  const { tenant_id, development_id, house_type_id, unit_type_code, document_id, buffer, fileName } = input;
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🏗️  VISION FLOORPLAN EXTRACTION STARTED`);
  console.log(`${'='.repeat(80)}`);
  console.log(`📁 File: ${fileName}`);
  console.log(`🏢 Tenant ID: ${tenant_id}`);
  console.log(`🏗️  Development ID: ${development_id}`);
  console.log(`🏠 House Type ID: ${house_type_id}`);
  console.log(`🔖 House Type Code: ${unit_type_code}`);
  console.log(`📄 Document ID: ${document_id}`);
  
  try {
    const uint8Array = new Uint8Array(buffer);
    const pdf = await getDocumentProxy(uint8Array);
    const totalPages = pdf.numPages;
    
    console.log(`  📄 PDF has ${totalPages} page(s)`);
    
    const allLevels: FloorplanVisionOutput['levels'] = [];
    
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      console.log(`  🔍 Processing page ${pageNum}/${totalPages}...`);
      
      const base64Image = await renderPDFPageToBase64(pdf, pageNum);
      const visionResult = await callVisionForFloorplan(
        base64Image,
        `${fileName} (page ${pageNum})`,
        unit_type_code
      );
      
      allLevels.push(...visionResult.levels);
    }
    
    const aggregatedResult: FloorplanVisionOutput = {
      house_type_code: unit_type_code,
      levels: allLevels,
    };
    
    let roomsExtracted = 0;
    
    for (const level of aggregatedResult.levels) {
      for (const room of level.rooms) {
        const normalizedRoomName = normalizeRoomName(room.room_name);
        const canonicalRoomName = normalizeToCanonicalRoomName(room.room_name);
        
        console.log(`    🏷️  ${room.room_name} → canonical: ${canonicalRoomName}`);
        
        const existing = await db
          .select()
          .from(unit_room_dimensions)
          .where(
            and(
              eq(unit_room_dimensions.tenant_id, tenant_id),
              eq(unit_room_dimensions.development_id, development_id),
              eq(unit_room_dimensions.house_type_id, house_type_id),
              eq(unit_room_dimensions.unit_type_code, unit_type_code),
              eq(unit_room_dimensions.canonical_room_name, canonicalRoomName),
              level.level_name
                ? eq(unit_room_dimensions.level, level.level_name)
                : sql`${unit_room_dimensions.level} IS NULL`
            )
          )
          .limit(1);
        
        const roomData = {
          tenant_id,
          development_id,
          house_type_id,
          unit_type_code,
          room_name: room.room_name,
          canonical_room_name: canonicalRoomName,
          level: level.level_name || null,
          length_m: room.length_m || null,
          width_m: room.width_m || null,
          area_m2: room.area_m2,
          source: 'vision_floorplan' as const,
          confidence: 0.9,
          raw_payload: JSON.stringify(room),
          updated_at: new Date(),
        };
        
        if (existing.length > 0) {
          await db
            .update(unit_room_dimensions)
            .set(roomData)
            .where(eq(unit_room_dimensions.id, existing[0].id));
          
          console.log(`  ✏️  Updated: ${normalizedRoomName} (${room.area_m2} m²) - ${level.level_name}`);
        } else {
          await db
            .insert(unit_room_dimensions)
            .values({
              ...roomData,
              created_at: new Date(),
            });
          
          console.log(`  ➕ Inserted: ${normalizedRoomName} (${room.area_m2} m²) - ${level.level_name}`);
        }
        
        roomsExtracted++;
      }
    }
    
    console.log(`✅ Extracted ${roomsExtracted} room dimensions from ${totalPages} page(s) in ${fileName}`);
    
    return {
      success: true,
      roomsExtracted,
      rawPayload: aggregatedResult,
    };
  } catch (error) {
    console.error('❌ Floorplan vision extraction failed:', error);
    return {
      success: false,
      roomsExtracted: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function isLikelyFloorplan(fileName: string, documentType?: string): boolean {
  const lowerName = fileName.toLowerCase();
  const lowerType = documentType?.toLowerCase() || '';
  
  // Check document type/category first (e.g., "Floorplans", "architectural_floor_plan")
  const categoryMatch = lowerType.includes('floor') || lowerType.includes('plan');
  
  // Then check filename patterns
  const floorplanKeywords = [
    'floor',
    'plan',
    'floorplan',
    'layout',
    'ground and first',
    'first floor',
    'ground floor',
    'gf',
    'ff',
    'elevation',
    'architectural',
  ];
  
  const filenameMatch = floorplanKeywords.some(kw => lowerName.includes(kw));
  
  const isFloorplan = categoryMatch || filenameMatch;
  
  if (isFloorplan) {
    console.log(`   🎯 FLOORPLAN DETECTED: ${fileName}`);
    console.log(`      Category match: ${categoryMatch} (type: "${documentType || 'none'}")`);
    console.log(`      Filename match: ${filenameMatch}`);
  }
  
  return isFloorplan;
}
