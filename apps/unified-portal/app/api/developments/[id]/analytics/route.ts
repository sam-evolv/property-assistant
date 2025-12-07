import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db/client';
import { messages, documents } from '@openhouse/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

// Create Supabase admin client for real unit data
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['developer', 'super_admin']);
    const projectId = params.id;

    // Fetch unit count and types from Supabase
    const { data: units, error: unitsError } = await supabaseAdmin
      .from('units')
      .select('*, unit_types(type_name)')
      .eq('project_id', projectId);

    if (unitsError) {
      console.error('[Analytics] Error fetching Supabase units:', unitsError);
    }

    const houseCount = units?.length || 0;

    // Aggregate house types from Supabase data
    const typeMap: Record<string, number> = {};
    (units || []).forEach(unit => {
      const typeName = unit.unit_types?.type_name || 'Unknown';
      typeMap[typeName] = (typeMap[typeName] || 0) + 1;
    });
    const houseTypes = Object.entries(typeMap).map(([type, count]) => ({ type, count }));

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Fetch message and document counts from legacy Drizzle database
    const [chatCount, documentCount, recentChatCount, messageVolumeData] =
      await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(messages)
          .where(eq(messages.development_id, projectId))
          .then((r) => r[0]?.count || 0),

        db
          .select({ count: sql<number>`count(*)::int` })
          .from(documents)
          .where(eq(documents.development_id, projectId))
          .then((r) => r[0]?.count || 0),

        db
          .select({ count: sql<number>`count(*)::int` })
          .from(messages)
          .where(
            and(
              eq(messages.development_id, projectId),
              gte(messages.created_at, thirtyDaysAgo)
            )
          )
          .then((r) => r[0]?.count || 0),

        db.select({
          date: sql<string>`DATE(${messages.created_at})`,
          count: sql<number>`count(*)::int`,
        })
          .from(messages)
          .where(
            and(
              eq(messages.development_id, projectId),
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

    console.log(`[Analytics] Project ${projectId}: ${houseCount} units from Supabase`);

    return NextResponse.json({
      houses: houseCount,
      chatMessages: chatCount,
      documents: documentCount,
      recentChatMessages: recentChatCount,
      houseTypes: houseTypes.length > 0
        ? houseTypes
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
