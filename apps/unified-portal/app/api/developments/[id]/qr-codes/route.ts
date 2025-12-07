import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import jsPDF from 'jspdf'; 

// Initialize Supabase Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const projectId = params.id;
    console.log("Generating QR codes for Project:", projectId);

    // 1. DATABASE FETCH: Get only the real units from Supabase
    const { data: units, error } = await supabase
      .from('units')
      .select('id, address')
      .eq('project_id', projectId);

    if (error) {
        console.error("Supabase Error:", error);
        throw error;
    }

    // Safety Check: If no units exist, stop.
    if (!units || units.length === 0) {
      return NextResponse.json(
        { error: "No units found in Supabase. Please add units to the database first." }, 
        { status: 404 }
      );
    }

    console.log(`Generating PDF for ${units.length} units...`);

    // 2. PDF GENERATION: Create the document
    const doc = new jsPDF();
    let yPos = 20;

    units.forEach((unit, index) => {
      // Add new page every 4 stickers
      if (index > 0 && index % 4 === 0) {
        doc.addPage();
        yPos = 20;
      }

      // 3. CONTENT: Use ONLY Supabase data. No "Ciara".
      // This URL uses the NEW UUID format, compatible with your fix.
      const qrUrl = `${process.env.NEXT_PUBLIC_APP_URL}/homes/${unit.id}`;

      doc.setFontSize(16);
      doc.text(`Unit: ${unit.address}`, 20, yPos);

      doc.setFontSize(10);
      doc.text(`System ID: ${unit.id}`, 20, yPos + 7);
      doc.text(`Link: ${qrUrl}`, 20, yPos + 15);

      // Draw a box around it
      doc.rect(15, yPos - 10, 180, 40);

      yPos += 50;
    });

    // 4. RETURN FILE
    const pdfBuffer = doc.output('arraybuffer');

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="qr-codes-${projectId}.pdf"`,
      },
    });

  } catch (error: any) {
    console.error("Critical Failure:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}