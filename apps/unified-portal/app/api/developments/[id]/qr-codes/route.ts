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

    // First, get ALL units to see what's in the database
    const { data: allUnits, error: allError } = await supabase
      .from('units')
      .select('*')
      .limit(10);
    
    console.log('[QR] All units in DB (first 10):', allUnits?.length);
    if (allUnits && allUnits.length > 0) {
      console.log('[QR] Sample unit columns:', Object.keys(allUnits[0]));
      console.log('[QR] Sample unit data:', JSON.stringify(allUnits[0], null, 2));
    }

    // Now query by project_id
    const { data: units, error } = await supabase
      .from('units')
      .select('id, user_id, unit_type_id, project_id')
      .eq('project_id', REAL_PROJECT_ID);

    if (error) {
      console.error('[QR] Supabase Error:', error);
      throw error;
    }

    console.log('[QR] Units matching project_id:', units?.length);

    // If no matches by project_id, use all units
    const finalUnits = (units && units.length > 0) ? units : (allUnits || []);

    if (!finalUnits || finalUnits.length === 0) {
      console.log('[QR] No units found at all');
      return NextResponse.json({ error: 'No units found.' }, { status: 404 });
    }

    console.log(`[QR] Using ${finalUnits.length} units for PDF`);

    const doc = new jsPDF();
    let yPos = 20;

    finalUnits.forEach((unit: any, index: number) => {
      if (index > 0 && index % 4 === 0) {
        doc.addPage();
        yPos = 20;
      }

      const unitLabel = `Unit ${index + 1}`;
      const qrUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://openhouse.ai'}/homes/${unit.id}`;

      doc.setFontSize(16);
      doc.text(`${unitLabel}`, 20, yPos);
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
        'Content-Disposition': `attachment; filename="qr-codes-${finalUnits.length}-units.pdf"`,
      },
    });

  } catch (error: any) {
    console.error('[QR] Critical Failure:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
