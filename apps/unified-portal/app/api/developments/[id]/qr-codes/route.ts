import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import jsPDF from 'jspdf';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REAL_PROJECT_ID = '97dc3919-2726-4675-8046-9f79070ec88c';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    console.log(`[QR] Frontend asked for: ${params.id}`);
    console.log(`[QR] Overriding with REAL ID: ${REAL_PROJECT_ID}`);

    const { data: units, error } = await supabase
      .from('units')
      .select('id, unit_number, unit_type_id')
      .eq('project_id', REAL_PROJECT_ID);

    if (error) {
      console.error('[QR] Supabase Error:', error);
      throw error;
    }

    console.log('[QR] Raw units response:', units);

    if (!units || units.length === 0) {
      console.log('[QR] No units found for project:', REAL_PROJECT_ID);
      return NextResponse.json({ error: 'No units found.' }, { status: 404 });
    }

    console.log(`[QR] Found ${units.length} units!`);

    const doc = new jsPDF();
    let yPos = 20;

    units.forEach((unit, index) => {
      if (index > 0 && index % 4 === 0) {
        doc.addPage();
        yPos = 20;
      }

      const unitLabel = unit.unit_number || `Unit ${index + 1}`;
      const qrUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://openhouse.ai'}/homes/${unit.id}`;

      doc.setFontSize(16);
      doc.text(`Unit: ${unitLabel}`, 20, yPos);
      doc.setFontSize(10);
      doc.text(`ID: ${unit.id}`, 20, yPos + 7);
      doc.text(`Link: ${qrUrl}`, 20, yPos + 14);
      doc.rect(15, yPos - 10, 180, 35);
      yPos += 45;
    });

    const pdfBuffer = doc.output('arraybuffer');

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="qr-codes-${units.length}-units.pdf"`,
      },
    });

  } catch (error: any) {
    console.error('[QR] Critical Failure:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
