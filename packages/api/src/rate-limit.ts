import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 15;

export async function checkRateLimit(
  identifier: string,
  tenantId: string
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    
    const result = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int as count
      FROM rate_events
      WHERE identifier = ${identifier}
        AND tenant_id = ${tenantId}::uuid
        AND created_at > ${windowStart.toISOString()}
    `);
    
    const count = (result.rows[0]?.count as number) || 0;
    const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - count);
    
    if (count >= MAX_REQUESTS_PER_WINDOW) {
      return { allowed: false, remaining: 0 };
    }
    
    await db.execute(sql`
      INSERT INTO rate_events (identifier, tenant_id, created_at)
      VALUES (${identifier}, ${tenantId}::uuid, NOW())
    `);
    
    return { allowed: true, remaining: remaining - 1 };
  } catch (error) {
    console.error('Rate limit check error:', error);
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW };
  }
}
