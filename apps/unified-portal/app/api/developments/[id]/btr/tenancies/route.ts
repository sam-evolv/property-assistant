import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { btrTenancies, units } from '@openhouse/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireRole } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['super_admin', 'admin', 'developer']);
    const developmentId = params.id;

    const tenancies = await db
      .select()
      .from(btrTenancies)
      .where(eq(btrTenancies.development_id, developmentId))
      .orderBy(desc(btrTenancies.created_at));

    return NextResponse.json({ tenancies });
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

    const access_code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const [tenancy] = await db
      .insert(btrTenancies)
      .values({
        ...body,
        development_id: developmentId,
        access_code,
      })
      .returning();

    return NextResponse.json({ tenancy }, { status: 201 });
  } catch (error: any) {
    if (error?.message?.includes('UNAUTHORIZED') || error?.message?.includes('FORBIDDEN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[BTR API] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
