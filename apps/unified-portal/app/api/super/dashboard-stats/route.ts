import { NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { tenants, developments, units, admins, messages, onboardingSubmissions } from '@openhouse/db/schema';
import { sql, count, eq } from 'drizzle-orm';
import { requireRole } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireRole(['super_admin']);

    const [tenantsCount] = await db
      .select({ count: count() })
      .from(tenants);

    const [developmentsCount] = await db
      .select({ count: count() })
      .from(developments);

    let unitsCount = { count: 0 };
    try {
      [unitsCount] = await db
        .select({ count: count() })
        .from(units);
    } catch (e) {
      console.log('[Dashboard Stats] Units count failed, using 0');
    }

    const [adminsCount] = await db
      .select({ count: count() })
      .from(admins);

    let messagesCount = { count: 0 };
    try {
      [messagesCount] = await db
        .select({ count: count() })
        .from(messages);
    } catch (e) {
      console.log('[Dashboard Stats] Messages count failed, using 0');
    }

    let pendingSubmissions = { count: 0 };
    try {
      [pendingSubmissions] = await db
        .select({ count: count() })
        .from(onboardingSubmissions)
        .where(eq(onboardingSubmissions.status, 'pending'));
    } catch (e) {
      console.log('[Dashboard Stats] Pending submissions count failed, using 0');
    }

    let unitsWithPurchaser = { count: 0 };
    try {
      [unitsWithPurchaser] = await db
        .select({ count: count() })
        .from(units)
        .where(sql`${units.purchaser_name} IS NOT NULL AND ${units.purchaser_name} != ''`);
    } catch (e) {
      console.log('[Dashboard Stats] Units with purchaser count failed, using 0');
    }

    let recentActivity: any[] = [];
    try {
      const recentMessages = await db
        .select({
          id: messages.id,
          content: messages.user_message,
          created_at: messages.created_at,
        })
        .from(messages)
        .orderBy(sql`${messages.created_at} DESC`)
        .limit(5);

      recentActivity = recentMessages.map((m) => ({
        id: m.id,
        type: 'question',
        description: m.content?.slice(0, 100) || 'Question asked',
        timestamp: m.created_at,
      }));
    } catch (e) {
      console.log('[Dashboard Stats] Recent activity failed');
    }

    return NextResponse.json({
      stats: {
        developers: Number(tenantsCount?.count || 0),
        developments: Number(developmentsCount?.count || 0),
        units: Number(unitsCount?.count || 0),
        questions: Number(messagesCount?.count || 0),
        admins: Number(adminsCount?.count || 0),
        unitsWithPurchaser: Number(unitsWithPurchaser?.count || 0),
      },
      pending: {
        submissions: Number(pendingSubmissions?.count || 0),
      },
      recentActivity,
      health: {
        database: 'healthy',
        api: 'healthy',
      },
    });
  } catch (error: any) {
    console.error('[Dashboard Stats API] Error:', error);
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
