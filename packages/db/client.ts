import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolClient, PoolConfig } from 'pg';
import * as schema from './schema';

// Use global cache to survive Next.js HMR (Hot Module Reloading)
const globalForDb = globalThis as unknown as {
  dbPool: Pool | undefined;
  drizzleDb: ReturnType<typeof drizzle> | undefined;
};

// Lazy-initialize connection pool to prevent blocking Next.js startup
let pool: Pool | null = globalForDb.dbPool ?? null;

function getConnectionString(): string {
  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('SUPABASE_DB_URL (or DATABASE_URL fallback) is not defined in environment variables');
  }
  return connectionString;
}

export function getAnalyticsTarget(): { isSupabase: boolean; target: string } {
  const connectionString = getConnectionString();
  const isSupabase = connectionString.includes('supabase.co') || 
                     connectionString.includes('pooler.supabase.com') ||
                     !!process.env.SUPABASE_DB_URL;
  
  return {
    isSupabase,
    target: process.env.SUPABASE_DB_URL ? 'supabase' : 
            process.env.DATABASE_URL ? 'database_url' : 'postgres_url'
  };
}

export function assertSupabaseAnalytics(): void {
  const { isSupabase, target } = getAnalyticsTarget();
  if (!isSupabase) {
    console.error('[ANALYTICS CRITICAL] Analytics target is NOT Supabase!');
    console.error('[ANALYTICS CRITICAL] Current target:', target);
    console.error('[ANALYTICS CRITICAL] Set SUPABASE_DB_URL to ensure data goes to Supabase.');
    throw new Error('ANALYTICS_TARGET_NOT_SUPABASE: Analytics must only write to Supabase');
  }
}

function getPoolConfig(): PoolConfig {
  const connectionString = getConnectionString();
  return {
    connectionString,
    max: parseInt(process.env.DB_POOL_MAX || '2', 10),
    min: parseInt(process.env.DB_POOL_MIN || '0', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_MS || '5000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONN_TIMEOUT_MS || '10000', 10),
    allowExitOnIdle: true,
    ssl: process.env.DATABASE_SSL === 'true' || connectionString.includes('supabase.co') 
      ? { rejectUnauthorized: false } 
      : false,
  };
}

function getPool(): Pool {
  if (!pool) {
    const { isSupabase, target } = getAnalyticsTarget();
    if (!isSupabase) {
      console.error('[DB CRITICAL] Database target is NOT Supabase!');
      console.error('[DB CRITICAL] Current target:', target);
      console.error('[DB CRITICAL] Set SUPABASE_DB_URL to ensure data goes to Supabase.');
    } else {
      console.log('[DB] Verified Supabase target:', target);
    }
    
    pool = new Pool(getPoolConfig());
    globalForDb.dbPool = pool;
    
    // Pool error handlers
    pool.on('error', (err, client) => {
      console.error('[DB Pool] Unexpected error on idle client:', err);
    });

    pool.on('connect', (client) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[DB Pool] New client connected');
      }
    });

    pool.on('remove', (client) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[DB Pool] Client removed from pool');
      }
    });

    // Graceful shutdown handler - ONLY on actual process termination
    // NOT on beforeExit (which fires during Next.js HMR)
    const shutdown = async () => {
      if (pool) {
        console.log('[DB Pool] Shutting down connection pool...');
        await pool.end();
        pool = null;
        globalForDb.dbPool = undefined;
        console.log('[DB Pool] Connection pool closed');
      }
    };

    // Register shutdown hooks - ONLY for real termination signals
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    // REMOVED: process.on('beforeExit', shutdown) - this was killing connections during HMR
  }
  
  return pool;
}

// Initialize pool and create Drizzle instance
const poolInstance = getPool();
export const db = drizzle(poolInstance, { schema });

/**
 * Execute a database operation with a dedicated client from the pool.
 * Ensures proper connection acquisition and release.
 * 
 * @example
 * ```typescript
 * const result = await withClient(async (client) => {
 *   return await client.query('SELECT * FROM users WHERE id = $1', [userId]);
 * });
 * ```
 */
export async function withClient<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

/**
 * Get pool statistics for monitoring and debugging
 */
export function getPoolStats() {
  const pool = getPool();
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}

/**
 * Health check for database connection pool
 */
export async function healthCheck(): Promise<{
  healthy: boolean;
  latencyMs?: number;
  error?: string;
  poolStats?: ReturnType<typeof getPoolStats>;
}> {
  try {
    const start = Date.now();
    const pool = getPool();
    
    // Simple query to test connection
    await pool.query('SELECT 1');
    
    const latencyMs = Date.now() - start;
    
    return {
      healthy: true,
      latencyMs,
      poolStats: getPoolStats(),
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Gracefully close the connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Re-export schema and Drizzle types
export * from './schema';
export type { PoolClient } from 'pg';
