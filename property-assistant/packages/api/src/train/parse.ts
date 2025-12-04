import mammoth from 'mammoth';
import { parse as csvParse } from 'csv-parse/sync';
import { TrainingItem } from './types';
import { getDocumentProxy, extractText } from 'unpdf';
import { extractTextWithOCR, cleanOCRText } from './ocr';
import { enhancedExtractText, RoomDimensionExtraction } from './enhanced-ocr';

const MIN_TEXT_LENGTH_FOR_OCR = 50;

export function detectFileType(fileName: string, mimeType?: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  if (ext === 'pdf' || mimeType === 'application/pdf') {
    return 'pdf';
  } else if (ext === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return 'docx';
  } else if (ext === 'csv' || mimeType === 'text/csv') {
    return 'csv';
  } else if (ext === 'json' || mimeType === 'application/json') {
    return 'json';
  } else if (ext === 'txt' || mimeType === 'text/plain') {
    return 'text';
  } else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff'].includes(ext || '')) {
    return 'image';
  } else if (mimeType?.startsWith('image/')) {
    return 'image';
  }
  
  return 'unknown';
}

export async function parsePDF(buffer: Buffer, tenantId: string, fileName: string): Promise<TrainingItem[]> {
  console.log(`📄 TRAIN API RECEIVED FILE: ${fileName}`);
  
  const result = await enhancedExtractText(buffer, fileName, {
    forceOCR: false,
    useVision: false,
    maxVisionPages: 3,
  });
  
  if (!result.text || result.text.length < 10) {
    console.log(`⚠️ Enhanced extraction returned minimal text, trying legacy OCR...`);
    
    try {
      const ocrResult = await extractTextWithOCR(buffer, fileName);
      
      if (ocrResult.text && ocrResult.text.length > result.text.length) {
        return [{
          tenantId,
          sourceType: 'pdf',
          title: fileName,
          text: cleanOCRText(ocrResult.text),
          metadata: {
            pages: ocrResult.pageCount,
            extractionMethod: 'ocr_legacy',
            confidence: ocrResult.confidence,
          },
        }];
      }
    } catch (ocrError) {
      console.error(`❌ Legacy OCR also failed:`, ocrError);
    }
    
    if (!result.text) {
      throw new Error('PDF contains no extractable text (all extraction methods failed)');
    }
  }
  
  const metadata: Record<string, any> = {
    pages: result.pageCount,
    extractionMethod: result.extractionMethod,
    confidence: result.confidence,
    textLayerLength: result.textLayerText.length,
    ocrLength: result.ocrText.length,
    failures: result.documentFailures,
  };
  
  if (result.roomDimensions.length > 0) {
    metadata.roomDimensions = result.roomDimensions;
    console.log(`📐 Extracted ${result.roomDimensions.length} room dimensions from PDF`);
  }
  
  console.log(`✅ Final extraction: ${result.text.length} chars using ${result.extractionMethod}`);
  
  return [{
    tenantId,
    sourceType: 'pdf',
    title: fileName,
    text: result.text,
    metadata,
  }];
}

export async function parseDOCX(buffer: Buffer, tenantId: string, fileName: string): Promise<TrainingItem[]> {
  console.log(`📝 Parsing DOCX: ${fileName}`);
  
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();
    
    if (!text) {
      throw new Error('DOCX contains no extractable text');
    }
    
    return [{
      tenantId,
      sourceType: 'docx',
      title: fileName,
      text,
      metadata: {
        warnings: result.messages,
      },
    }];
  } catch (error) {
    console.error('❌ DOCX parsing error:', error);
    throw new Error(`Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function parseCSV(buffer: Buffer, tenantId: string, fileName: string): Promise<TrainingItem[]> {
  console.log(`📊 Parsing CSV: ${fileName}`);
  
  try {
    const content = buffer.toString('utf-8');
    const records = csvParse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    
    if (!records || records.length === 0) {
      throw new Error('CSV contains no data');
    }
    
    const items: TrainingItem[] = records.map((record: any, index: number) => {
      const text = Object.entries(record)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      
      return {
        tenantId,
        sourceType: 'csv',
        title: `${fileName} - Row ${index + 1}`,
        text,
        metadata: {
          rowIndex: index,
          ...record,
        },
      };
    });
    
    console.log(`✅ Parsed ${items.length} rows from CSV`);
    return items;
  } catch (error) {
    console.error('❌ CSV parsing error:', error);
    throw new Error(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function parseJSON(buffer: Buffer, tenantId: string, fileName: string): Promise<TrainingItem[]> {
  console.log(`🔷 Parsing JSON: ${fileName}`);
  
  try {
    const content = buffer.toString('utf-8');
    const data = JSON.parse(content);
    
    const items: TrainingItem[] = [];
    
    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        const text = JSON.stringify(item, null, 2);
        items.push({
          tenantId,
          sourceType: 'json',
          title: `${fileName} - Item ${index + 1}`,
          text,
          metadata: {
            itemIndex: index,
            ...item,
          },
        });
      });
    } else {
      const text = JSON.stringify(data, null, 2);
      items.push({
        tenantId,
        sourceType: 'json',
        title: fileName,
        text,
        metadata: data,
      });
    }
    
    console.log(`✅ Parsed ${items.length} items from JSON`);
    return items;
  } catch (error) {
    console.error('❌ JSON parsing error:', error);
    throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function parseText(buffer: Buffer, tenantId: string, fileName: string): Promise<TrainingItem[]> {
  console.log(`📝 Parsing text file: ${fileName}`);
  
  const text = buffer.toString('utf-8').trim();
  
  if (!text) {
    throw new Error('Text file is empty');
  }
  
  return [{
    tenantId,
    sourceType: 'faq',
    title: fileName,
    text,
    metadata: {
      fileType: 'text',
    },
  }];
}

export async function parseImage(buffer: Buffer, tenantId: string, fileName: string): Promise<TrainingItem[]> {
  console.log(`🖼️ Parsing image file: ${fileName}`);
  
  try {
    const Tesseract = (await import('tesseract.js')).default;
    
    const result = await Tesseract.recognize(buffer, 'eng', {
      logger: (m: any) => {
        if (m.status === 'recognizing text') {
          process.stdout.write(`\r  OCR: ${Math.round(m.progress * 100)}%`);
        }
      },
    });
    
    console.log('');
    
    const text = result.data.text.trim();
    const confidence = result.data.confidence;
    
    if (!text || text.length < 10) {
      console.log(`⚠️ Image OCR returned minimal text (${text.length} chars)`);
      return [{
        tenantId,
        sourceType: 'image',
        title: fileName,
        text: `[Image file: ${fileName}]`,
        metadata: {
          fileType: 'image',
          extractionMethod: 'ocr_failed',
          confidence: 0,
          note: 'Image contains no extractable text',
        },
      }];
    }
    
    const { extractRoomDimensions } = await import('./enhanced-ocr');
    const roomDimensions = extractRoomDimensions(text);
    
    console.log(`✅ Image OCR: ${text.length} chars, ${confidence.toFixed(1)}% confidence`);
    if (roomDimensions.length > 0) {
      console.log(`📐 Found ${roomDimensions.length} room dimensions`);
    }
    
    return [{
      tenantId,
      sourceType: 'image',
      title: fileName,
      text,
      metadata: {
        fileType: 'image',
        extractionMethod: 'ocr',
        confidence,
        roomDimensions: roomDimensions.length > 0 ? roomDimensions : undefined,
      },
    }];
  } catch (error) {
    console.error(`❌ Image OCR failed:`, error);
    return [{
      tenantId,
      sourceType: 'image',
      title: fileName,
      text: `[Image file: ${fileName} - OCR failed]`,
      metadata: {
        fileType: 'image',
        extractionMethod: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    }];
  }
}

export async function parseFile(
  buffer: Buffer,
  fileName: string,
  tenantId: string,
  mimeType?: string
): Promise<TrainingItem[]> {
  const detectedType = detectFileType(fileName, mimeType);
  
  console.log(`\n📥 Parsing file: ${fileName} (detected type: ${detectedType}, MIME: ${mimeType || 'unknown'})`);
  
  switch (detectedType) {
    case 'pdf':
      return parsePDF(buffer, tenantId, fileName);
    case 'docx':
      return parseDOCX(buffer, tenantId, fileName);
    case 'csv':
      return parseCSV(buffer, tenantId, fileName);
    case 'json':
      return parseJSON(buffer, tenantId, fileName);
    case 'text':
      return parseText(buffer, tenantId, fileName);
    case 'image':
      return parseImage(buffer, tenantId, fileName);
    default:
      console.log(`⚠️ Unsupported file type: ${detectedType}, attempting generic text extraction`);
      try {
        const text = buffer.toString('utf-8').trim();
        if (text && text.length > 10) {
          return [{
            tenantId,
            sourceType: 'unknown',
            title: fileName,
            text,
            metadata: {
              fileType: detectedType,
              mimeType: mimeType || 'unknown',
            },
          }];
        }
      } catch {}
      throw new Error(`Unsupported file type: ${detectedType} (file: ${fileName}, MIME: ${mimeType || 'unknown'})`);
  }
}
