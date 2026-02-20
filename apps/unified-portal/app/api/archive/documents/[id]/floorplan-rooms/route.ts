export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase-server';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// GET — return extracted rooms for this document
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;
    const documentId = params.id;

    const supabaseAdmin = getSupabaseAdmin();

    // Try by document_id first
    let { data: rooms } = await supabaseAdmin
      .from('unit_room_dimensions')
      .select('id, room_name, room_key, floor, length_m, width_m, area_sqm, ceiling_height_m, source, verified, house_type_id, extraction_confidence')
      .eq('document_id', documentId)
      .eq('tenant_id', tenantId)
      .order('floor', { ascending: true })
      .order('room_key', { ascending: true });

    // Fallback: if no document_id linked rows, try by development_id + source
    if (!rooms || rooms.length === 0) {
      // Get the document's development_id
      const { data: doc } = await supabaseAdmin
        .from('documents')
        .select('development_id')
        .eq('id', documentId)
        .single();

      // Note: we don't need doc for this fallback if it was not found via Drizzle
      // Try the legacy documents table too
      if (!doc) {
        const { db } = await import('@openhouse/db/client');
        const { documents } = await import('@openhouse/db/schema');
        const { eq } = await import('drizzle-orm');
        const drizzleDoc = await db.query.documents.findFirst({
          where: eq(documents.id, documentId),
          columns: { development_id: true },
        });
        if (drizzleDoc?.development_id) {
          const { data: fallbackRooms } = await supabaseAdmin
            .from('unit_room_dimensions')
            .select('id, room_name, room_key, floor, length_m, width_m, area_sqm, ceiling_height_m, source, verified, house_type_id, extraction_confidence')
            .eq('development_id', drizzleDoc.development_id)
            .eq('source', 'floorplan_vision')
            .eq('tenant_id', tenantId)
            .order('floor', { ascending: true })
            .order('room_key', { ascending: true });
          rooms = fallbackRooms;
        }
      } else if (doc.development_id) {
        const { data: fallbackRooms } = await supabaseAdmin
          .from('unit_room_dimensions')
          .select('id, room_name, room_key, floor, length_m, width_m, area_sqm, ceiling_height_m, source, verified, house_type_id, extraction_confidence')
          .eq('development_id', doc.development_id)
          .eq('source', 'floorplan_vision')
          .eq('tenant_id', tenantId)
          .order('floor', { ascending: true })
          .order('room_key', { ascending: true });
        rooms = fallbackRooms;
      }
    }

    // Fetch unit_types for the development (for house type dropdown)
    let unitTypes: Array<{ id: string; name: string }> = [];
    // Get development_id from document
    const { db } = await import('@openhouse/db/client');
    const { documents: docSchema } = await import('@openhouse/db/schema');
    const { eq } = await import('drizzle-orm');
    const docRecord = await db.query.documents.findFirst({
      where: eq(docSchema.id, documentId),
      columns: { development_id: true },
    });
    if (docRecord?.development_id) {
      const { data: types } = await supabaseAdmin
        .from('unit_types')
        .select('id, name')
        .eq('project_id', docRecord.development_id)
        .order('name', { ascending: true });
      unitTypes = types || [];
    }

    return NextResponse.json({
      rooms: rooms || [],
      unit_types: unitTypes,
    });
  } catch (error: any) {
    console.error('[FloorPlan Rooms GET] Error:', error);
    if (error.message === 'UNAUTHORIZED')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.message === 'FORBIDDEN')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
  }
}

// PATCH — update a room (verify or edit dimensions)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    const body = await req.json();
    const { roomId, verified, length_m, width_m, area_sqm, house_type_id } = body as {
      roomId: string;
      verified?: boolean;
      length_m?: number;
      width_m?: number;
      area_sqm?: number;
      house_type_id?: string | null;
    };

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (typeof verified === 'boolean') updates.verified = verified;
    if (typeof length_m === 'number') updates.length_m = length_m;
    if (typeof width_m === 'number') updates.width_m = width_m;
    if (typeof area_sqm === 'number') updates.area_sqm = area_sqm;
    if (house_type_id !== undefined) updates.house_type_id = house_type_id;

    const { data: room, error } = await supabaseAdmin
      .from('unit_room_dimensions')
      .update(updates)
      .eq('id', roomId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      console.error('[FloorPlan Rooms PATCH] Error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, room });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.message === 'FORBIDDEN')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

// DELETE — remove a room
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    const body = await req.json();
    const { roomId } = body as { roomId: string };

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { error } = await supabaseAdmin
      .from('unit_room_dimensions')
      .delete()
      .eq('id', roomId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[FloorPlan Rooms DELETE] Error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.message === 'FORBIDDEN')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
