import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';

const BATCH_SIZE = 1000;

async function cleanupBatch(table: string, timeColumn: string): Promise<number> {
  let totalDeleted = 0;
  
  while (true) {
    const result = await db.execute<{ count: number }>(sql`
      WITH deleted AS (
        DELETE FROM ${sql.raw(table)}
        WHERE ${sql.raw(timeColumn)} < CURRENT_TIMESTAMP
        AND ctid IN (
          SELECT ctid FROM ${sql.raw(table)}
          WHERE ${sql.raw(timeColumn)} < CURRENT_TIMESTAMP
          LIMIT ${BATCH_SIZE}
        )
        RETURNING 1
      )
      SELECT COUNT(*) as count FROM deleted
    `);
    
    const batchDeleted = result.rows?.[0]?.count ? Number(result.rows[0].count) : 0;
    totalDeleted += batchDeleted;
    
    if (batchDeleted < BATCH_SIZE) {
      break;
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return totalDeleted;
}

export async function cleanupExpiredCache(): Promise<void> {
  try {
    const cacheDeleted = await cleanupBatch('api_cache', 'expiry');
    const rateLimitsDeleted = await cleanupBatch('rate_limits', 'reset_time');
    
    const sessionsResult = await db.execute(sql`
      DELETE FROM sessions
      WHERE expires_at < NOW() - INTERVAL '7 days'
      OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days')
    `);
    const sessionsDeleted = sessionsResult.rowCount || 0;
    
    if (cacheDeleted > 0 || rateLimitsDeleted > 0 || sessionsDeleted > 0) {
      console.log(`[Cleanup] Removed ${cacheDeleted} expired cache entries, ${rateLimitsDeleted} expired rate limits, ${sessionsDeleted} old sessions`);
    }
  } catch (error) {
    console.error('[Cleanup] Error cleaning up expired entries:', error);
  }
}

let cleanupInterval: NodeJS.Timeout | null = null;

export function startCleanupWorker(intervalMinutes: number = 5): void {
  if (cleanupInterval) {
    return;
  }

  cleanupExpiredCache();

  cleanupInterval = setInterval(
    () => cleanupExpiredCache(),
    intervalMinutes * 60 * 1000
  );

  console.log(`[Cleanup Worker] Started with ${intervalMinutes} minute interval`);
}

export function stopCleanupWorker(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('[Cleanup Worker] Stopped');
  }
}
