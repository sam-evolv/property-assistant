import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { unit_room_dimensions } from '@openhouse/db/schema';
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

    const updateData: Record<string, any> = {
      verified: body.verified,
      updated_at: new Date(),
    };

    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }

    const updated = await db
      .update(unit_room_dimensions)
      .set(updateData)
      .where(
        and(
          inArray(unit_room_dimensions.id, body.ids),
          eq(unit_room_dimensions.tenant_id, session.tenantId)
        )
      )
      .returning({ id: unit_room_dimensions.id });

    console.log(`[ROOM-DIMENSIONS] Batch verified ${updated.length} dimensions by ${session.email}, verified=${body.verified}`);

    return NextResponse.json({
      success: true,
      updated_count: updated.length,
      ids: updated.map(d => d.id),
    });
  } catch (error) {
    console.error('[API] POST /api/admin/room-dimensions/batch-verify error:', error);
    return NextResponse.json(
      { error: 'Failed to batch verify room dimensions' },
      { status: 500 }
    );
  }
}
