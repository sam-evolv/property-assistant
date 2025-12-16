#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://portal.openhouseai.ie';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface UnitData {
  id: string;
  address: string | null;
}

function extractNumericPart(value: string | null | undefined): number {
  if (!value) return Infinity;
  const match = value.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : Infinity;
}

function getDisplayAddress(unit: UnitData): string {
  return unit.address || unit.id;
}

function sortUnits(units: UnitData[]): UnitData[] {
  return [...units].sort((a, b) => {
    const aDisplay = getDisplayAddress(a);
    const bDisplay = getDisplayAddress(b);
    const aNum = extractNumericPart(aDisplay);
    const bNum = extractNumericPart(bDisplay);
    if (aNum !== bNum) return aNum - bNum;
    return aDisplay.localeCompare(bDisplay);
  });
}

async function generateQRCodePNG(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    QRCode.toBuffer(url, {
      type: 'png',
      width: 360,
      margin: 2,
      errorCorrectionLevel: 'M',
    }, (err, buffer) => {
      if (err) reject(err);
      else resolve(buffer);
    });
  });
}

function loadTemplate(): string {
  const templatePath = path.join(process.cwd(), 'assets/qr-pack/longview-template.txt');
  return fs.readFileSync(templatePath, 'utf-8');
}

const SECTION_HEADINGS = [
  'Longview Park Digital Property Assistant',
  'Welcome',
  'What It Can Help With',
  'Beta Notice',
  'Important Information',
  'Privacy & Use',
  'Final Note',
  'Questions?',
];

async function generateQRPack(projectId: string, outputPath: string): Promise<void> {
  console.log('[QR Pack CLI] Starting generation for projectId:', projectId);
  console.log('[QR Pack CLI] Base URL:', BASE_URL);

  const { data: units, error: unitsError } = await supabase
    .from('units')
    .select('id, address')
    .eq('project_id', projectId);

  if (unitsError) {
    throw new Error('Failed to fetch units: ' + unitsError.message);
  }

  if (!units || units.length === 0) {
    throw new Error('No units found for this project');
  }

  console.log('[QR Pack CLI] Found', units.length, 'units');

  const sortedUnits = sortUnits(units);
  const template = loadTemplate();
  const templateLines = template.split('\n');

  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginLeft = 50;
  const marginRight = 50;
  const marginTop = 50;
  const contentWidth = pageWidth - marginLeft - marginRight;

  for (const unit of sortedUnits) {
    console.log(`[QR Pack CLI] Processing unit: ${getDisplayAddress(unit)}`);
    
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - marginTop;

    const qrUrl = `${BASE_URL}/units/${unit.id}`;
    const qrBuffer = await generateQRCodePNG(qrUrl);
    const qrImage = await pdfDoc.embedPng(qrBuffer);
    const qrSize = 200;

    for (const line of templateLines) {
      const trimmedLine = line.trim();

      if (trimmedLine === '{{HOUSE_ADDRESS}}') {
        y -= 8;
        page.drawText(getDisplayAddress(unit), {
          x: marginLeft,
          y,
          size: 14,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        });
        y -= 24;
        continue;
      }

      if (trimmedLine === '{{QR_CODE}}') {
        y -= 20;
        const qrX = marginLeft + (contentWidth - qrSize) / 2;
        page.drawImage(qrImage, {
          x: qrX,
          y: y - qrSize,
          width: qrSize,
          height: qrSize,
        });
        y -= qrSize + 30;
        continue;
      }

      if (trimmedLine === '') {
        y -= 8;
        continue;
      }

      const isHeading = SECTION_HEADINGS.includes(trimmedLine);
      const isBullet = trimmedLine.startsWith('-');

      if (isHeading) {
        y -= 6;
        const fontSize = trimmedLine === 'Longview Park Digital Property Assistant' ? 18 : 12;
        page.drawText(trimmedLine, {
          x: marginLeft,
          y,
          size: fontSize,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        });
        y -= fontSize + 8;
      } else if (isBullet) {
        const bulletText = '\u2022 ' + trimmedLine.slice(1).trim();
        page.drawText(bulletText, {
          x: marginLeft + 10,
          y,
          size: 9,
          font: helvetica,
          color: rgb(0.2, 0.2, 0.2),
        });
        y -= 14;
      } else {
        const words = trimmedLine.split(' ');
        let currentLine = '';
        const maxWidth = contentWidth;
        const fontSize = 9;

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const testWidth = helvetica.widthOfTextAtSize(testLine, fontSize);

          if (testWidth > maxWidth && currentLine) {
            page.drawText(currentLine, {
              x: marginLeft,
              y,
              size: fontSize,
              font: helvetica,
              color: rgb(0.2, 0.2, 0.2),
            });
            y -= 14;
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }

        if (currentLine) {
          page.drawText(currentLine, {
            x: marginLeft,
            y,
            size: fontSize,
            font: helvetica,
            color: rgb(0.2, 0.2, 0.2),
          });
          y -= 14;
        }
      }

      if (y < 60) break;
    }
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, Buffer.from(pdfBytes));
  
  console.log('[QR Pack CLI] Generated PDF with', sortedUnits.length, 'pages');
  console.log('[QR Pack CLI] Output saved to:', outputPath);
}

async function main() {
  const args = process.argv.slice(2);
  let projectId: string | undefined;
  let outputPath = 'LongviewPark_QR_Pack.pdf';

  for (const arg of args) {
    if (arg.startsWith('--projectId=')) {
      projectId = arg.split('=')[1];
    } else if (arg.startsWith('--output=')) {
      outputPath = arg.split('=')[1];
    }
  }

  if (!projectId) {
    console.error('Usage: npx tsx scripts/generate-qr-pack.ts --projectId=<id> [--output=<file.pdf>]');
    console.error('');
    console.error('Required environment variables:');
    console.error('  NEXT_PUBLIC_SUPABASE_URL');
    console.error('  SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: Missing required environment variables');
    console.error('  NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'MISSING');
    console.error('  SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING');
    process.exit(1);
  }

  try {
    await generateQRPack(projectId, outputPath);
    console.log('[QR Pack CLI] Success!');
  } catch (error: any) {
    console.error('[QR Pack CLI] Error:', error.message);
    process.exit(1);
  }
}

main();
