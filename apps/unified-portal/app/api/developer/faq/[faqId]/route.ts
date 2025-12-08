import { NextRequest, NextResponse } from 'next/server';
import { db, faqEntries } from '@openhouse/db';
import { eq, and } from 'drizzle-orm';
import { getServerSession } from '@/lib/supabase-server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { faqId: string } }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { question, answer, topic, tags, priority, status } = body;

    const updateData: any = { updated_at: new Date(), updated_by: session.id };
    if (question !== undefined) updateData.question = question;
    if (answer !== undefined) updateData.answer = answer;
    if (topic !== undefined) updateData.topic = topic;
    if (tags !== undefined) updateData.tags = tags;
    if (priority !== undefined) updateData.priority = priority;
    if (status !== undefined) updateData.status = status;

    const [updatedFaq] = await db.update(faqEntries)
      .set(updateData)
      .where(and(
        eq(faqEntries.id, params.faqId),
        eq(faqEntries.tenant_id, session.tenantId)
      ))
      .returning();

    if (!updatedFaq) {
      return NextResponse.json({ error: 'FAQ not found' }, { status: 404 });
    }

    console.log('[FAQ API] Updated FAQ:', params.faqId);
    return NextResponse.json({ faq: updatedFaq });
  } catch (error) {
    console.error('[FAQ API] PATCH Error:', error);
    return NextResponse.json({ error: 'Failed to update FAQ' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { faqId: string } }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [deletedFaq] = await db.delete(faqEntries)
      .where(and(
        eq(faqEntries.id, params.faqId),
        eq(faqEntries.tenant_id, session.tenantId)
      ))
      .returning();

    if (!deletedFaq) {
      return NextResponse.json({ error: 'FAQ not found' }, { status: 404 });
    }

    console.log('[FAQ API] Deleted FAQ:', params.faqId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[FAQ API] DELETE Error:', error);
    return NextResponse.json({ error: 'Failed to delete FAQ' }, { status: 500 });
  }
}
