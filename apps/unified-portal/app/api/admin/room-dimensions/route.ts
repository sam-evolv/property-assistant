export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@openhouse/api/session';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      db: { schema: 'public' }
    }
  );
}

interface RoomDimensionInput {
  id?: string;
  development_id: string;
  house_type_id: string;
  unit_id?: string;
  room_name: string;
  room_key: string;
  floor?: string;
  length_m?: number;
  width_m?: number;
  area_sqm?: number;
  ceiling_height_m?: number;
  verified: boolean;
  notes?: string;
  source?: string;
}

async function validateTenantOwnership(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  developmentId: string,
  houseTypeId?: string,
  unitId?: string | null
): Promise<{ valid: boolean; error?: string }> {
  // Check development exists for this tenant
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', developmentId)
    .single();

  if (projectError || !project) {
    return { valid: false, error: 'Development not found or access denied' };
  }

  if (houseTypeId) {
    const { data: unitType, error: unitTypeError } = await supabase
      .from('unit_types')
      .select('id')
      .eq('id', houseTypeId)
      .eq('project_id', developmentId)
      .single();

    if (unitTypeError || !unitType) {
      return { valid: false, error: 'House type not found in this development' };
    }
  }

  if (unitId) {
    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select('id')
      .eq('id', unitId)
      .eq('project_id', developmentId)
      .single();

    if (unitError || !unit) {
      return { valid: false, error: 'Unit not found in this development' };
    }
  }

  return { valid: true };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get('development_id');
    const houseTypeId = searchParams.get('house_type_id');
    const unitId = searchParams.get('unit_id');
    const verifiedOnly = searchParams.get('verified_only') === 'true';

    if (developmentId) {
      const validation = await validateTenantOwnership(supabase, session.tenantId, developmentId, houseTypeId || undefined, unitId);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 403 });
      }
    }

    // Build query for room dimensions
    let query = supabase
      .from('unit_room_dimensions')
      .select('*')
      .eq('tenant_id', session.tenantId);

    if (developmentId) {
      query = query.eq('development_id', developmentId);
    }
    if (houseTypeId) {
      query = query.eq('house_type_id', houseTypeId);
    }
    if (unitId) {
      query = query.eq('unit_id', unitId);
    }
    if (verifiedOnly) {
      query = query.eq('verified', true);
    }

    const { data: dimensions, error: dimError } = await query.order('verified', { ascending: false }).order('room_key').order('updated_at', { ascending: false });

    if (dimError) {
      // Table might not exist in Supabase - return empty list gracefully
      console.log('[API] GET /api/admin/room-dimensions - table may not exist:', dimError.message);
      return NextResponse.json({
        dimensions: [],
        stats: { total: 0, verified: 0, unverified: 0 },
      });
    }

    // Get stats
    let statsQuery = supabase
      .from('unit_room_dimensions')
      .select('verified', { count: 'exact' })
      .eq('tenant_id', session.tenantId);

    if (developmentId) {
      statsQuery = statsQuery.eq('development_id', developmentId);
    }

    const { count: totalCount } = await statsQuery;

    let verifiedQuery = supabase
      .from('unit_room_dimensions')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', session.tenantId)
      .eq('verified', true);

    if (developmentId) {
      verifiedQuery = verifiedQuery.eq('development_id', developmentId);
    }

    const { count: verifiedCount } = await verifiedQuery;

    // Transform dimension field names for API compatibility
    const transformedDimensions = (dimensions || []).map((d: any) => ({
      id: d.id,
      tenant_id: d.tenant_id,
      development_id: d.development_id,
      house_type_id: d.house_type_id,
      unit_id: d.unit_id,
      room_name: d.room_name,
      room_key: d.room_key,
      floor: d.floor,
      length_m: d.length_m,
      width_m: d.width_m,
      area_sqm: d.area_sqm,
      ceiling_height_m: d.ceiling_height_m,
      source: d.source,
      verified: d.verified,
      notes: d.notes,
      created_at: d.created_at,
      updated_at: d.updated_at,
      development_name: null, // Would need join
      house_type_code: null, // Would need join
      unit_number: null, // Would need join
    }));

    return NextResponse.json({
      dimensions: transformedDimensions,
      stats: {
        total: totalCount || 0,
        verified: verifiedCount || 0,
        unverified: (totalCount || 0) - (verifiedCount || 0),
      },
    });
  } catch (error) {
    console.error('[API] GET /api/admin/room-dimensions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch room dimensions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const body: RoomDimensionInput = await request.json();

    if (!body.development_id || !body.house_type_id || !body.room_key || !body.room_name) {
      return NextResponse.json(
        { error: 'Missing required fields: development_id, house_type_id, room_key, room_name' },
        { status: 400 }
      );
    }

    const validation = await validateTenantOwnership(
      supabase,
      session.tenantId,
      body.development_id,
      body.house_type_id,
      body.unit_id || null
    );
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 403 });
    }

    const { data: newDimension, error: insertError } = await supabase
      .from('unit_room_dimensions')
      .insert({
        tenant_id: session.tenantId,
        development_id: body.development_id,
        house_type_id: body.house_type_id,
        unit_id: body.unit_id || null,
        room_name: body.room_name,
        room_key: body.room_key,
        floor: body.floor || null,
        length_m: body.length_m ? String(body.length_m) : null,
        width_m: body.width_m ? String(body.width_m) : null,
        area_sqm: body.area_sqm ? String(body.area_sqm) : null,
        ceiling_height_m: body.ceiling_height_m ? String(body.ceiling_height_m) : null,
        source: body.source || 'manual',
        verified: body.verified ?? false,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (insertError) {
      // Table might not exist in Supabase - provide helpful message
      console.error('[API] POST /api/admin/room-dimensions error:', insertError);
      if (insertError.message?.includes('does not exist') || insertError.code === 'PGRST205') {
        return NextResponse.json({
          error: 'Room dimensions feature requires database setup. Please run the migration to create the unit_room_dimensions table.',
          details: insertError.message
        }, { status: 503 });
      }
      return NextResponse.json({
        error: 'Failed to create room dimension',
        details: insertError.message
      }, { status: 500 });
    }

    console.log(`[ROOM-DIMENSIONS] Created dimension ${newDimension.id} for room ${body.room_key} by ${session.email}`);

    return NextResponse.json({
      success: true,
      dimension: newDimension
    });
  } catch (error) {
    console.error('[API] POST /api/admin/room-dimensions error:', error);
    return NextResponse.json(
      { error: 'Failed to create room dimension' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const body: RoomDimensionInput = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    // Check existing dimension exists and belongs to tenant
    const { data: existing, error: existingError } = await supabase
      .from('unit_room_dimensions')
      .select('*')
      .eq('id', body.id)
      .eq('tenant_id', session.tenantId)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { error: 'Room dimension not found or access denied' },
        { status: 404 }
      );
    }

    if (body.unit_id && body.unit_id !== existing.unit_id) {
      const validation = await validateTenantOwnership(
        supabase,
        session.tenantId,
        existing.development_id,
        undefined,
        body.unit_id
      );
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 403 });
      }
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.room_name !== undefined) updateData.room_name = body.room_name;
    if (body.room_key !== undefined) updateData.room_key = body.room_key;
    if (body.floor !== undefined) updateData.floor = body.floor;
    if (body.length_m !== undefined) updateData.length_m = String(body.length_m);
    if (body.width_m !== undefined) updateData.width_m = String(body.width_m);
    if (body.area_sqm !== undefined) updateData.area_sqm = String(body.area_sqm);
    if (body.ceiling_height_m !== undefined) updateData.ceiling_height_m = String(body.ceiling_height_m);
    if (body.verified !== undefined) updateData.verified = body.verified;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.source !== undefined) updateData.source = body.source;
    if (body.unit_id !== undefined) updateData.unit_id = body.unit_id;

    const { data: updated, error: updateError } = await supabase
      .from('unit_room_dimensions')
      .update(updateData)
      .eq('id', body.id)
      .eq('tenant_id', session.tenantId)
      .select()
      .single();

    if (updateError) {
      console.error('[API] PUT /api/admin/room-dimensions error:', updateError);
      return NextResponse.json({ error: 'Failed to update room dimension' }, { status: 500 });
    }

    console.log(`[ROOM-DIMENSIONS] Updated dimension ${body.id} by ${session.email}, verified=${body.verified}`);

    return NextResponse.json({
      success: true,
      dimension: updated
    });
  } catch (error) {
    console.error('[API] PUT /api/admin/room-dimensions error:', error);
    return NextResponse.json(
      { error: 'Failed to update room dimension' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required parameter: id' },
        { status: 400 }
      );
    }

    // Check existing dimension exists and belongs to tenant
    const { data: existing, error: existingError } = await supabase
      .from('unit_room_dimensions')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', session.tenantId)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { error: 'Room dimension not found or access denied' },
        { status: 404 }
      );
    }

    const { error: deleteError } = await supabase
      .from('unit_room_dimensions')
      .delete()
      .eq('id', id)
      .eq('tenant_id', session.tenantId);

    if (deleteError) {
      console.error('[API] DELETE /api/admin/room-dimensions error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete room dimension' }, { status: 500 });
    }

    console.log(`[ROOM-DIMENSIONS] Deleted dimension ${id} by ${session.email}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] DELETE /api/admin/room-dimensions error:', error);
    return NextResponse.json(
      { error: 'Failed to delete room dimension' },
      { status: 500 }
    );
  }
}
