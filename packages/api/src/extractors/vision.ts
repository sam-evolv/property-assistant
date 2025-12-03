import OpenAI from 'openai';
import { getDocumentProxy, renderPageAsImage } from 'unpdf';
import { db } from '@openhouse/db';
import { intel_extractions } from '@openhouse/db/schema';
import crypto from 'crypto';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const VISION_MODEL = 'gpt-4o';
const MAX_PAGES_PER_DOCUMENT = 10;
const COST_PER_IMAGE_CENTS = 2;

export interface RoomExtraction {
  name: string;
  length_m?: number;
  width_m?: number;
  area_sqm?: number;
  door_width_mm?: number;
  window_width_mm?: number;
  notes?: string;
  confidence: number;
}

export interface SupplierExtraction {
  category: string;
  name: string;
  model?: string;
  contact?: string;
  notes?: string;
  confidence: number;
}

export interface VisionExtractionResult {
  rooms: RoomExtraction[];
  suppliers: SupplierExtraction[];
  total_floor_area_sqm?: number;
  ber_rating?: string;
  heating_type?: string;
  scale_indicator?: string;
  house_type_code?: string;
  raw_response: string;
  cost_cents: number;
  processing_time_ms: number;
  pages_processed: number;
  model_version: string;
}

const EXTRACTION_PROMPT = `You are an expert at extracting structured data from architectural floor plans and property documents.

Analyze this image and extract the following information in JSON format:

1. ROOMS: For each room visible, extract:
   - name: The room name (e.g., "Living Room", "Kitchen/Dining", "Master Bedroom")
   - length_m: Length in metres (if visible)
   - width_m: Width in metres (if visible)
   - area_sqm: Floor area in square metres (calculate from length × width if not stated)
   - door_width_mm: Door width in millimetres (if visible)
   - window_width_mm: Window width in millimetres (if visible)
   - confidence: Your confidence in this extraction (0-1)

2. SUPPLIERS: Extract any supplier/contractor information:
   - category: Type of supply (e.g., "kitchen", "wardrobe", "glazing", "flooring")
   - name: Company or brand name
   - model: Specific model or product line (if mentioned)
   - confidence: Your confidence (0-1)

3. METADATA:
   - total_floor_area_sqm: Total floor area if stated
   - ber_rating: Building Energy Rating (e.g., "A2", "B3")
   - heating_type: Primary heating system
   - scale_indicator: Scale if shown (e.g., "1:100", "1:50")
   - house_type_code: House type identifier (e.g., "BD01", "Type A")

IMPORTANT:
- Only extract data you can clearly see - do not guess
- Measurements should be in metric (metres, millimetres)
- Confidence should reflect how clearly you can read the value
- If a dimension is unclear, omit it rather than guess

Return a valid JSON object with this structure:
{
  "rooms": [...],
  "suppliers": [...],
  "total_floor_area_sqm": null,
  "ber_rating": null,
  "heating_type": null,
  "scale_indicator": null,
  "house_type_code": null
}`;

function isFloorplanDocument(fileName: string, documentType: string): boolean {
  const floorplanPatterns = [
    /floor\s*plan/i,
    /floorplan/i,
    /layout/i,
    /ground\s*floor/i,
    /first\s*floor/i,
    /^bd\d+/i,
    /^bs\d+/i,
    /type\s*[a-z]/i,
  ];
  
  const combinedName = `${fileName} ${documentType}`.toLowerCase();
  return floorplanPatterns.some(pattern => pattern.test(combinedName));
}

function generateCacheKey(buffer: Buffer, pageIndex: number): string {
  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  hash.update(pageIndex.toString());
  return hash.digest('hex');
}

async function renderPDFPageToBase64(buffer: Buffer, pageIndex: number): Promise<string | null> {
  try {
    const uint8Array = new Uint8Array(buffer);
    const pdf = await getDocumentProxy(uint8Array);
    
    if (pageIndex >= pdf.numPages) {
      return null;
    }
    
    const imageData = await renderPageAsImage(pdf, pageIndex + 1, {
      scale: 2,
    });
    
    return Buffer.from(imageData).toString('base64');
  } catch (error) {
    console.error(`❌ Failed to render page ${pageIndex}:`, error);
    return null;
  }
}

async function extractWithVision(imageBase64: string): Promise<{
  data: any;
  raw_response: string;
}> {
  const response = await openai.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: EXTRACTION_PROMPT,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${imageBase64}`,
              detail: 'high',
            },
          },
        ],
      },
    ],
    max_tokens: 2000,
    temperature: 0.1,
  });
  
  const rawContent = response.choices[0]?.message?.content || '';
  
  let jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/);
  let jsonStr = jsonMatch ? jsonMatch[1] : rawContent;
  
  const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    jsonStr = braceMatch[0];
  }
  
  try {
    const parsed = JSON.parse(jsonStr);
    return { data: parsed, raw_response: rawContent };
  } catch {
    console.error('❌ Failed to parse vision response as JSON:', rawContent);
    return {
      data: {
        rooms: [],
        suppliers: [],
        total_floor_area_sqm: null,
        ber_rating: null,
        heating_type: null,
        scale_indicator: null,
        house_type_code: null,
      },
      raw_response: rawContent,
    };
  }
}

function mergeExtractions(extractions: any[]): {
  rooms: RoomExtraction[];
  suppliers: SupplierExtraction[];
  metadata: Record<string, any>;
} {
  const roomsByName = new Map<string, RoomExtraction>();
  const suppliersByKey = new Map<string, SupplierExtraction>();
  const metadata: Record<string, any> = {};
  
  for (const extraction of extractions) {
    if (extraction.rooms) {
      for (const room of extraction.rooms) {
        const key = room.name?.toLowerCase().trim();
        if (key) {
          const existing = roomsByName.get(key);
          if (!existing || (room.confidence || 0) > (existing.confidence || 0)) {
            roomsByName.set(key, room);
          }
        }
      }
    }
    
    if (extraction.suppliers) {
      for (const supplier of extraction.suppliers) {
        const key = `${supplier.category}-${supplier.name}`.toLowerCase();
        const existing = suppliersByKey.get(key);
        if (!existing || (supplier.confidence || 0) > (existing.confidence || 0)) {
          suppliersByKey.set(key, supplier);
        }
      }
    }
    
    if (extraction.total_floor_area_sqm) {
      metadata.total_floor_area_sqm = extraction.total_floor_area_sqm;
    }
    if (extraction.ber_rating) {
      metadata.ber_rating = extraction.ber_rating;
    }
    if (extraction.heating_type) {
      metadata.heating_type = extraction.heating_type;
    }
    if (extraction.scale_indicator) {
      metadata.scale_indicator = extraction.scale_indicator;
    }
    if (extraction.house_type_code) {
      metadata.house_type_code = extraction.house_type_code;
    }
  }
  
  return {
    rooms: Array.from(roomsByName.values()),
    suppliers: Array.from(suppliersByKey.values()),
    metadata,
  };
}

export async function extractWithGPT4Vision(
  buffer: Buffer,
  fileName: string,
  documentType: string,
  tenantId: string,
  developmentId: string,
  documentId: string,
  options: {
    forceExtraction?: boolean;
    maxPages?: number;
  } = {}
): Promise<VisionExtractionResult> {
  const startTime = Date.now();
  const maxPages = options.maxPages || MAX_PAGES_PER_DOCUMENT;
  
  if (!options.forceExtraction && !isFloorplanDocument(fileName, documentType)) {
    console.log(`⏭️ Skipping vision extraction for non-floorplan document: ${fileName}`);
    return {
      rooms: [],
      suppliers: [],
      raw_response: 'Skipped: Not a floorplan document',
      cost_cents: 0,
      processing_time_ms: Date.now() - startTime,
      pages_processed: 0,
      model_version: VISION_MODEL,
    };
  }
  
  console.log(`\n🔍 GPT-4o VISION EXTRACTION: ${fileName}`);
  console.log(`   Document Type: ${documentType}`);
  console.log(`   Max Pages: ${maxPages}`);
  
  let numPages = 1;
  try {
    const uint8Array = new Uint8Array(buffer);
    const pdf = await getDocumentProxy(uint8Array);
    numPages = Math.min(pdf.numPages, maxPages);
    console.log(`   PDF Pages: ${pdf.numPages} (processing first ${numPages})`);
  } catch (error) {
    console.log(`   Note: Could not get page count, will try as single image`);
  }
  
  const pageExtractions: any[] = [];
  let totalCost = 0;
  
  for (let pageIndex = 0; pageIndex < numPages; pageIndex++) {
    console.log(`\n   Processing page ${pageIndex + 1}/${numPages}...`);
    
    try {
      const imageBase64 = await renderPDFPageToBase64(buffer, pageIndex);
      
      if (!imageBase64) {
        console.log(`   ⚠️ Could not render page ${pageIndex + 1}`);
        continue;
      }
      
      const { data, raw_response } = await extractWithVision(imageBase64);
      pageExtractions.push(data);
      totalCost += COST_PER_IMAGE_CENTS;
      
      console.log(`   ✅ Page ${pageIndex + 1}: ${data.rooms?.length || 0} rooms, ${data.suppliers?.length || 0} suppliers`);
      
    } catch (error) {
      console.error(`   ❌ Error processing page ${pageIndex + 1}:`, error);
    }
  }
  
  const merged = mergeExtractions(pageExtractions);
  const processingTime = Date.now() - startTime;
  
  console.log(`\n📊 VISION EXTRACTION COMPLETE`);
  console.log(`   Total Rooms: ${merged.rooms.length}`);
  console.log(`   Total Suppliers: ${merged.suppliers.length}`);
  console.log(`   Pages Processed: ${pageExtractions.length}`);
  console.log(`   Cost: ${totalCost} cents`);
  console.log(`   Time: ${processingTime}ms\n`);
  
  try {
    await db.insert(intel_extractions).values({
      tenant_id: tenantId,
      development_id: developmentId,
      document_id: documentId,
      extraction_method: 'gpt4o_vision',
      model_version: VISION_MODEL,
      raw_output: { pages: pageExtractions },
      structured_data: merged,
      rooms_extracted: merged.rooms,
      suppliers_extracted: merged.suppliers,
      confidence_scores: {
        rooms: merged.rooms.reduce((acc, r) => ({ ...acc, [r.name]: r.confidence }), {}),
        suppliers: merged.suppliers.reduce((acc, s) => ({ ...acc, [`${s.category}-${s.name}`]: s.confidence }), {}),
      },
      cost_cents: totalCost,
      processing_time_ms: processingTime,
      page_range: `1-${pageExtractions.length}`,
      status: 'completed',
    });
  } catch (error) {
    console.error('❌ Failed to save extraction record:', error);
  }
  
  return {
    rooms: merged.rooms,
    suppliers: merged.suppliers,
    total_floor_area_sqm: merged.metadata.total_floor_area_sqm,
    ber_rating: merged.metadata.ber_rating,
    heating_type: merged.metadata.heating_type,
    scale_indicator: merged.metadata.scale_indicator,
    house_type_code: merged.metadata.house_type_code,
    raw_response: JSON.stringify(pageExtractions),
    cost_cents: totalCost,
    processing_time_ms: processingTime,
    pages_processed: pageExtractions.length,
    model_version: VISION_MODEL,
  };
}

export async function shouldUseVisionExtraction(
  buffer: Buffer,
  fileName: string,
  documentType: string,
  textContent: string
): Promise<boolean> {
  if (isFloorplanDocument(fileName, documentType)) {
    return true;
  }
  
  if (textContent.length < 100) {
    return true;
  }
  
  const hasLikelyDimensions = /\d+\.?\d*\s*[mx×]\s*\d+\.?\d*/i.test(textContent);
  if (!hasLikelyDimensions && isFloorplanDocument(fileName, documentType)) {
    return true;
  }
  
  return false;
}
