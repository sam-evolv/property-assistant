import Tesseract from 'tesseract.js';
import { getDocumentProxy } from 'unpdf';

let createCanvas: ((width: number, height: number) => any) | null = null;

async function loadCanvas(): Promise<typeof createCanvas> {
  if (!createCanvas) {
    try {
      const canvasModule = await import('canvas');
      createCanvas = canvasModule.createCanvas;
    } catch (error) {
      createCanvas = null;
    }
  }
  return createCanvas;
}

interface OCRResult {
  text: string;
  confidence: number;
  pageCount: number;
}

export async function extractTextWithOCR(buffer: Buffer, fileName: string): Promise<OCRResult> {
  const canvasFn = await loadCanvas();
  if (!canvasFn) {
    return { text: '', confidence: 0, pageCount: 0 };
  }
  
  try {
    const uint8Array = new Uint8Array(buffer);
    const pdf = await getDocumentProxy(uint8Array);
    const numPages = pdf.numPages;
    
    const allTexts: string[] = [];
    let totalConfidence = 0;
    let processedPages = 0;
    
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });
        
        const canvas = canvasFn(viewport.width, viewport.height);
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
        
        const pageText = result.data.text.trim();
        const pageConfidence = result.data.confidence;
        
        if (pageText) {
          allTexts.push(`--- Page ${pageNum} ---\n${pageText}`);
          totalConfidence += pageConfidence;
          processedPages++;
        }
        
      } catch (pageError) {
      }
    }
    
    const combinedText = allTexts.join('\n\n');
    const avgConfidence = processedPages > 0 ? totalConfidence / processedPages : 0;
    
    return {
      text: combinedText,
      confidence: avgConfidence,
      pageCount: numPages,
    };
  } catch (error) {
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
