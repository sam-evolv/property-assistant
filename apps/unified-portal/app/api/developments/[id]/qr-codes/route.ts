import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REAL_PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';
const BASE_URL = 'https://84141d02-f316-41eb-8d70-a45b1b91c63c-00-140og66wspdkl.riker.replit.dev';

const GOLD = '#D4AF37';

interface UnitData {
  id: string;
  address?: string;
  purchaser_name?: string;
  unit_number?: number;
  unit_types?: {
    name?: string;
    bedrooms?: number;
    specification_json?: any;
  };
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    console.log(`[QR] Generating premium QR cards for project: ${REAL_PROJECT_ID}`);

    // Query units with unit_types join from Supabase using service role key
    const { data: units, error } = await supabase
      .from('units')
      .select(`
        id,
        address,
        purchaser_name,
        unit_number,
        unit_types (
          name,
          bedrooms,
          specification_json
        )
      `)
      .eq('project_id', REAL_PROJECT_ID)
      .order('unit_number', { ascending: true });

    if (error) {
      console.error('[QR] Supabase Error:', error);
      throw error;
    }

    if (!units || units.length === 0) {
      console.log('[QR] No units found for project');
      return NextResponse.json({ error: 'No units found for this project.' }, { status: 404 });
    }

    console.log(`[QR] Found ${units.length} units, generating premium PDF...`);

    // Create PDF with premium gold card design
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 12;
    const cardWidth = (pageWidth - margin * 3) / 2;
    const cardHeight = 130;
    const cardsPerRow = 2;
    const cardsPerPage = 4;
    
    for (let i = 0; i < units.length; i++) {
      const unit = units[i] as UnitData;
      const pageIndex = Math.floor(i / cardsPerPage);
      const positionOnPage = i % cardsPerPage;
      const row = Math.floor(positionOnPage / cardsPerRow);
      const col = positionOnPage % cardsPerRow;

      if (i > 0 && positionOnPage === 0) {
        doc.addPage();
      }

      const x = margin + col * (cardWidth + margin);
      const y = margin + row * (cardHeight + margin);

      // Card background (white)
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, cardWidth, cardHeight, 4, 4, 'F');

      // Gold border (thick)
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(1.2);
      doc.roundedRect(x, y, cardWidth, cardHeight, 4, 4, 'S');

      // Inner gold accent line
      doc.setLineWidth(0.3);
      doc.roundedRect(x + 3, y + 3, cardWidth - 6, cardHeight - 6, 3, 3, 'S');

      // Unit Header (e.g., "Unit: 1")
      const unitNum = unit.unit_number || (i + 1);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(26, 26, 26);
      doc.text(`Unit: ${unitNum}`, x + cardWidth / 2, y + 16, { align: 'center' });

      // Purchaser Name (subheader)
      const purchaserName = unit.purchaser_name || 'Homeowner';
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      const truncatedName = purchaserName.length > 25 ? purchaserName.substring(0, 25) + '...' : purchaserName;
      doc.text(truncatedName, x + cardWidth / 2, y + 24, { align: 'center' });

      // Generate QR code
      const qrUrl = `${BASE_URL}/homes/${unit.id}`;
      try {
        const qrDataUrl = await QRCode.toDataURL(qrUrl, {
          width: 200,
          margin: 1,
          color: {
            dark: '#1A1A1A',
            light: '#FFFFFF'
          }
        });
        
        const qrSize = 55;
        const qrX = x + (cardWidth - qrSize) / 2;
        const qrY = y + 30;
        doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
      } catch (qrError) {
        console.error('[QR] Failed to generate QR for unit:', unit.id, qrError);
        doc.setFillColor(240, 240, 240);
        doc.rect(x + (cardWidth - 55) / 2, y + 30, 55, 55, 'F');
        doc.setFontSize(8);
        doc.text('QR Error', x + cardWidth / 2, y + 58, { align: 'center' });
      }

      // House Type + Beds footer (e.g., "BD01 | 3 Bedroom")
      const unitType = unit.unit_types;
      const typeName = unitType?.name || 'Standard';
      const bedrooms = unitType?.bedrooms;
      const bedroomText = bedrooms ? `${bedrooms} Bedroom` : '';
      const footerText = bedroomText ? `${typeName} | ${bedroomText}` : typeName;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(212, 175, 55); // Gold text
      doc.text(footerText, x + cardWidth / 2, y + 95, { align: 'center' });

      // "Scan to access" text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('Scan to access home assistant', x + cardWidth / 2, y + 103, { align: 'center' });

      // Address (small, at bottom)
      if (unit.address) {
        doc.setFontSize(7);
        doc.setTextColor(130, 130, 130);
        const truncatedAddr = unit.address.length > 35 ? unit.address.substring(0, 35) + '...' : unit.address;
        doc.text(truncatedAddr, x + cardWidth / 2, y + 110, { align: 'center' });
      }

      // Bottom decorative gold line
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.5);
      doc.line(x + 15, y + cardHeight - 10, x + cardWidth - 15, y + cardHeight - 10);
    }

    // Footer on last page
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generated ${new Date().toLocaleDateString()} • ${units.length} units • OpenHouse AI`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );

    const pdfBuffer = doc.output('arraybuffer');

    console.log(`[QR] Successfully generated premium PDF with ${units.length} gold cards`);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="qr-codes-premium-${units.length}-units.pdf"`,
      },
    });

  } catch (error: any) {
    console.error('[QR] Critical Failure:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate QR codes' }, { status: 500 });
  }
}
