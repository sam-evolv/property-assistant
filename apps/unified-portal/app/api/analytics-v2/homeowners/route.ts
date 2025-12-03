import { db } from '@openhouse/db';
import { homeowners, developments } from '@openhouse/db/schema';
import { sql } from 'drizzle-orm';
import { 
  validateAnalyticsQuery, 
  handleAnalyticsError, 
  safeNumber,
  calculateStartDate
} from '@/lib/analytics-validation';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = validateAnalyticsQuery(searchParams);
    const startDate = calculateStartDate(query.days);

    const developmentFilter = query.developmentId ? sql`AND h.development_id = ${query.developmentId}` : sql``;
    const tenantFilter = query.tenantId ? sql`AND h.tenant_id = ${query.tenantId}` : sql``;

    const [metrics, topHomeowner] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(DISTINCT h.id)::int as total_homeowners,
          COUNT(DISTINCT CASE WHEN h.last_active >= ${startDate} THEN h.id END)::int as active_homeowners,
          AVG(h.total_chats)::float as avg_chats_per_homeowner
        FROM homeowners h
        WHERE 1=1
          ${developmentFilter}
          ${tenantFilter}
      `).then(r => r.rows[0]),

      db.execute(sql`
        SELECT h.name, h.total_chats
        FROM homeowners h
        WHERE h.total_chats > 0
          ${developmentFilter}
          ${tenantFilter}
        ORDER BY h.total_chats DESC
        LIMIT 1
      `).then(r => r.rows[0] || null)
    ]);

    const totalHomeowners = safeNumber(metrics?.total_homeowners, 0);
    const activeHomeowners = safeNumber(metrics?.active_homeowners, 0);

    return NextResponse.json({
      totalHomeowners,
      activeHomeowners,
      avgChatsPerHomeowner: safeNumber(metrics?.avg_chats_per_homeowner, 0),
      topHomeowner: topHomeowner ? {
        name: topHomeowner.name,
        total_chats: safeNumber(topHomeowner.total_chats, 0)
      } : null,
    });
  } catch (error) {
    return handleAnalyticsError(error, 'homeowner metrics');
  }
}
