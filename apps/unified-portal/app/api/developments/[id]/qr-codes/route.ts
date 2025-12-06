import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { developments, units } from '@openhouse/db/schema';
import { eq, and } from 'drizzle-orm';
import { signQRToken } from '@openhouse/api/qr-tokens';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const developmentId = params.id;
    
    const development = await db.query.developments.findFirst({
      where: eq(developments.id, developmentId),
    });

    if (!development) {
      return NextResponse.json({ error: 'Development not found' }, { status: 404 });
    }

    const developmentUnits = await db
      .select()
      .from(units)
      .where(
        and(
          eq(units.development_id, developmentId),
          eq(units.tenant_id, development.tenant_id)
        )
      )
      .orderBy(units.unit_number);

    if (developmentUnits.length === 0) {
      return NextResponse.json(
        { error: 'No units found for this development' },
        { status: 404 }
      );
    }

    console.log(`[QR Codes] Generating QR codes for ${developmentUnits.length} units in ${development.name}`);

    const qrData: Array<{
      unitNumber: string;
      address: string | null;
      houseType: string | null;
      url: string;
      qrDataUrl: string;
      purchaserName: string;
    }> = [];

    const batchSize = 10;
    for (let i = 0; i < developmentUnits.length; i += batchSize) {
      const batch = developmentUnits.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (unit) => {
          // Generate token using unit.id as supabaseUnitId and developmentId as projectId
          // This maintains compatibility with the new token format
          const tokenData = signQRToken({
            supabaseUnitId: unit.id,
            projectId: developmentId,
          });

          const qrDataUrl = await QRCode.toDataURL(tokenData.url, {
            width: 300,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF',
            },
          });

          return {
            unitNumber: unit.unit_number,
            address: unit.address_line_1,
            houseType: unit.house_type_code,
            url: tokenData.url,
            qrDataUrl,
            purchaserName: unit.purchaser_name || 'Homeowner',
          };
        })
      );
      qrData.push(...batchResults);
      console.log(`[QR Codes] Processed ${qrData.length}/${developmentUnits.length} units`);
    }

    const pdf = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      autoFirstPage: false,
    });

    const chunks: Buffer[] = [];
    pdf.on('data', (chunk) => chunks.push(chunk));
    
    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      pdf.on('end', () => resolve(Buffer.concat(chunks)));
      pdf.on('error', reject);
    });

    // A4 dimensions in points
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 40;
    const gap = 20;
    
    // Calculate card dimensions for 2x2 grid (4 cards per page)
    const cardWidth = (pageWidth - margin * 2 - gap) / 2;
    const cardHeight = (pageHeight - margin * 2 - gap) / 2;
    
    const CARDS_PER_PAGE = 4;

    // Helper function to add page header
    const addPageHeader = (pageNumber: number, totalPages: number) => {
      pdf
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#999')
        .text(
          `${development.name || 'Development'} - QR Codes (Page ${pageNumber}/${totalPages})`,
          margin,
          20,
          {
            align: 'center',
            width: pageWidth - margin * 2,
          }
        );
    };

    // Calculate total pages needed
    const totalPages = Math.ceil(qrData.length / CARDS_PER_PAGE);

    for (let i = 0; i < qrData.length; i++) {
      const unit = qrData[i];
      const cardIndex = i % CARDS_PER_PAGE; // 0-3 position on current page
      const pageNumber = Math.floor(i / CARDS_PER_PAGE) + 1;

      // Add new page when starting a new set of 4
      if (cardIndex === 0) {
        pdf.addPage();
        addPageHeader(pageNumber, totalPages);
      }

      // Calculate position in 2x2 grid
      const row = Math.floor(cardIndex / 2); // 0 or 1
      const col = cardIndex % 2; // 0 or 1
      
      const xPosition = margin + col * (cardWidth + gap);
      const yPosition = margin + 30 + row * (cardHeight + gap); // 30px offset for header

      // Draw card border with gold accent
      pdf
        .save()
        .roundedRect(xPosition, yPosition, cardWidth, cardHeight, 8)
        .lineWidth(2)
        .strokeColor('#D4AF37')
        .stroke()
        .restore();

      // Draw header section
      pdf
        .save()
        .rect(xPosition, yPosition, cardWidth, 50)
        .fillAndStroke('#F8F8F8', '#D4AF37')
        .restore();

      // Unit number and address
      const textX = xPosition + 15;
      let textY = yPosition + 12;

      pdf
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#000')
        .text('Unit:', textX, textY, { continued: true })
        .font('Helvetica')
        .text(` ${unit.unitNumber}`, { width: cardWidth - 30 });

      textY += 18;
      pdf
        .fontSize(8)
        .fillColor('#666')
        .text(unit.address || 'Address not set', textX, textY, {
          width: cardWidth - 30,
          ellipsis: true,
        });

      // QR code centered in remaining space
      const qrSize = Math.min(cardWidth * 0.6, 140); // Responsive QR size
      const qrX = xPosition + (cardWidth - qrSize) / 2;
      const qrY = yPosition + 65;

      pdf.image(unit.qrDataUrl, qrX, qrY, {
        width: qrSize,
        height: qrSize,
      });

      // Footer text
      textY = qrY + qrSize + 12;

      pdf
        .fontSize(8)
        .font('Helvetica-Bold')
        .fillColor('#D4AF37')
        .text('Scan to access your home assistant', textX, textY, {
          align: 'center',
          width: cardWidth - 30,
        });

      textY += 15;
      pdf
        .fontSize(7)
        .font('Helvetica')
        .fillColor('#666')
        .text(`Type: ${unit.houseType || 'N/A'} | ${unit.purchaserName}`, textX, textY, {
          align: 'center',
          width: cardWidth - 30,
          ellipsis: true,
        });
    }

    pdf.end();

    const pdfBuffer = await pdfPromise;

    console.log(`[QR Codes] Generated PDF with ${qrData.length} QR codes (${pdfBuffer.length} bytes)`);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${development.code || 'development'}-qr-codes.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('[QR Codes API] Error generating QR codes:', error);
    return NextResponse.json(
      { error: 'Failed to generate QR codes' },
      { status: 500 }
    );
  }
}
