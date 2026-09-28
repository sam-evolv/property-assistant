export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { btrAmenities, developments } from '@openhouse/db/schema';
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

    const amenities = await db
      .select()
      .from(btrAmenities)
      .where(eq(btrAmenities.development_id, developmentId))
      .orderBy(desc(btrAmenities.created_at));

    return NextResponse.json({ amenities });
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

    if (!body?.name || !body?.type) {
      return NextResponse.json({ error: 'name and type are required' }, { status: 400 });
    }

    // SECURITY: whitelist fields — never allow id/development_id overrides from the body
    const values: typeof btrAmenities.$inferInsert = {
      development_id: developmentId,
      name: String(body.name),
      type: String(body.type),
      description: body.description ?? null,
      location: body.location ?? null,
      capacity: body.capacity ?? null,
      max_duration_hours: body.max_duration_hours ?? undefined,
      max_advance_days: body.max_advance_days ?? undefined,
      is_bookable: body.is_bookable ?? undefined,
    };

    const [amenity] = await db
      .insert(btrAmenities)
      .values(values)
      .returning();

    return NextResponse.json({ amenity }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message.includes('UNAUTHORIZED') || error.message.includes('FORBIDDEN'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
