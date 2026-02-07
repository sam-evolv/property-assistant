import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { maintenanceRequests } from '@openhouse/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
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

    const result = await db.execute(sql`
      SELECT m.*,
             u.address as unit_address,
             u.unit_number as unit_number,
             t.tenant_name as tenant_name_joined
      FROM maintenance_requests m
      LEFT JOIN units u ON m.unit_id = u.id
      LEFT JOIN btr_tenancies t ON m.unit_id = t.unit_id AND t.status = 'active'
      WHERE m.development_id = ${developmentId}
      ORDER BY m.created_at DESC
    `);

    const rows = (result as any).rows || result;
    const requests = rows.map((r: any) => ({
      ...r,
      unit: { address: r.unit_address, unit_number: r.unit_number },
      tenancy: { tenant_name: r.tenant_name_joined },
    }));

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
