import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { signQRToken } from '@openhouse/api/qr-tokens';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';

// Create Supabase admin client for fetching units
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;
    
    // Fetch project from Supabase
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error('[QR Codes] Project not found:', projectError);
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch units from Supabase with unit_types
    const { data: units, error: unitsError } = await supabaseAdmin
      .from('units')
      .select('*, unit_types(*)')
      .eq('project_id', projectId)
      .order('unit_number');

    if (unitsError) {
      console.error('[QR Codes] Error fetching units:', unitsError);
      return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 });
    }

    if (!units || units.length === 0) {
      return NextResponse.json(
        { error: 'No units found for this project in Supabase' },
        { status: 404 }
      );
    }

    console.log(`[QR Codes] Generating QR codes for ${units.length} units in project ${project.name}`);

    const qrData: Array<{
      unitNumber: string;
      unitType: string | null;
      url: string;
      qrDataUrl: string;
      purchaserName: string;
    }> = [];

    // Generate QR codes for each unit from Supabase
    for (const unit of units) {
      // Generate signed token (no DB persistence - just signature-based validation)
      const tokenData = signQRToken({
        supabaseUnitId: unit.id,
        projectId: projectId,
      });

      const qrDataUrl = await QRCode.toDataURL(tokenData.url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      // Get purchaser name from Supabase auth user if linked
      let purchaserName = 'Homeowner';
      if (unit.user_id) {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(unit.user_id);
        if (authUser?.user?.user_metadata?.full_name) {
          purchaserName = authUser.user.user_metadata.full_name;
        } else if (authUser?.user?.user_metadata?.name) {
          purchaserName = authUser.user.user_metadata.name;
        }
      }

      qrData.push({
        unitNumber: unit.unit_number,
        unitType: unit.unit_types?.type_name || null,
        url: tokenData.url,
        qrDataUrl,
        purchaserName,
      });

      console.log(`[QR Codes] Generated QR for unit ${unit.unit_number}`);
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
          `${project.name || 'Project'} - QR Codes (Page ${pageNumber}/${totalPages})`,
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

      // Unit number and type
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
        .text(unit.unitType || 'Standard Unit', textX, textY, {
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
        .text(`${unit.purchaserName}`, textX, textY, {
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
        'Content-Disposition': `attachment; filename="${project.name || 'project'}-qr-codes.pdf"`,
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
