import { NextRequest, NextResponse } from 'next/server';
import { db, faqEntries } from '@openhouse/db';
import { eq, and, desc } from 'drizzle-orm';
import { getServerSession } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get('developmentId');

    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let whereClause = eq(faqEntries.tenant_id, session.tenantId);
    
    if (developmentId) {
      whereClause = and(
        eq(faqEntries.tenant_id, session.tenantId),
        eq(faqEntries.development_id, developmentId)
      ) as any;
    }

    const faqs = await db.select({
      id: faqEntries.id,
      question: faqEntries.question,
      answer: faqEntries.answer,
      topic: faqEntries.topic,
      tags: faqEntries.tags,
      priority: faqEntries.priority,
      status: faqEntries.status,
      created_at: faqEntries.created_at,
      updated_at: faqEntries.updated_at,
    })
    .from(faqEntries)
    .where(whereClause)
    .orderBy(desc(faqEntries.priority), desc(faqEntries.created_at));

    return NextResponse.json({ faqs });
  } catch (error) {
    console.error('[FAQ API] GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch FAQs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { question, answer, topic, tags, priority, status, developmentId } = body;

    if (!question || !answer) {
      return NextResponse.json({ error: 'Question and answer are required' }, { status: 400 });
    }

    const [newFaq] = await db.insert(faqEntries).values({
      tenant_id: session.tenantId,
      development_id: developmentId || null,
      question,
      answer,
      topic: topic || 'general',
      tags: tags || [],
      priority: priority || 0,
      status: status || 'published',
      created_by: session.id,
      updated_by: session.id,
    }).returning();

    console.log('[FAQ API] Created FAQ:', newFaq.id);
    return NextResponse.json({ faq: newFaq });
  } catch (error) {
    console.error('[FAQ API] POST Error:', error);
    return NextResponse.json({ error: 'Failed to create FAQ' }, { status: 500 });
  }
}
