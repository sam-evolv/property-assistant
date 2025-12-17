export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { developments, messages, documents, homeowners } from '@openhouse/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['super_admin', 'admin']);
    const developmentId = params.id;
    
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') || 'timeline';

    const development = await db.query.developments.findFirst({
      where: eq(developments.id, developmentId),
    });

    if (!development) {
      return NextResponse.json({ error: 'Development not found' }, { status: 404 });
    }

    if (tab === 'timeline') {
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sixtyDaysAgo = new Date(now);
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const oneEightyDaysAgo = new Date(now);
      oneEightyDaysAgo.setDate(oneEightyDaysAgo.getDate() - 180);

      const [messages30d, messages60d, messages90d, messages180d, docsTimeline, homeownersTimeline] = await Promise.all([
        db
          .select({
            date: sql<string>`DATE(${messages.created_at})`,
            count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
          })
          .from(messages)
          .where(and(eq(messages.development_id, developmentId), gte(messages.created_at, thirtyDaysAgo)))
          .groupBy(sql`DATE(${messages.created_at})`)
          .orderBy(sql`DATE(${messages.created_at})`),

        db
          .select({
            date: sql<string>`DATE(${messages.created_at})`,
            count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
          })
          .from(messages)
          .where(and(eq(messages.development_id, developmentId), gte(messages.created_at, sixtyDaysAgo)))
          .groupBy(sql`DATE(${messages.created_at})`)
          .orderBy(sql`DATE(${messages.created_at})`),

        db
          .select({
            date: sql<string>`DATE(${messages.created_at})`,
            count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
          })
          .from(messages)
          .where(and(eq(messages.development_id, developmentId), gte(messages.created_at, ninetyDaysAgo)))
          .groupBy(sql`DATE(${messages.created_at})`)
          .orderBy(sql`DATE(${messages.created_at})`),

        db
          .select({
            date: sql<string>`DATE(${messages.created_at})`,
            count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
          })
          .from(messages)
          .where(and(eq(messages.development_id, developmentId), gte(messages.created_at, oneEightyDaysAgo)))
          .groupBy(sql`DATE(${messages.created_at})`)
          .orderBy(sql`DATE(${messages.created_at})`),

        db
          .select({
            date: sql<string>`DATE(${documents.created_at})`,
            count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
            doc_names: sql<string[]>`ARRAY_AGG(${documents.title})`,
          })
          .from(documents)
          .where(and(eq(documents.development_id, developmentId), gte(documents.created_at, thirtyDaysAgo)))
          .groupBy(sql`DATE(${documents.created_at})`)
          .orderBy(sql`DATE(${documents.created_at})`),

        db
          .select({
            date: sql<string>`DATE(${homeowners.created_at})`,
            count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
            homeowner_names: sql<string[]>`ARRAY_AGG(${homeowners.unique_qr_token})`,
          })
          .from(homeowners)
          .where(and(eq(homeowners.development_id, developmentId), gte(homeowners.created_at, thirtyDaysAgo)))
          .groupBy(sql`DATE(${homeowners.created_at})`)
          .orderBy(sql`DATE(${homeowners.created_at})`),
      ]);

      const fillGaps = (data: Array<{ date: string; count: number }>, days: number) => {
        const filled: Array<{ date: string; count: number }> = [];
        const dataMap = new Map(data.map(d => [d.date, d.count]));
        
        for (let i = days - 1; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          filled.push({
            date: dateStr,
            count: dataMap.get(dateStr) || 0,
          });
        }
        return filled;
      };

      const milestones = [
        {
          date: development.created_at?.toISOString() || new Date().toISOString(),
          event: 'Development Created',
          description: `${development.name} was added to the platform`,
        },
      ];

      return NextResponse.json({
        timeline: {
          messageVolume30d: fillGaps(messages30d, 30),
          messageVolume60d: fillGaps(messages60d, 60),
          messageVolume90d: fillGaps(messages90d, 90),
          messageVolume180d: fillGaps(messages180d, 180),
          documentUploads: fillGaps(docsTimeline.map(d => ({ date: d.date, count: d.count })), 30),
          homeownerOnboarding: fillGaps(homeownersTimeline.map(d => ({ date: d.date, count: d.count })), 30),
          milestones,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid tab' }, { status: 400 });
  } catch (error) {
    console.error('[Development Analytics Error]', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
