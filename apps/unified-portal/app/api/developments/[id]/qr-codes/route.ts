import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const REAL_PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';
const BASE_URL = 'https://84141d02-f316-41eb-8d70-a45b1b91c63c-00-140og66wspdkl.riker.replit.dev';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = getSupabaseClient();
    console.log(`[QR] Generating for project: ${REAL_PROJECT_ID}`);

    // Simple query without join
    const { data: units, error } = await supabase
      .from('units')
      .select('id, address, purchaser_name, unit_type_id')
      .eq('project_id', REAL_PROJECT_ID)
      .order('address', { ascending: true });

    if (error) {
      console.error('[QR] Supabase Error:', error);
      throw error;
    }

    if (!units || units.length === 0) {
      return NextResponse.json({ error: 'No units found.' }, { status: 404 });
    }

    console.log(`[QR] Found ${units.length} units`);

    // Sort by address number
    const sortedUnits = [...units].sort((a, b) => {
      const numA = parseInt((a.address || '').replace(/\D/g, '')) || 0;
      const numB = parseInt((b.address || '').replace(/\D/g, '')) || 0;
      return numA - numB;
    });

    // Create premium PDF
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 12;
    const cardWidth = (pageWidth - margin * 3) / 2;
    const cardHeight = 125;
    const cardsPerRow = 2;
    const cardsPerPage = 4;

    for (let i = 0; i < sortedUnits.length; i++) {
      const unit = sortedUnits[i];
      const positionOnPage = i % cardsPerPage;
      const row = Math.floor(positionOnPage / cardsPerRow);
      const col = positionOnPage % cardsPerRow;

      if (i > 0 && positionOnPage === 0) {
        doc.addPage();
      }

      const x = margin + col * (cardWidth + margin);
      const y = margin + row * (cardHeight + margin);

      // White card background
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, cardWidth, cardHeight, 4, 4, 'F');

      // Gold border (#D4AF37)
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(1.2);
      doc.roundedRect(x, y, cardWidth, cardHeight, 4, 4, 'S');

      // Inner accent border
      doc.setLineWidth(0.3);
      doc.roundedRect(x + 3, y + 3, cardWidth - 6, cardHeight - 6, 3, 3, 'S');

      // HEADER: "Unit [Number]" (Bold)
      const unitNum = i + 1;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(26, 26, 26);
      doc.text(`Unit ${unitNum}`, x + cardWidth / 2, y + 16, { align: 'center' });

      // SUBHEADER: Purchaser Name
      const purchaserName = unit.purchaser_name || 'Homeowner';
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      const truncatedName = purchaserName.length > 28 ? purchaserName.substring(0, 28) + '...' : purchaserName;
      doc.text(truncatedName, x + cardWidth / 2, y + 25, { align: 'center' });

      // Generate QR Code
      const qrUrl = `${BASE_URL}/homes/${unit.id}`;
      try {
        const qrDataUrl = await QRCode.toDataURL(qrUrl, {
          width: 200,
          margin: 1,
          color: { dark: '#1A1A1A', light: '#FFFFFF' }
        });
        const qrSize = 55;
        doc.addImage(qrDataUrl, 'PNG', x + (cardWidth - qrSize) / 2, y + 32, qrSize, qrSize);
      } catch (qrErr) {
        console.error('[QR] QR generation failed for:', unit.id);
        doc.setFillColor(240, 240, 240);
        doc.rect(x + (cardWidth - 55) / 2, y + 32, 55, 55, 'F');
      }

      // FOOTER: Type/Address
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(212, 175, 55); // Gold
      doc.text('Home Assistant', x + cardWidth / 2, y + 97, { align: 'center' });

      // "Scan to access"
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('Scan to access your portal', x + cardWidth / 2, y + 105, { align: 'center' });

      // Address (small)
      if (unit.address) {
        doc.setFontSize(7);
        doc.setTextColor(130, 130, 130);
        const addr = unit.address.length > 35 ? unit.address.substring(0, 35) + '...' : unit.address;
        doc.text(addr, x + cardWidth / 2, y + 112, { align: 'center' });
      }

      // Bottom gold line
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.5);
      doc.line(x + 15, y + cardHeight - 8, x + cardWidth - 15, y + cardHeight - 8);
    }

    // Page footer
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generated ${new Date().toLocaleDateString()} • ${sortedUnits.length} units • OpenHouse AI`,
      pageWidth / 2, pageHeight - 8, { align: 'center' }
    );

    const pdfBuffer = doc.output('arraybuffer');
    console.log(`[QR] PDF generated with ${sortedUnits.length} cards`);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="qr-codes-${sortedUnits.length}-units.pdf"`,
      },
    });

  } catch (error: any) {
    console.error('[QR] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
