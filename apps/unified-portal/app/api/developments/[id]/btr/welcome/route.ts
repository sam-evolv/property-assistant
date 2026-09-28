export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { welcomeSequences, developments } from '@openhouse/db/schema';
import { eq, desc } from 'drizzle-orm';
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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['super_admin', 'admin', 'developer']);
    const ownershipError = await assertDevelopmentOwnership(session, params.id);
    if (ownershipError) return ownershipError;
    const developmentId = params.id;

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
    const ownershipError = await assertDevelopmentOwnership(session, params.id);
    if (ownershipError) return ownershipError;
    const developmentId = params.id;
    const body = await request.json();

    if (!body?.title || !body?.message) {
      return NextResponse.json({ error: 'title and message are required' }, { status: 400 });
    }

    // SECURITY: whitelist fields — never allow id/development_id overrides from the body
    const dayNumber = Number(body.day_number);
    const values: typeof welcomeSequences.$inferInsert = {
      development_id: developmentId,
      day_number: Number.isFinite(dayNumber) ? dayNumber : 1,
      title: String(body.title),
      message: String(body.message),
      category: body.category ?? undefined,
    };

    const [item] = await db
      .insert(welcomeSequences)
      .values(values)
      .returning();

    return NextResponse.json({ item }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message.includes('UNAUTHORIZED') || error.message.includes('FORBIDDEN'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
