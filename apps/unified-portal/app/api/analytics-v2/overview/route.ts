import { db } from '@openhouse/db';
import { developments, messages, homeowners, documents } from '@openhouse/db/schema';
import { sql } from 'drizzle-orm';
import { 
  validateAnalyticsQuery, 
  handleAnalyticsError, 
  safeAnalyticsResponse,
  overviewResponseSchema,
  safeNumber,
  safeString,
  calculateStartDate
} from '@/lib/analytics-validation';
import { analyticsCache, createCacheKey } from '@/lib/analytics-cache';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = validateAnalyticsQuery(searchParams);
    
    // Check cache first
    const cacheKey = createCacheKey('overview', query);
    const cached = analyticsCache.get(cacheKey);
    if (cached) {
      return safeAnalyticsResponse(cached, overviewResponseSchema);
    }
    
    const startDate = calculateStartDate(query.days);

    // Build tenant and development filters for proper isolation
    // Unaliased filters for most tables
    const tenantAnd = query.tenantId ? sql`AND tenant_id = ${query.tenantId}` : sql``;
    const developmentAnd = query.developmentId ? sql`AND development_id = ${query.developmentId}` : sql``;
    const combinedFilter = sql.join([tenantAnd, developmentAnd], sql.raw(' '));
    
    // Aliased filters for developments table queries (d.tenant_id, d.development_id)
    const devTenantAnd = query.tenantId ? sql`AND d.tenant_id = ${query.tenantId}` : sql``;
    const devDevelopmentAnd = query.developmentId ? sql`AND d.id = ${query.developmentId}` : sql``;
    const devCombinedFilter = sql.join([devTenantAnd, devDevelopmentAnd], sql.raw(' '));
    
    // WHERE clause version for development queries (includes both tenant and development filtering)
    const devCombinedWhere = query.tenantId || query.developmentId 
      ? sql`WHERE 1=1 ${devCombinedFilter}` 
      : sql``;

    const [devCount, msgCount, homeownerCount, docCount, activeUsers, chunkCount, topDev, avgStats] = await Promise.all([
      db.execute(sql`SELECT COUNT(*)::int as count FROM developments d ${devCombinedWhere}`).then(r => safeNumber(r.rows[0]?.count, 0)),
      db.execute(sql`SELECT COUNT(*)::int as count FROM messages WHERE 1=1 ${combinedFilter}`).then(r => safeNumber(r.rows[0]?.count, 0)),
      db.execute(sql`SELECT COUNT(*)::int as count FROM homeowners WHERE 1=1 ${combinedFilter}`).then(r => safeNumber(r.rows[0]?.count, 0)),
      db.execute(sql`SELECT COUNT(*)::int as count FROM documents WHERE 1=1 ${combinedFilter}`).then(r => safeNumber(r.rows[0]?.count, 0)),
      db.execute(sql`
        SELECT COUNT(DISTINCT house_id)::int as count
        FROM messages
        WHERE created_at >= ${startDate} 
          AND house_id IS NOT NULL
          ${combinedFilter}
      `).then(r => safeNumber(r.rows[0]?.count, 0)),
      db.execute(sql`SELECT COUNT(*)::int as count FROM doc_chunks WHERE 1=1 ${combinedFilter}`).then(r => safeNumber(r.rows[0]?.count, 0)),
      db.execute(sql`
        SELECT d.name
        FROM developments d
        LEFT JOIN messages m ON m.development_id = d.id AND m.tenant_id = d.tenant_id
        ${devCombinedWhere}
        GROUP BY d.id, d.name
        ORDER BY COUNT(m.id) DESC
        LIMIT 1
      `).then(r => safeString(r.rows[0]?.name, 'No data yet')),
      db.execute(sql`
        SELECT 
          1000::float as avg_response_ms,
          AVG((metadata->>'token_cost')::float)::float as avg_cost
        FROM messages
        WHERE created_at >= ${startDate}
          ${combinedFilter}
      `).then(r => r.rows[0] || {}),
    ]);

    const overview = {
      totalDevelopments: devCount,
      totalMessages: msgCount,
      totalHomeowners: homeownerCount,
      totalDocuments: docCount,
      activeUsers: activeUsers,
      avgResponseTime: safeNumber(avgStats.avg_response_ms, 0),
      avgCostPerMessage: safeNumber(avgStats.avg_cost, 0),
      satisfactionScore: 0,
      peakUsageHour: 0,
      topDevelopment: topDev,
      embeddingChunks: chunkCount,
    };

    // Cache the result
    analyticsCache.set(cacheKey, overview);

    return safeAnalyticsResponse(overview, overviewResponseSchema);
  } catch (error) {
    return handleAnalyticsError(error, 'overview');
  }
}
