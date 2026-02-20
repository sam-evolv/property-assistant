export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase-server';
import { extractFloorPlanRooms } from '@/lib/floorplan/extractor';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant context required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const {
      storagePath,
      developmentId,
      documentId,
      houseTypeCode,
    } = body as {
      storagePath: string;
      developmentId: string;
      documentId?: string | null;
      houseTypeCode?: string | null;
    };

    if (!storagePath || !developmentId) {
      return NextResponse.json(
        { error: 'storagePath and developmentId are required' },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Download PDF from storage
    const { data: fileData, error: downloadErr } = await supabaseAdmin.storage
      .from('development_docs')
      .download(storagePath);

    if (downloadErr || !fileData) {
      console.error('[FloorPlan API] Download error:', downloadErr?.message);
      return NextResponse.json(
        { success: false, reason: 'download_failed', error: downloadErr?.message },
        { status: 400 },
      );
    }

    const pdfBuffer = Buffer.from(await fileData.arrayBuffer());

    // 2. Run extraction
    const result = await extractFloorPlanRooms(
      pdfBuffer,
      process.env.OPENAI_API_KEY!,
    );

    if (result.rooms.length === 0) {
      return NextResponse.json({
        success: false,
        reason: 'no_rooms_found',
        extraction_method: result.extraction_method,
        raw_text_length: result.raw_text_length,
      });
    }

    // 3. Resolve house_type_id if houseTypeCode provided
    let houseTypeId: string | null = null;
    const codeToResolve = houseTypeCode || result.house_type_code;
    if (codeToResolve) {
      const { data: unitType } = await supabaseAdmin
        .from('unit_types')
        .select('id')
        .eq('name', codeToResolve)
        .eq('project_id', developmentId)
        .single();
      houseTypeId = unitType?.id || null;
    }

    // 4. Insert rooms into unit_room_dimensions
    let inserted = 0;
    for (const room of result.rooms) {
      const { error: dimErr } = await supabaseAdmin
        .from('unit_room_dimensions')
        .insert({
          tenant_id: tenantId,
          development_id: developmentId,
          house_type_id: houseTypeId,
          document_id: documentId || null,
          room_name: room.room_name,
          room_key: room.room_key,
          floor: room.floor,
          length_m: room.length_m,
          width_m: room.width_m,
          area_sqm: room.area_sqm,
          ceiling_height_m: room.ceiling_height_m,
          source: 'floorplan_vision',
          verified: false,
          extraction_confidence: room.confidence,
          extraction_notes: `Auto-extracted from ${storagePath.split('/').pop() || 'PDF'}`,
        });

      if (dimErr) {
        console.warn(
          '[FloorPlan API] Room insert error for',
          room.room_name,
          ':',
          dimErr.message,
        );
      } else {
        inserted++;
      }
    }

    return NextResponse.json({
      success: true,
      rooms_extracted: inserted,
      rooms: result.rooms,
      house_type_code: result.house_type_code,
      confidence: result.confidence,
      extraction_method: result.extraction_method,
    });
  } catch (error: any) {
    console.error('[FloorPlan API] Error:', error);
    if (error.message === 'UNAUTHORIZED')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.message === 'FORBIDDEN')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json(
      { error: 'Extraction failed' },
      { status: 500 },
    );
  }
}
