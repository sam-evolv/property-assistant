export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { complianceSchedule, developments } from '@openhouse/db/schema';
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
    // The compliance page sends `id`; older callers send `itemId`.
    const itemId = body.itemId ?? body.id;

    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    }

    // SECURITY: whitelist updatable fields — never allow id/development_id/unit_id overrides
    const updates: Partial<typeof complianceSchedule.$inferInsert> = {};
    if (typeof body.status === 'string') updates.status = body.status;
    if (body.completed_date !== undefined) updates.completed_date = toDateOrNull(body.completed_date);
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.certificate_number !== undefined) updates.certificate_number = body.certificate_number;
    if (body.document_url !== undefined) updates.document_url = body.document_url;

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

    const items = await db
      .select()
      .from(complianceSchedule)
      .where(eq(complianceSchedule.development_id, developmentId))
      .orderBy(desc(complianceSchedule.created_at));

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

    const dueDate = toDateOrNull(body?.due_date);
    if (!body?.type || !body?.title || !dueDate) {
      return NextResponse.json({ error: 'type, title and due_date are required' }, { status: 400 });
    }

    const recurrence = Number(body.recurrence_months);

    // SECURITY: whitelist fields — never allow id/development_id overrides from the body
    const values: typeof complianceSchedule.$inferInsert = {
      development_id: developmentId,
      type: String(body.type),
      title: String(body.title),
      description: body.description ?? null,
      due_date: dueDate,
      recurrence_months: Number.isFinite(recurrence) && recurrence > 0 ? recurrence : null,
      provider_name: body.provider_name ?? null,
      status,
    };

    const [item] = await db
      .insert(complianceSchedule)
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
