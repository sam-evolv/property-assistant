import Tesseract from 'tesseract.js';
import { getDocumentProxy, extractText } from 'unpdf';
import { createCanvas } from 'canvas';
import OpenAI from 'openai';
import crypto from 'crypto';
import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });
}

export interface EnhancedOCRResult {
  text: string;
  textLayerText: string;
  ocrText: string;
  mergedText: string;
  confidence: number;
  pageCount: number;
  extractionMethod: 'text' | 'ocr' | 'merged' | 'vision';
  roomDimensions: RoomDimensionExtraction[];
  documentFailures: DocumentFailure[];
}

export interface RoomDimensionExtraction {
  room: string;
  length_m: number;
  width_m: number;
  area_sqm: number;
  rawText: string;
  confidence: number;
}

export interface DocumentFailure {
  page: number;
  error: string;
  timestamp: string;
}

const OCR_CACHE = new Map<string, { text: string; confidence: number; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

function getContentHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function checkOCRCache(contentHash: string): Promise<{ text: string; confidence: number } | null> {
  const cached = OCR_CACHE.get(contentHash);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('  OCR cache hit');
    return { text: cached.text, confidence: cached.confidence };
  }
  
  try {
    const dbCache = await db.execute(sql`
      SELECT ocr_text, ocr_confidence FROM documents 
      WHERE content_hash = ${contentHash} 
      AND ocr_text IS NOT NULL 
      LIMIT 1
    `);
    if (dbCache.rows && dbCache.rows.length > 0) {
      const row = dbCache.rows[0] as any;
      console.log('  OCR database cache hit');
      return { text: row.ocr_text, confidence: row.ocr_confidence || 0 };
    }
  } catch (e) {
  }
  
  return null;
}

function setOCRCache(contentHash: string, text: string, confidence: number): void {
  OCR_CACHE.set(contentHash, { text, confidence, timestamp: Date.now() });
}

function normalizeOCRText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/^\s+|\s+$/gm, '')
    .replace(/(\d+)\s*[xX×]\s*(\d+)/g, '$1 x $2')
    .replace(/(\d+)\s*mm\s*[xX×]\s*(\d+)\s*mm/gi, '$1mm x $2mm')
    .replace(/(\d+(?:\.\d+)?)\s*m\s*[xX×]\s*(\d+(?:\.\d+)?)\s*m/gi, '$1m x $2m')
    .replace(/\b(\d+)mm\b/gi, (_, num) => `${(parseInt(num) / 1000).toFixed(2)}m`)
    .trim();
}

function deduplicateLines(text1: string, text2: string): string {
  const lines1 = text1.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const lines2 = text2.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  const seen = new Set<string>();
  const merged: string[] = [];
  
  for (const line of lines1) {
    const normalized = line.toLowerCase().replace(/\s+/g, ' ');
    if (!seen.has(normalized)) {
      seen.add(normalized);
      merged.push(line);
    }
  }
  
  for (const line of lines2) {
    const normalized = line.toLowerCase().replace(/\s+/g, ' ');
    if (!seen.has(normalized)) {
      seen.add(normalized);
      merged.push(line);
    }
  }
  
  return merged.join('\n');
}

function extractRoomDimensions(text: string): RoomDimensionExtraction[] {
  const dimensions: RoomDimensionExtraction[] = [];
  
  const roomPatterns = [
    /(?:Living\s*Room|Lounge|Sitting\s*Room)/gi,
    /(?:Kitchen(?:\s*\/?\s*Dining)?|Kitchen\s*Dining)/gi,
    /(?:Bedroom\s*[1-4]|Master\s*Bedroom|Main\s*Bedroom)/gi,
    /(?:Bathroom|En\s*-?\s*Suite|Ensuite)/gi,
    /(?:Utility|Utility\s*Room)/gi,
    /(?:Garage|Car\s*Port)/gi,
    /(?:Hall|Entrance\s*Hall|Hallway)/gi,
    /(?:Landing|Upper\s*Landing)/gi,
    /(?:Dining\s*Room|Dining\s*Area)/gi,
    /(?:Study|Office|Home\s*Office)/gi,
    /(?:WC|Toilet|Cloakroom)/gi,
  ];
  
  const dimensionPatterns = [
    /(\d+(?:\.\d+)?)\s*m?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*m?\b/g,
    /(\d{3,4})\s*[xX×]\s*(\d{3,4})\s*(?:mm)?/g,
    /(\d+(?:\.\d+)?)\s*(?:metres?|meters?)\s*[xX×by]\s*(\d+(?:\.\d+)?)\s*(?:metres?|meters?)/gi,
    /(\d+\.\d{1,2})\s*m\s+(\d+\.\d{1,2})\s*m/g,
  ];
  
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const context = [lines[i-1] || '', line, lines[i+1] || ''].join(' ');
    
    for (const roomPattern of roomPatterns) {
      roomPattern.lastIndex = 0;
      const roomMatch = roomPattern.exec(context);
      
      if (roomMatch) {
        const roomName = roomMatch[0].trim();
        
        for (const dimPattern of dimensionPatterns) {
          dimPattern.lastIndex = 0;
          const dimMatch = dimPattern.exec(context);
          
          if (dimMatch) {
            let length = parseFloat(dimMatch[1]);
            let width = parseFloat(dimMatch[2]);
            
            if (length > 100) length = length / 1000;
            if (width > 100) width = width / 1000;
            
            if (length > 1 && length < 20 && width > 1 && width < 20) {
              const area = length * width;
              
              const existing = dimensions.find(d => 
                d.room.toLowerCase() === roomName.toLowerCase()
              );
              
              if (!existing) {
                dimensions.push({
                  room: normalizeRoomName(roomName),
                  length_m: Math.round(length * 100) / 100,
                  width_m: Math.round(width * 100) / 100,
                  area_sqm: Math.round(area * 100) / 100,
                  rawText: context.substring(0, 100),
                  confidence: 0.8,
                });
              }
            }
          }
        }
      }
    }
  }
  
  return dimensions;
}

function normalizeRoomName(name: string): string {
  const mappings: Record<string, string> = {
    'living room': 'living_room',
    'lounge': 'living_room',
    'sitting room': 'living_room',
    'kitchen dining': 'kitchen_dining',
    'kitchen/dining': 'kitchen_dining',
    'kitchen': 'kitchen',
    'bedroom 1': 'bedroom_1',
    'master bedroom': 'bedroom_1',
    'main bedroom': 'bedroom_1',
    'bedroom 2': 'bedroom_2',
    'bedroom 3': 'bedroom_3',
    'bedroom 4': 'bedroom_4',
    'bathroom': 'bathroom',
    'ensuite': 'ensuite',
    'en-suite': 'ensuite',
    'en suite': 'ensuite',
    'utility': 'utility',
    'utility room': 'utility',
    'garage': 'garage',
    'hall': 'entrance_hall',
    'entrance hall': 'entrance_hall',
    'hallway': 'entrance_hall',
    'landing': 'landing',
    'upper landing': 'landing',
    'dining room': 'dining_room',
    'dining area': 'dining_room',
    'study': 'study',
    'office': 'study',
    'home office': 'study',
    'wc': 'toilet',
    'toilet': 'toilet',
    'cloakroom': 'toilet',
  };
  
  const lower = name.toLowerCase().trim();
  return mappings[lower] || lower.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

async function extractTextFromPDFPage(buffer: Buffer, pageNum: number): Promise<{ text: string; confidence: number }> {
  try {
    const uint8Array = new Uint8Array(buffer);
    const pdf = await getDocumentProxy(uint8Array);
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
    
    const result = await Tesseract.recognize(imageBuffer, 'eng', {
      logger: (m: any) => {
        if (m.status === 'recognizing text' && m.progress % 0.25 < 0.01) {
          process.stdout.write(`\r  OCR page ${pageNum}: ${Math.round(m.progress * 100)}%`);
        }
      },
    });
    
    return {
      text: result.data.text.trim(),
      confidence: result.data.confidence,
    };
  } catch (error) {
    console.error(`  OCR page ${pageNum} failed:`, error);
    return { text: '', confidence: 0 };
  }
}

async function extractWithVision(buffer: Buffer, fileName: string, maxPages: number = 3): Promise<{ text: string; dimensions: RoomDimensionExtraction[] }> {
  console.log('  Attempting GPT-4o Vision extraction...');
  
  try {
    const uint8Array = new Uint8Array(buffer);
    const pdf = await getDocumentProxy(uint8Array);
    const numPages = Math.min(pdf.numPages, maxPages);
    
    const allText: string[] = [];
    const allDimensions: RoomDimensionExtraction[] = [];
    
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });
      
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');
      
      await (page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      } as any) as any).promise;
      
      const imageBuffer = canvas.toBuffer('image/png');
      const base64Image = imageBuffer.toString('base64');
      
      const response = await getOpenAI().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a document analysis assistant. Extract all readable text from this document image. 
If this appears to be a floor plan or architectural drawing, also extract room dimensions in the format:
ROOM: [room name]
DIMENSIONS: [length]m x [width]m

Be thorough and extract ALL text visible, including small labels and annotations.`
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
                text: `Extract all text and room dimensions from page ${pageNum} of ${fileName}.`,
              },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1,
      });
      
      const extractedText = response.choices[0].message.content || '';
      allText.push(`--- Page ${pageNum} ---\n${extractedText}`);
      
      const pageDimensions = extractRoomDimensions(extractedText);
      allDimensions.push(...pageDimensions);
    }
    
    return {
      text: allText.join('\n\n'),
      dimensions: allDimensions,
    };
  } catch (error) {
    console.error('  Vision extraction failed:', error);
    return { text: '', dimensions: [] };
  }
}

export async function enhancedExtractText(
  buffer: Buffer,
  fileName: string,
  options: {
    forceOCR?: boolean;
    useVision?: boolean;
    maxVisionPages?: number;
  } = {}
): Promise<EnhancedOCRResult> {
  const { forceOCR = false, useVision = false, maxVisionPages = 3 } = options;
  
  console.log(`\n📄 ENHANCED TEXT EXTRACTION: ${fileName}`);
  console.log('='.repeat(60));
  
  const contentHash = getContentHash(buffer);
  const failures: DocumentFailure[] = [];
  
  let textLayerText = '';
  let ocrText = '';
  let visionText = '';
  let totalPages = 0;
  let ocrConfidence = 0;
  
  if (!forceOCR) {
    try {
      console.log('  Step 1: Text layer extraction...');
      const uint8Array = new Uint8Array(buffer);
      const pdf = await getDocumentProxy(uint8Array);
      const result = await extractText(pdf, { mergePages: true });
      textLayerText = result.text.trim();
      totalPages = result.totalPages;
      console.log(`  Text layer: ${textLayerText.length} chars from ${totalPages} pages`);
    } catch (error) {
      console.log(`  Text layer extraction failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      failures.push({
        page: 0,
        error: `Text layer failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        timestamp: new Date().toISOString(),
      });
    }
  }
  
  const needsOCR = forceOCR || !textLayerText || textLayerText.length < 50;
  
  if (needsOCR) {
    const cached = await checkOCRCache(contentHash);
    if (cached) {
      ocrText = cached.text;
      ocrConfidence = cached.confidence;
      console.log(`  OCR (cached): ${ocrText.length} chars, ${ocrConfidence.toFixed(1)}% confidence`);
    } else {
      console.log('  Step 2: OCR extraction...');
      
      try {
        const uint8Array = new Uint8Array(buffer);
        const pdf = await getDocumentProxy(uint8Array);
        const numPages = pdf.numPages;
        totalPages = numPages;
        
        const pageTexts: string[] = [];
        let totalConf = 0;
        let processedPages = 0;
        
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          try {
            const pageResult = await extractTextFromPDFPage(buffer, pageNum);
            if (pageResult.text) {
              pageTexts.push(`--- Page ${pageNum} ---\n${pageResult.text}`);
              totalConf += pageResult.confidence;
              processedPages++;
            }
            console.log(`  Page ${pageNum}/${numPages}: ${pageResult.text.length} chars`);
          } catch (pageError) {
            failures.push({
              page: pageNum,
              error: `OCR page ${pageNum} failed: ${pageError instanceof Error ? pageError.message : 'Unknown'}`,
              timestamp: new Date().toISOString(),
            });
          }
        }
        
        ocrText = pageTexts.join('\n\n');
        ocrConfidence = processedPages > 0 ? totalConf / processedPages : 0;
        
        if (ocrText) {
          setOCRCache(contentHash, ocrText, ocrConfidence);
        }
        
        console.log(`  OCR complete: ${ocrText.length} chars, ${ocrConfidence.toFixed(1)}% avg confidence`);
      } catch (ocrError) {
        console.error('  OCR extraction failed:', ocrError);
        failures.push({
          page: 0,
          error: `OCR failed: ${ocrError instanceof Error ? ocrError.message : 'Unknown'}`,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }
  
  const combinedTextLength = (textLayerText?.length || 0) + (ocrText?.length || 0);
  const useVisionForThis = useVision || (combinedTextLength < 100 && process.env.OPENAI_API_KEY);
  
  if (useVisionForThis && combinedTextLength < 500) {
    console.log('  Step 3: GPT-4o Vision extraction (low text detected)...');
    const visionResult = await extractWithVision(buffer, fileName, maxVisionPages);
    visionText = visionResult.text;
    console.log(`  Vision: ${visionText.length} chars, ${visionResult.dimensions.length} dimensions found`);
  }
  
  console.log('  Step 4: Merging and normalizing text...');
  
  let mergedText: string;
  let extractionMethod: 'text' | 'ocr' | 'merged' | 'vision';
  
  if (visionText && visionText.length > Math.max(textLayerText.length, ocrText.length)) {
    mergedText = normalizeOCRText(visionText);
    extractionMethod = 'vision';
  } else if (textLayerText && ocrText && textLayerText.length > 50 && ocrText.length > 50) {
    mergedText = normalizeOCRText(deduplicateLines(textLayerText, ocrText));
    extractionMethod = 'merged';
  } else if (ocrText && ocrText.length > textLayerText.length) {
    mergedText = normalizeOCRText(ocrText);
    extractionMethod = 'ocr';
  } else {
    mergedText = normalizeOCRText(textLayerText);
    extractionMethod = 'text';
  }
  
  console.log('  Step 5: Extracting room dimensions...');
  const roomDimensions = extractRoomDimensions(mergedText);
  console.log(`  Found ${roomDimensions.length} room dimensions`);
  
  if (roomDimensions.length > 0) {
    for (const dim of roomDimensions) {
      console.log(`    ${dim.room}: ${dim.length_m}m x ${dim.width_m}m = ${dim.area_sqm}m²`);
    }
  }
  
  console.log('');
  console.log('  EXTRACTION SUMMARY:');
  console.log(`    Method: ${extractionMethod}`);
  console.log(`    Text layer: ${textLayerText.length} chars`);
  console.log(`    OCR: ${ocrText.length} chars (${ocrConfidence.toFixed(1)}% confidence)`);
  console.log(`    Vision: ${visionText.length} chars`);
  console.log(`    Merged: ${mergedText.length} chars`);
  console.log(`    Room dimensions: ${roomDimensions.length}`);
  console.log(`    Failures: ${failures.length}`);
  console.log('='.repeat(60));
  
  return {
    text: mergedText,
    textLayerText,
    ocrText,
    mergedText,
    confidence: ocrConfidence,
    pageCount: totalPages,
    extractionMethod,
    roomDimensions,
    documentFailures: failures,
  };
}

export async function logDocumentFailure(
  documentId: string,
  tenantId: string,
  error: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO document_processing_logs (
        document_id,
        tenant_id,
        event_type,
        message,
        details,
        created_at
      ) VALUES (
        ${documentId}::uuid,
        ${tenantId}::uuid,
        'ocr_failure',
        ${error},
        ${JSON.stringify(details || {})}::jsonb,
        NOW()
      )
    `);
    console.log(`  Logged document failure: ${documentId}`);
  } catch (e) {
    console.error('  Failed to log document failure:', e);
  }
}

export { normalizeOCRText, deduplicateLines, extractRoomDimensions, normalizeRoomName };
