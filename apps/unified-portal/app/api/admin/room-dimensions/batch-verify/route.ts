export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { unitRoomDimensions } from '@openhouse/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { getAdminSession } from '@openhouse/api/session';

export const runtime = 'nodejs';

interface BatchVerifyInput {
  ids: string[];
  verified: boolean;
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: BatchVerifyInput = await request.json();

    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty ids array' },
        { status: 400 }
      );
    }

    if (body.ids.length > 100) {
      return NextResponse.json(
        { error: 'Cannot batch update more than 100 items at once' },
        { status: 400 }
      );
    }

    const existingCount = await db.execute<{ count: string }>(sql`
      SELECT COUNT(*) as count
      FROM unit_room_dimensions
      WHERE id = ANY(${body.ids}::uuid[])
        AND tenant_id = ${session.tenantId}::uuid
    `);

    const actualCount = parseInt(existingCount.rows?.[0]?.count || '0');
    if (actualCount !== body.ids.length) {
      return NextResponse.json(
        { error: 'Some dimension IDs not found or access denied' },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {
      verified: body.verified,
      updatedAt: new Date(),
    };

    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }

    const updated = await db
      .update(unitRoomDimensions)
      .set(updateData)
      .where(
        and(
          inArray(unitRoomDimensions.id, body.ids),
          eq(unitRoomDimensions.tenantId, session.tenantId)
        )
      )
      .returning({ id: unitRoomDimensions.id });

    return NextResponse.json({
      success: true,
      updated_count: updated.length,
      ids: updated.map(d => d.id),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to batch verify room dimensions' },
      { status: 500 }
    );
  }
}
