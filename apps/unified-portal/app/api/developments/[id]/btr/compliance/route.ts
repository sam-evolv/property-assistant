import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { complianceSchedule } from '@openhouse/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireRole } from '@/lib/supabase-server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['super_admin', 'admin', 'developer']);
    const body = await request.json();
    const { itemId, ...updates } = body;

    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    }

    if (updates.completed_date) {
      updates.status = 'completed';
    }

    const [updated] = await db
      .update(complianceSchedule)
      .set({ ...updates, updated_at: new Date() })
      .where(and(eq(complianceSchedule.id, itemId), eq(complianceSchedule.development_id, params.id)))
      .returning();

    if (updated && updates.completed_date && updated.recurrence_months) {
      const nextDue = new Date(updates.completed_date);
      nextDue.setMonth(nextDue.getMonth() + updated.recurrence_months);
      await db.insert(complianceSchedule).values({
        development_id: updated.development_id,
        unit_id: updated.unit_id,
        type: updated.type,
        title: updated.title,
        description: updated.description,
        due_date: nextDue,
        recurrence_months: updated.recurrence_months,
        provider_name: updated.provider_name,
        provider_contact: updated.provider_contact,
        status: 'upcoming',
      });
    }

    return NextResponse.json({ item: updated });
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

    const items = await db
      .select()
      .from(complianceSchedule)
      .where(eq(complianceSchedule.development_id, developmentId))
      .orderBy(desc(complianceSchedule.created_at));

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

    let status = 'upcoming';
    if (body.due_date) {
      const dueDate = new Date(body.due_date);
      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      if (dueDate < now) {
        status = 'overdue';
      } else if (dueDate <= thirtyDaysFromNow) {
        status = 'due_soon';
      }
    }

    const [item] = await db
      .insert(complianceSchedule)
      .values({
        ...body,
        development_id: developmentId,
        status: body.status || status,
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
