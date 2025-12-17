export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { unitRoomDimensions, developments, houseTypes, units } from '@openhouse/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { getAdminSession } from '@openhouse/api/session';

export const runtime = 'nodejs';

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

    let conditions = [eq(unitRoomDimensions.tenantId, session.tenantId)];

    if (developmentId) {
      conditions.push(eq(unitRoomDimensions.developmentId, developmentId));
    }
    if (houseTypeId) {
      conditions.push(eq(unitRoomDimensions.houseTypeId, houseTypeId));
    }
    if (unitId) {
      conditions.push(eq(unitRoomDimensions.unitId, unitId));
    }
    if (verifiedOnly) {
      conditions.push(eq(unitRoomDimensions.verified, true));
    }

    const dimensions = await db
      .select({
        id: unitRoomDimensions.id,
        tenant_id: unitRoomDimensions.tenantId,
        development_id: unitRoomDimensions.developmentId,
        house_type_id: unitRoomDimensions.houseTypeId,
        unit_id: unitRoomDimensions.unitId,
        room_name: unitRoomDimensions.roomName,
        room_key: unitRoomDimensions.roomKey,
        floor: unitRoomDimensions.floor,
        length_m: unitRoomDimensions.lengthM,
        width_m: unitRoomDimensions.widthM,
        area_sqm: unitRoomDimensions.areaSqm,
        ceiling_height_m: unitRoomDimensions.ceilingHeightM,
        source: unitRoomDimensions.source,
        verified: unitRoomDimensions.verified,
        notes: unitRoomDimensions.notes,
        created_at: unitRoomDimensions.createdAt,
        updated_at: unitRoomDimensions.updatedAt,
        development_name: developments.name,
        house_type_code: houseTypes.house_type_code,
        unit_number: units.unit_number,
      })
      .from(unitRoomDimensions)
      .leftJoin(developments, eq(unitRoomDimensions.developmentId, developments.id))
      .leftJoin(houseTypes, eq(unitRoomDimensions.houseTypeId, houseTypes.id))
      .leftJoin(units, eq(unitRoomDimensions.unitId, units.id))
      .where(and(...conditions))
      .orderBy(
        desc(unitRoomDimensions.verified),
        unitRoomDimensions.roomKey,
        desc(unitRoomDimensions.updatedAt)
      );

    const stats = await db.execute<{ 
      total: string; 
      verified: string; 
      unverified: string;
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

    const [newDimension] = await db.insert(unitRoomDimensions).values({
      tenantId: session.tenantId,
      developmentId: body.development_id,
      houseTypeId: body.house_type_id,
      unitId: body.unit_id || null,
      roomName: body.room_name,
      roomKey: body.room_key,
      floor: body.floor || null,
      lengthM: body.length_m ? String(body.length_m) : null,
      widthM: body.width_m ? String(body.width_m) : null,
      areaSqm: body.area_sqm ? String(body.area_sqm) : null,
      ceilingHeightM: body.ceiling_height_m ? String(body.ceiling_height_m) : null,
      source: body.source || 'manual',
      verified: body.verified ?? false,
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

    const existing = await db.query.unitRoomDimensions.findFirst({
      where: and(
        eq(unitRoomDimensions.id, body.id),
        eq(unitRoomDimensions.tenantId, session.tenantId)
      ),
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Room dimension not found or access denied' },
        { status: 404 }
      );
    }

    if (body.unit_id && body.unit_id !== existing.unitId) {
      const validation = await validateTenantOwnership(
        session.tenantId,
        existing.developmentId,
        undefined,
        body.unit_id
      );
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 403 });
      }
    }

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (body.room_name !== undefined) updateData.roomName = body.room_name;
    if (body.room_key !== undefined) updateData.roomKey = body.room_key;
    if (body.floor !== undefined) updateData.floor = body.floor;
    if (body.length_m !== undefined) updateData.lengthM = String(body.length_m);
    if (body.width_m !== undefined) updateData.widthM = String(body.width_m);
    if (body.area_sqm !== undefined) updateData.areaSqm = String(body.area_sqm);
    if (body.ceiling_height_m !== undefined) updateData.ceilingHeightM = String(body.ceiling_height_m);
    if (body.verified !== undefined) updateData.verified = body.verified;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.source !== undefined) updateData.source = body.source;
    if (body.unit_id !== undefined) updateData.unitId = body.unit_id;

    const [updated] = await db
      .update(unitRoomDimensions)
      .set(updateData)
      .where(
        and(
          eq(unitRoomDimensions.id, body.id),
          eq(unitRoomDimensions.tenantId, session.tenantId)
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

    const existing = await db.query.unitRoomDimensions.findFirst({
      where: and(
        eq(unitRoomDimensions.id, id),
        eq(unitRoomDimensions.tenantId, session.tenantId)
      ),
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Room dimension not found or access denied' },
        { status: 404 }
      );
    }

    await db
      .delete(unitRoomDimensions)
      .where(
        and(
          eq(unitRoomDimensions.id, id),
          eq(unitRoomDimensions.tenantId, session.tenantId)
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
