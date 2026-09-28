export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { btrTenancies, developments, units } from '@openhouse/db/schema';
import { eq, and, desc } from 'drizzle-orm';
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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['super_admin', 'admin', 'developer']);
    const ownershipError = await assertDevelopmentOwnership(session, params.id);
    if (ownershipError) return ownershipError;
    const developmentId = params.id;

    const tenancies = await db
      .select()
      .from(btrTenancies)
      .where(eq(btrTenancies.development_id, developmentId))
      .orderBy(desc(btrTenancies.created_at));

    return NextResponse.json({ tenancies });
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

    const access_code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const leaseStart = toDateOrNull(body?.lease_start);
    if (!body?.unit_id || !body?.tenant_name || !leaseStart) {
      return NextResponse.json(
        { error: 'unit_id, tenant_name and lease_start are required' },
        { status: 400 }
      );
    }

    if (!(await unitBelongsToDevelopment(String(body.unit_id), developmentId))) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    // SECURITY: whitelist fields — never allow id/development_id/tenant_id overrides from the body
    const values: typeof btrTenancies.$inferInsert = {
      development_id: developmentId,
      unit_id: String(body.unit_id),
      tenant_name: String(body.tenant_name),
      tenant_email: body.tenant_email ?? null,
      tenant_phone: body.tenant_phone ?? null,
      monthly_rent:
        body.monthly_rent !== undefined && body.monthly_rent !== null && body.monthly_rent !== ''
          ? String(body.monthly_rent)
          : null,
      lease_start: leaseStart,
      status: typeof body.status === 'string' ? body.status : undefined,
      access_code,
    };

    const [tenancy] = await db
      .insert(btrTenancies)
      .values(values)
      .returning();

    return NextResponse.json({ tenancy }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message.includes('UNAUTHORIZED') || error.message.includes('FORBIDDEN'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
