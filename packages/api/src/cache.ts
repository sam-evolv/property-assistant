import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';

class DatabaseCache<T> {
  private readonly defaultTTL: number;

  constructor(defaultTTLSeconds: number = 60) {
    this.defaultTTL = defaultTTLSeconds;
  }

  async set(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds || this.defaultTTL;
    const expiry = new Date(Date.now() + ttl * 1000);

    try {
      await db.execute(sql`
        INSERT INTO api_cache (cache_key, value, expiry)
        VALUES (${key}, ${JSON.stringify(value)}::jsonb, ${expiry.toISOString()}::timestamp)
        ON CONFLICT (cache_key) DO UPDATE SET
          value = ${JSON.stringify(value)}::jsonb,
          expiry = ${expiry.toISOString()}::timestamp,
          updated_at = CURRENT_TIMESTAMP
      `);
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async get(key: string): Promise<T | null> {
    try {
      const result = await db.execute<{ value: any; expiry: string }>(sql`
        SELECT value, expiry FROM api_cache
        WHERE cache_key = ${key} AND expiry > CURRENT_TIMESTAMP
        LIMIT 1
      `);

      if (result.rows && result.rows.length > 0) {
        return result.rows[0].value as T;
      }

      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const result = await db.execute(sql`
        SELECT 1 FROM api_cache
        WHERE cache_key = ${key} AND expiry > CURRENT_TIMESTAMP
        LIMIT 1
      `);

      return result.rows && result.rows.length > 0;
    } catch (error) {
      console.error('Cache has error:', error);
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await db.execute(sql`DELETE FROM api_cache WHERE cache_key = ${key}`);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      await db.execute(sql`DELETE FROM api_cache WHERE cache_key ~ ${pattern}`);
    } catch (error) {
      console.error('Cache invalidate pattern error:', error);
    }
  }

  async getOrSetJSON<R = any>(
    key: string,
    compute: () => Promise<R>,
    ttlSeconds?: number
  ): Promise<R> {
    const cached = await this.get(key);

    if (cached !== null) {
      return cached as R;
    }

    const value = await compute();
    await this.set(key as any, value as any, ttlSeconds);
    return value;
  }

  async clear(): Promise<void> {
    try {
      await db.execute(sql`DELETE FROM api_cache`);
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }
}

export const apiCache = new DatabaseCache<any>(60);
export const developmentCache = new DatabaseCache<any>(30);

export async function getOrSetJSON<T>(
  key: string,
  compute: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> {
  return apiCache.getOrSetJSON(key, compute, ttlSeconds);
}
