import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db/client';
import { messages, documents, developments } from '@openhouse/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { logDataAccess } from '@/lib/gdpr-audit-log';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const REAL_PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['developer', 'super_admin']);
    const supabaseAdmin = getSupabaseAdmin();
    const developmentId = (await params).id;
    
    const [dev] = await db.select({ name: developments.name }).from(developments).where(eq(developments.id, developmentId)).limit(1);
    await logDataAccess({
      accessorId: session.id,
      accessorEmail: session.email,
      accessorRole: session.role,
      tenantId: session.tenantId,
      action: 'viewed_chat_analytics',
      resourceType: 'development_messages',
      resourceId: developmentId,
      resourceDescription: `Viewed chat analytics for ${dev?.name || 'development'}`,
    });
    
    console.log('[Analytics] Fetching for project:', REAL_PROJECT_ID);

    // Simple count query without join
    const { count: houseCount, error } = await supabaseAdmin
      .from('units')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', REAL_PROJECT_ID);

    if (error) {
      console.error('[Analytics] Error:', error);
    }

    console.log('[Analytics] Houses:', houseCount);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [chatCount, documentCount, recentChatCount, messageVolumeData] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(messages)
        .where(eq(messages.development_id, developmentId)).then((r) => r[0]?.count || 0),
      db.select({ count: sql<number>`count(*)::int` }).from(documents)
        .where(eq(documents.development_id, developmentId)).then((r) => r[0]?.count || 0),
      db.select({ count: sql<number>`count(*)::int` }).from(messages)
        .where(and(eq(messages.development_id, developmentId), gte(messages.created_at, thirtyDaysAgo)))
        .then((r) => r[0]?.count || 0),
      db.select({
        date: sql<string>`DATE(${messages.created_at})`,
        count: sql<number>`count(*)::int`,
      }).from(messages)
        .where(and(eq(messages.development_id, developmentId), gte(messages.created_at, thirtyDaysAgo)))
        .groupBy(sql`DATE(${messages.created_at})`)
        .orderBy(sql`DATE(${messages.created_at})`),
    ]);

    const messageVolume = [];
    const chatCosts = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dataPoint = messageVolumeData.find(d => d.date === dateStr);
      const count = dataPoint?.count || 0;
      messageVolume.push({ date: dateStr, count });
      chatCosts.push({ date: dateStr, cost: parseFloat((count * 0.002).toFixed(3)) });
    }

    return NextResponse.json({
      houses: houseCount || 0,
      chatMessages: chatCount,
      documents: documentCount,
      recentChatMessages: recentChatCount,
      houseTypes: [{ type: 'Standard', count: houseCount || 0 }],
      messageVolume,
      chatCosts,
    });
  } catch (error) {
    console.error('[Analytics] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
