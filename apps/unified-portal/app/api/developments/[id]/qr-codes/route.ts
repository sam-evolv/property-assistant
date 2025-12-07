import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REAL_PROJECT_ID = '97dc3919-2726-4675-8046-9f79070ec88c';
const BASE_URL = 'https://84141d02-f316-41eb-8d70-a45b1b91c63c-00-140og66wspdkl.riker.replit.dev';

const GOLD = '#D4AF37';
const WHITE = '#FFFFFF';
const BLACK = '#1A1A1A';

interface UnitData {
  id: string;
  user_id?: string;
  unit_type_id?: string;
  project_id?: string;
  created_at?: string;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    console.log(`[QR] Generating premium QR cards for project: ${REAL_PROJECT_ID}`);

    // Query units from Supabase using service role key (bypasses RLS)
    const { data: units, error } = await supabase
      .from('units')
      .select('id, user_id, unit_type_id, project_id, created_at')
      .eq('project_id', REAL_PROJECT_ID);

    if (error) {
      console.error('[QR] Supabase Error:', error);
      throw error;
    }

    // Fallback: if no units match project_id, get all units
    let finalUnits: UnitData[] = units || [];
    if (finalUnits.length === 0) {
      console.log('[QR] No units for project_id, fetching all units...');
      const { data: allUnits, error: allError } = await supabase
        .from('units')
        .select('id, user_id, unit_type_id, project_id, created_at');
      
      if (allError) {
        console.error('[QR] Fallback query error:', allError);
      }
      finalUnits = allUnits || [];
    }

    if (finalUnits.length === 0) {
      console.log('[QR] No units found in Supabase');
      return NextResponse.json({ error: 'No units found in database.' }, { status: 404 });
    }

    console.log(`[QR] Found ${finalUnits.length} units, generating premium PDF...`);

    // Create PDF with premium gold card design
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 15;
    const cardWidth = (pageWidth - margin * 3) / 2; // 2 cards per row
    const cardHeight = 120;
    const cardsPerRow = 2;
    const cardsPerPage = 4; // 2x2 grid
    
    for (let i = 0; i < finalUnits.length; i++) {
      const unit = finalUnits[i];
      const pageIndex = Math.floor(i / cardsPerPage);
      const positionOnPage = i % cardsPerPage;
      const row = Math.floor(positionOnPage / cardsPerRow);
      const col = positionOnPage % cardsPerRow;

      // Add new page if needed
      if (i > 0 && positionOnPage === 0) {
        doc.addPage();
      }

      const x = margin + col * (cardWidth + margin);
      const y = margin + row * (cardHeight + margin);

      // Card background (white)
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'F');

      // Gold border (3pt thick)
      doc.setDrawColor(212, 175, 55); // #D4AF37
      doc.setLineWidth(1);
      doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'S');

      // Inner gold accent line
      doc.setLineWidth(0.3);
      doc.roundedRect(x + 2, y + 2, cardWidth - 4, cardHeight - 4, 2, 2, 'S');

      // Unit label (top, bold, black)
      const unitLabel = `Unit ${i + 1}`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(26, 26, 26); // #1A1A1A
      doc.text(unitLabel, x + cardWidth / 2, y + 15, { align: 'center' });

      // Unit ID (smaller, below label)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      const shortId = unit.id.substring(0, 8) + '...';
      doc.text(`ID: ${shortId}`, x + cardWidth / 2, y + 22, { align: 'center' });

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
        
        // QR code (centered)
        const qrSize = 50;
        const qrX = x + (cardWidth - qrSize) / 2;
        const qrY = y + 28;
        doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
      } catch (qrError) {
        console.error('[QR] Failed to generate QR for unit:', unit.id, qrError);
        // Draw placeholder
        doc.setFillColor(240, 240, 240);
        doc.rect(x + (cardWidth - 50) / 2, y + 28, 50, 50, 'F');
        doc.setFontSize(8);
        doc.text('QR Error', x + cardWidth / 2, y + 55, { align: 'center' });
      }

      // Gold accent text (bottom)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(212, 175, 55); // Gold text
      doc.text('Scan to access home assistant', x + cardWidth / 2, y + 88, { align: 'center' });

      // Small URL preview
      doc.setFontSize(6);
      doc.setTextColor(150, 150, 150);
      doc.text(qrUrl.substring(0, 40) + '...', x + cardWidth / 2, y + 95, { align: 'center' });

      // Bottom decorative gold line
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.5);
      doc.line(x + 15, y + cardHeight - 8, x + cardWidth - 15, y + cardHeight - 8);
    }

    // Add footer on last page
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generated ${new Date().toLocaleDateString()} • ${finalUnits.length} units • OpenHouse AI`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );

    const pdfBuffer = doc.output('arraybuffer');

    console.log(`[QR] Successfully generated premium PDF with ${finalUnits.length} gold cards`);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="qr-codes-premium-${finalUnits.length}-units.pdf"`,
      },
    });

  } catch (error: any) {
    console.error('[QR] Critical Failure:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate QR codes' }, { status: 500 });
  }
}
