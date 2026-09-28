export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { maintenanceRequests, developments, units } from '@openhouse/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { requireRole, type AdminSession } from '@/lib/supabase-server';

// SECURITY: verify the development belongs to the session tenant (super_admin exempt)
async function assertDevelopmentOwnership(
  session: AdminSession,
  developmentId: string
): Promise<NextResponse | null> {
  const [development] = await db
    .select({ id: developments.id, tenant_id: developments.tenant_id })
    .from(developments)
    .where(eq(developments.id, developmentId))
    .limit(1);

  if (!development) {
    return NextResponse.json({ error: 'Development not found' }, { status: 404 });
  }

  if (session.role !== 'super_admin' && development.tenant_id !== session.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return null;
}

// SECURITY: a body-supplied unit_id must belong to this development
async function unitBelongsToDevelopment(unitId: string, developmentId: string): Promise<boolean> {
  const [unit] = await db
    .select({ id: units.id })
    .from(units)
    .where(and(eq(units.id, unitId), eq(units.development_id, developmentId)))
    .limit(1);
  return !!unit;
}

function toDateOrNull(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? null : d;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['super_admin', 'admin', 'developer']);
    const ownershipError = await assertDevelopmentOwnership(session, params.id);
    if (ownershipError) return ownershipError;
    const body = await request.json();
    const { requestId } = body;

    if (!requestId) {
      return NextResponse.json({ error: 'requestId is required' }, { status: 400 });
    }

    // SECURITY: whitelist updatable fields — never allow id/development_id/unit_id overrides
    const updates: Partial<typeof maintenanceRequests.$inferInsert> = {};
    if (typeof body.status === 'string') updates.status = body.status;
    if (body.assigned_vendor !== undefined) updates.assigned_vendor = body.assigned_vendor;
    if (body.scheduled_date !== undefined) updates.scheduled_date = toDateOrNull(body.scheduled_date);
    if (body.resolution_notes !== undefined) updates.resolution_notes = body.resolution_notes;
    if (body.resolution_cost !== undefined) {
      updates.resolution_cost =
        body.resolution_cost === null || body.resolution_cost === '' ? null : String(body.resolution_cost);
    }

    if (updates.status === 'resolved') {
      updates.resolved_at = new Date();
    }
    if (updates.status === 'acknowledged') {
      updates.acknowledged_at = new Date();
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
    const ownershipError = await assertDevelopmentOwnership(session, params.id);
    if (ownershipError) return ownershipError;
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
    const ownershipError = await assertDevelopmentOwnership(session, params.id);
    if (ownershipError) return ownershipError;
    const developmentId = params.id;
    const body = await request.json();

    if (!body?.unit_id || !body?.title || !body?.description || !body?.category) {
      return NextResponse.json(
        { error: 'unit_id, title, description and category are required' },
        { status: 400 }
      );
    }

    if (!(await unitBelongsToDevelopment(String(body.unit_id), developmentId))) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    // SECURITY: whitelist fields — never allow id/development_id overrides from the body
    const values: typeof maintenanceRequests.$inferInsert = {
      development_id: developmentId,
      unit_id: String(body.unit_id),
      title: String(body.title),
      description: String(body.description),
      category: String(body.category),
      priority: typeof body.priority === 'string' && body.priority ? body.priority : 'routine',
      status: 'submitted',
    };

    const [maintenanceRequest] = await db
      .insert(maintenanceRequests)
      .values(values)
      .returning();

    return NextResponse.json({ request: maintenanceRequest }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message.includes('UNAUTHORIZED') || error.message.includes('FORBIDDEN'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
