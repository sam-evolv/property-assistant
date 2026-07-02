export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { maintenanceRequests, developments } from '@openhouse/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { requireRole } from '@/lib/supabase-server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['super_admin', 'admin', 'developer']);
    const body = await request.json();
    const { requestId, ...updates } = body;

    if (!requestId) {
      return NextResponse.json({ error: 'requestId is required' }, { status: 400 });
    }

    // SECURITY: verify the development belongs to the caller's tenant (super_admin exempt)
    const [development] = await db
      .select({ tenant_id: developments.tenant_id })
      .from(developments)
      .where(eq(developments.id, params.id))
      .limit(1);

    if (!development) {
      return NextResponse.json({ error: 'Development not found' }, { status: 404 });
    }
    if (session.role !== 'super_admin' && development.tenant_id !== session.tenantId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
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
  } catch (error: unknown) {
    if (error instanceof Error && (error.message.includes('UNAUTHORIZED') || error.message.includes('FORBIDDEN'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['super_admin', 'admin', 'developer']);
    const developmentId = params.id;

    // SECURITY: verify the development belongs to the caller's tenant (super_admin exempt)
    const [development] = await db
      .select({ tenant_id: developments.tenant_id })
      .from(developments)
      .where(eq(developments.id, developmentId))
      .limit(1);

    if (!development) {
      return NextResponse.json({ error: 'Development not found' }, { status: 404 });
    }
    if (session.role !== 'super_admin' && development.tenant_id !== session.tenantId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

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
  } catch (error: unknown) {
    if (error instanceof Error && (error.message.includes('UNAUTHORIZED') || error.message.includes('FORBIDDEN'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['super_admin', 'admin', 'developer']);
    const developmentId = params.id;
    const body = await request.json();

    // SECURITY: verify the development belongs to the caller's tenant (super_admin exempt)
    const [development] = await db
      .select({ tenant_id: developments.tenant_id })
      .from(developments)
      .where(eq(developments.id, developmentId))
      .limit(1);

    if (!development) {
      return NextResponse.json({ error: 'Development not found' }, { status: 404 });
    }
    if (session.role !== 'super_admin' && development.tenant_id !== session.tenantId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

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
  } catch (error: unknown) {
    if (error instanceof Error && (error.message.includes('UNAUTHORIZED') || error.message.includes('FORBIDDEN'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
