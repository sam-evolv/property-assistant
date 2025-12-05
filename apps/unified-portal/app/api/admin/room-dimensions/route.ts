import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { unit_room_dimensions, developments, houseTypes, units } from '@openhouse/db/schema';
import { eq, and, sql, isNull, desc } from 'drizzle-orm';
import { getAdminSession } from '@openhouse/api/session';

export const runtime = 'nodejs';

interface RoomDimensionInput {
  id?: string;
  development_id: string;
  house_type_id: string;
  unit_id?: string;
  unit_type_code: string;
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
  confidence?: number;
}

async function validateTenantOwnership(
  tenantId: string,
  developmentId: string,
  houseTypeId?: string,
  unitId?: string | null
): Promise<{ valid: boolean; error?: string }> {
  const dev = await db.query.developments.findFirst({
    where: and(
      eq(developments.id, developmentId),
      eq(developments.tenant_id, tenantId)
    ),
  });

  if (!dev) {
    return { valid: false, error: 'Development not found or access denied' };
  }

  if (houseTypeId) {
    const ht = await db.query.houseTypes.findFirst({
      where: and(
        eq(houseTypes.id, houseTypeId),
        eq(houseTypes.development_id, developmentId)
      ),
    });

    if (!ht) {
      return { valid: false, error: 'House type not found in this development' };
    }
  }

  if (unitId) {
    const unit = await db.query.units.findFirst({
      where: and(
        eq(units.id, unitId),
        eq(units.development_id, developmentId)
      ),
    });

    if (!unit) {
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

    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get('development_id');
    const houseTypeId = searchParams.get('house_type_id');
    const unitId = searchParams.get('unit_id');
    const verifiedOnly = searchParams.get('verified_only') === 'true';

    if (developmentId) {
      const validation = await validateTenantOwnership(session.tenantId, developmentId, houseTypeId || undefined, unitId);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 403 });
      }
    }

    let conditions = [eq(unit_room_dimensions.tenant_id, session.tenantId)];

    if (developmentId) {
      conditions.push(eq(unit_room_dimensions.development_id, developmentId));
    }
    if (houseTypeId) {
      conditions.push(eq(unit_room_dimensions.house_type_id, houseTypeId));
    }
    if (unitId) {
      conditions.push(eq(unit_room_dimensions.unit_id, unitId));
    }
    if (verifiedOnly) {
      conditions.push(eq(unit_room_dimensions.verified, true));
    }

    const dimensions = await db
      .select({
        id: unit_room_dimensions.id,
        tenant_id: unit_room_dimensions.tenant_id,
        development_id: unit_room_dimensions.development_id,
        house_type_id: unit_room_dimensions.house_type_id,
        unit_id: unit_room_dimensions.unit_id,
        unit_type_code: unit_room_dimensions.unit_type_code,
        room_name: unit_room_dimensions.room_name,
        room_key: unit_room_dimensions.room_key,
        floor: unit_room_dimensions.floor,
        length_m: unit_room_dimensions.length_m,
        width_m: unit_room_dimensions.width_m,
        area_sqm: unit_room_dimensions.area_sqm,
        ceiling_height_m: unit_room_dimensions.ceiling_height_m,
        source: unit_room_dimensions.source,
        verified: unit_room_dimensions.verified,
        confidence: unit_room_dimensions.confidence,
        notes: unit_room_dimensions.notes,
        created_at: unit_room_dimensions.created_at,
        updated_at: unit_room_dimensions.updated_at,
        development_name: developments.name,
        house_type_code: houseTypes.house_type_code,
        unit_number: units.unit_number,
      })
      .from(unit_room_dimensions)
      .leftJoin(developments, eq(unit_room_dimensions.development_id, developments.id))
      .leftJoin(houseTypes, eq(unit_room_dimensions.house_type_id, houseTypes.id))
      .leftJoin(units, eq(unit_room_dimensions.unit_id, units.id))
      .where(and(...conditions))
      .orderBy(
        desc(unit_room_dimensions.verified),
        unit_room_dimensions.room_key,
        desc(unit_room_dimensions.updated_at)
      );

    const stats = await db.execute<{ 
      total: string; 
      verified: string; 
      unverified: string;
      by_source: { source: string; count: number }[];
    }>(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE verified = true) as verified,
        COUNT(*) FILTER (WHERE verified = false) as unverified
      FROM unit_room_dimensions
      WHERE tenant_id = ${session.tenantId}::uuid
        ${developmentId ? sql`AND development_id = ${developmentId}::uuid` : sql``}
    `);

    const statsRow = stats.rows?.[0] || { total: '0', verified: '0', unverified: '0' };

    return NextResponse.json({
      dimensions,
      stats: {
        total: parseInt(statsRow.total),
        verified: parseInt(statsRow.verified),
        unverified: parseInt(statsRow.unverified),
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

    const body: RoomDimensionInput = await request.json();

    if (!body.development_id || !body.house_type_id || !body.room_key || !body.room_name) {
      return NextResponse.json(
        { error: 'Missing required fields: development_id, house_type_id, room_key, room_name' },
        { status: 400 }
      );
    }

    const validation = await validateTenantOwnership(
      session.tenantId,
      body.development_id,
      body.house_type_id,
      body.unit_id || null
    );
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 403 });
    }

    const [newDimension] = await db.insert(unit_room_dimensions).values({
      tenant_id: session.tenantId,
      development_id: body.development_id,
      house_type_id: body.house_type_id,
      unit_id: body.unit_id || null,
      unit_type_code: body.unit_type_code,
      room_name: body.room_name,
      room_key: body.room_key,
      floor: body.floor || null,
      length_m: body.length_m || null,
      width_m: body.width_m || null,
      area_sqm: body.area_sqm ? String(body.area_sqm) : null,
      ceiling_height_m: body.ceiling_height_m ? String(body.ceiling_height_m) : null,
      source: body.source || 'manual',
      verified: body.verified ?? false,
      confidence: body.confidence ?? 0.9,
      notes: body.notes || null,
    }).returning();

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

    const body: RoomDimensionInput = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    const existing = await db.query.unit_room_dimensions.findFirst({
      where: and(
        eq(unit_room_dimensions.id, body.id),
        eq(unit_room_dimensions.tenant_id, session.tenantId)
      ),
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Room dimension not found or access denied' },
        { status: 404 }
      );
    }

    if (body.unit_id && body.unit_id !== existing.unit_id) {
      const validation = await validateTenantOwnership(
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
      updated_at: new Date(),
    };

    if (body.room_name !== undefined) updateData.room_name = body.room_name;
    if (body.room_key !== undefined) updateData.room_key = body.room_key;
    if (body.floor !== undefined) updateData.floor = body.floor;
    if (body.length_m !== undefined) updateData.length_m = body.length_m;
    if (body.width_m !== undefined) updateData.width_m = body.width_m;
    if (body.area_sqm !== undefined) updateData.area_sqm = String(body.area_sqm);
    if (body.ceiling_height_m !== undefined) updateData.ceiling_height_m = String(body.ceiling_height_m);
    if (body.verified !== undefined) updateData.verified = body.verified;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.source !== undefined) updateData.source = body.source;
    if (body.confidence !== undefined) updateData.confidence = body.confidence;
    if (body.unit_id !== undefined) updateData.unit_id = body.unit_id;

    const [updated] = await db
      .update(unit_room_dimensions)
      .set(updateData)
      .where(
        and(
          eq(unit_room_dimensions.id, body.id),
          eq(unit_room_dimensions.tenant_id, session.tenantId)
        )
      )
      .returning();

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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required parameter: id' },
        { status: 400 }
      );
    }

    const existing = await db.query.unit_room_dimensions.findFirst({
      where: and(
        eq(unit_room_dimensions.id, id),
        eq(unit_room_dimensions.tenant_id, session.tenantId)
      ),
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Room dimension not found or access denied' },
        { status: 404 }
      );
    }

    await db
      .delete(unit_room_dimensions)
      .where(
        and(
          eq(unit_room_dimensions.id, id),
          eq(unit_room_dimensions.tenant_id, session.tenantId)
        )
      );

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
