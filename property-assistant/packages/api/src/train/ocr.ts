import Tesseract from 'tesseract.js';
import { getDocumentProxy } from 'unpdf';
import { createCanvas } from 'canvas';

interface OCRResult {
  text: string;
  confidence: number;
  pageCount: number;
}

export async function extractTextWithOCR(buffer: Buffer, fileName: string): Promise<OCRResult> {
  console.log(`🔍 OCR: Starting OCR extraction for ${fileName}`);
  
  try {
    const uint8Array = new Uint8Array(buffer);
    const pdf = await getDocumentProxy(uint8Array);
    const numPages = pdf.numPages;
    
    console.log(`🔍 OCR: PDF has ${numPages} pages`);
    
    const allTexts: string[] = [];
    let totalConfidence = 0;
    let processedPages = 0;
    
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      console.log(`🔍 OCR: Processing page ${pageNum}/${numPages}...`);
      
      try {
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
            if (m.status === 'recognizing text') {
              process.stdout.write(`\r🔍 OCR: Page ${pageNum} - ${Math.round(m.progress * 100)}%`);
            }
          },
        });
        
        console.log('');
        
        const pageText = result.data.text.trim();
        const pageConfidence = result.data.confidence;
        
        if (pageText) {
          allTexts.push(`--- Page ${pageNum} ---\n${pageText}`);
          totalConfidence += pageConfidence;
          processedPages++;
        }
        
        console.log(`✅ OCR: Page ${pageNum} complete - ${pageText.length} chars, ${pageConfidence.toFixed(1)}% confidence`);
      } catch (pageError) {
        console.error(`⚠️ OCR: Failed to process page ${pageNum}:`, pageError);
      }
    }
    
    const combinedText = allTexts.join('\n\n');
    const avgConfidence = processedPages > 0 ? totalConfidence / processedPages : 0;
    
    console.log(`✅ OCR: Complete - ${combinedText.length} total chars, ${avgConfidence.toFixed(1)}% avg confidence`);
    
    return {
      text: combinedText,
      confidence: avgConfidence,
      pageCount: numPages,
    };
  } catch (error) {
    console.error('❌ OCR: Failed:', error);
    throw new Error(`OCR extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function cleanOCRText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/^\s+|\s+$/gm, '')
    .trim();
}
