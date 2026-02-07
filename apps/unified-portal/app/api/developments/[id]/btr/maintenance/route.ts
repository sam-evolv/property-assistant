import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { maintenanceRequests } from '@openhouse/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireRole } from '@/lib/supabase-server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['super_admin', 'admin', 'developer']);
    const body = await request.json();
    const { requestId, ...updates } = body;

    if (!requestId) {
      return NextResponse.json({ error: 'requestId is required' }, { status: 400 });
    }

    if (updates.status === 'resolved' && !updates.resolved_at) {
      updates.resolved_at = new Date().toISOString();
    }
    if (updates.status === 'acknowledged' && !updates.acknowledged_at) {
      updates.acknowledged_at = new Date().toISOString();
    }

    const [updated] = await db
      .update(maintenanceRequests)
      .set({ ...updates, updated_at: new Date() })
      .where(and(eq(maintenanceRequests.id, requestId), eq(maintenanceRequests.development_id, params.id)))
      .returning();

    return NextResponse.json({ request: updated });
  } catch (error: any) {
    if (error?.message?.includes('UNAUTHORIZED') || error?.message?.includes('FORBIDDEN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[BTR API] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['super_admin', 'admin', 'developer']);
    const developmentId = params.id;

    const requests = await db
      .select()
      .from(maintenanceRequests)
      .where(eq(maintenanceRequests.development_id, developmentId))
      .orderBy(desc(maintenanceRequests.created_at));

    return NextResponse.json({ requests });
  } catch (error: any) {
    if (error?.message?.includes('UNAUTHORIZED') || error?.message?.includes('FORBIDDEN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[BTR API] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['super_admin', 'admin', 'developer']);
    const developmentId = params.id;
    const body = await request.json();

    const [maintenanceRequest] = await db
      .insert(maintenanceRequests)
      .values({
        ...body,
        development_id: developmentId,
        status: body.status || 'submitted',
        priority: body.priority || 'routine',
      })
      .returning();

    return NextResponse.json({ request: maintenanceRequest }, { status: 201 });
  } catch (error: any) {
    if (error?.message?.includes('UNAUTHORIZED') || error?.message?.includes('FORBIDDEN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[BTR API] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
