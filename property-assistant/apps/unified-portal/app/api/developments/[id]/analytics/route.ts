import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { developments, homeowners, units, messages, documents } from '@openhouse/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['developer', 'super_admin']);
    const developmentId = params.id;

    const development = await db.query.developments.findFirst({
      where: and(
        eq(developments.id, developmentId),
        eq(developments.tenant_id, session.tenantId)
      ),
    });

    if (!development) {
      return NextResponse.json({ error: 'Development not found' }, { status: 404 });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [houseCount, chatCount, documentCount, recentChatCount, houseTypes, messageVolumeData] =
      await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(units)
          .where(eq(units.development_id, developmentId))
          .then((r) => r[0]?.count || 0),

        db
          .select({ count: sql<number>`count(*)::int` })
          .from(messages)
          .where(eq(messages.development_id, developmentId))
          .then((r) => r[0]?.count || 0),

        db
          .select({ count: sql<number>`count(*)::int` })
          .from(documents)
          .where(eq(documents.development_id, developmentId))
          .then((r) => r[0]?.count || 0),

        db
          .select({ count: sql<number>`count(*)::int` })
          .from(messages)
          .where(
            and(
              eq(messages.development_id, developmentId),
              gte(messages.created_at, thirtyDaysAgo)
            )
          )
          .then((r) => r[0]?.count || 0),

        db
          .select({
            house_type: units.house_type_code,
            count: sql<number>`count(*)::int`,
          })
          .from(units)
          .where(eq(units.development_id, developmentId))
          .groupBy(units.house_type_code),

        db.select({
          date: sql<string>`DATE(${messages.created_at})`,
          count: sql<number>`count(*)::int`,
        })
          .from(messages)
          .where(
            and(
              eq(messages.development_id, developmentId),
              gte(messages.created_at, thirtyDaysAgo)
            )
          )
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
      messageVolume.push({
        date: dateStr,
        count,
      });
      chatCosts.push({
        date: dateStr,
        cost: parseFloat((count * 0.002).toFixed(3)),
      });
    }

    return NextResponse.json({
      houses: houseCount,
      chatMessages: chatCount,
      documents: documentCount,
      recentChatMessages: recentChatCount,
      houseTypes: houseTypes.length > 0
        ? houseTypes.map((stat) => ({
            type: stat.house_type || 'Unknown',
            count: stat.count,
          }))
        : [{ type: 'No Data', count: 0 }],
      messageVolume,
      chatCosts,
    });
  } catch (error) {
    console.error('[Development Analytics Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch development analytics' },
      { status: 500 }
    );
  }
}
