export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { welcomeSequences, developments } from '@openhouse/db/schema';
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

    const items = await db
      .select()
      .from(welcomeSequences)
      .where(eq(welcomeSequences.development_id, developmentId))
      .orderBy(desc(welcomeSequences.created_at));

    return NextResponse.json({ items });
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

    // Strip client-supplied tenant_id to prevent mass-assignment
    const { tenant_id: _tenantId, ...itemData } = body;

    const [item] = await db
      .insert(welcomeSequences)
      .values({
        ...itemData,
        development_id: developmentId,
      })
      .returning();

    return NextResponse.json({ item }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message.includes('UNAUTHORIZED') || error.message.includes('FORBIDDEN'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
