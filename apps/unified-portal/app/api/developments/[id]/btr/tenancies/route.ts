export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { btrTenancies, developments } from '@openhouse/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requireRole } from '@/lib/supabase-server';

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

    const access_code = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Strip client-supplied identifiers to prevent mass-assignment; tenant_id derives from the development
    const { id: _id, tenant_id: _tenantId, ...tenancyData } = body;

    const [tenancy] = await db
      .insert(btrTenancies)
      .values({
        ...tenancyData,
        development_id: developmentId,
        tenant_id: development.tenant_id,
        access_code,
      })
      .returning();

    return NextResponse.json({ tenancy }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message.includes('UNAUTHORIZED') || error.message.includes('FORBIDDEN'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
