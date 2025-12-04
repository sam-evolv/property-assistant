import { db } from '@openhouse/db';
import { units, homeowners, messages } from '@openhouse/db/schema';
import { sql } from 'drizzle-orm';
import { 
  validateAnalyticsQuery, 
  handleAnalyticsError, 
  safeAnalyticsResponse,
  unitMetricsSchema,
  safeNumber,
  safeString,
  calculateStartDate
} from '@/lib/analytics-validation';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = validateAnalyticsQuery(searchParams);
    const startDate = calculateStartDate(query.days);
    
    const developmentFilter = query.developmentId ? sql`AND u.development_id = ${query.developmentId}` : sql``;
    const tenantFilter = query.tenantId ? sql`AND u.tenant_id = ${query.tenantId}` : sql``;

    const [unitMetrics, topUnit, unitsWithMessages] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(DISTINCT u.id)::int as total_units,
          COUNT(DISTINCT CASE WHEN h.id IS NOT NULL THEN u.id END)::int as occupied_units
        FROM units u
        LEFT JOIN homeowners h ON h.address = u.address_line_1 AND h.development_id = u.development_id
        WHERE 1=1
          ${developmentFilter}
          ${tenantFilter}
      `).then(r => r.rows[0]),

      db.execute(sql`
        SELECT u.unit_number, COUNT(m.id)::int as message_count
        FROM units u
        INNER JOIN messages m ON m.house_id = u.id
        WHERE 1=1
          ${developmentFilter}
          ${tenantFilter}
        GROUP BY u.id, u.unit_number
        ORDER BY message_count DESC
        LIMIT 1
      `).then(r => r.rows[0]?.unit_number || null),
      
      db.execute(sql`
        SELECT COUNT(DISTINCT u.id)::int as count
        FROM units u
        INNER JOIN messages m ON m.house_id = u.id
        WHERE 1=1
          ${developmentFilter}
          ${tenantFilter}
      `).then(r => safeNumber(r.rows[0]?.count, 0))
    ]);

    // Build combined filter for messages query (tenant + development)
    const tenantAnd = query.tenantId ? sql`AND tenant_id = ${query.tenantId}` : sql``;
    const msgCombinedFilter = sql.join([tenantAnd, query.developmentId ? sql`AND development_id = ${query.developmentId}` : sql``], sql.raw(' '));
    
    const totalMessages = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM messages WHERE 1=1 ${msgCombinedFilter}
    `).then(r => safeNumber(r.rows[0]?.count, 0));

    const totalUnits = safeNumber(unitMetrics?.total_units, 0);
    const avgMessagesPerUnit = totalUnits > 0 ? totalMessages / totalUnits : 0;

    const response = {
      totalUnits,
      occupiedUnits: safeNumber(unitMetrics?.occupied_units, 0),
      unitsWithActivity: unitsWithMessages,
      avgMessagesPerUnit,
      topActiveUnit: topUnit,
    };

    return safeAnalyticsResponse(response, unitMetricsSchema);
  } catch (error) {
    return handleAnalyticsError(error, 'unit metrics');
  }
}
