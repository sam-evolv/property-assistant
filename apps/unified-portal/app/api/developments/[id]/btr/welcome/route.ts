import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { welcomeSequences } from '@openhouse/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireRole } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['super_admin', 'admin', 'developer']);
    const developmentId = params.id;

    const items = await db
      .select()
      .from(welcomeSequences)
      .where(eq(welcomeSequences.development_id, developmentId))
      .orderBy(desc(welcomeSequences.created_at));

    return NextResponse.json({ items });
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

    const [item] = await db
      .insert(welcomeSequences)
      .values({
        ...body,
        development_id: developmentId,
      })
      .returning();

    return NextResponse.json({ item }, { status: 201 });
  } catch (error: any) {
    if (error?.message?.includes('UNAUTHORIZED') || error?.message?.includes('FORBIDDEN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[BTR API] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
