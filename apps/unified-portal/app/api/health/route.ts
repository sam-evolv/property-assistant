import { NextResponse } from 'next/server';
import { db, getPoolStats } from '@openhouse/db/client';
import { createClient } from '@supabase/supabase-js';
import { sql } from 'drizzle-orm';
import { getVersion } from '@/lib/version';
import { globalCache } from '@/lib/cache/ttl-cache';
import { getRateLimiterStats } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, { status: 'ok' | 'error'; message?: string; latency?: number }> = {};
  
  // Check environment variables
  const envStatus = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
  };
  
  // Check Drizzle/PostgreSQL connection
  const drizzleStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    checks.drizzle = { status: 'ok', latency: Date.now() - drizzleStart };
  } catch (error: any) {
    console.error('[Health] Drizzle connection error:', error);
    const errMsg = error?.message || error?.code || 'Connection failed';
    const errCode = error?.code || '';
    checks.drizzle = { 
      status: 'error', 
      message: `${errMsg}${errCode ? ` (${errCode})` : ''}`,
      latency: Date.now() - drizzleStart 
    };
  }
  
  // Check Supabase connection
  const supabaseStart = Date.now();
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      const { data, error } = await supabase
        .from('document_sections')
        .select('id')
        .limit(1);
      
      if (error) {
        checks.supabase = { 
          status: 'error', 
          message: error.message,
          latency: Date.now() - supabaseStart 
        };
      } else {
        checks.supabase = { status: 'ok', latency: Date.now() - supabaseStart };
      }
    } else {
      checks.supabase = { status: 'error', message: 'Missing environment variables' };
    }
  } catch (error) {
    checks.supabase = { 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Connection failed',
      latency: Date.now() - supabaseStart 
    };
  }
  
  // Check OpenAI API key format (don't make actual call to save costs)
  if (process.env.OPENAI_API_KEY) {
    const keyPrefix = process.env.OPENAI_API_KEY.slice(0, 7);
    if (keyPrefix === 'sk-proj' || keyPrefix === 'sk-org-' || keyPrefix.startsWith('sk-')) {
      checks.openai = { status: 'ok', message: 'API key configured' };
    } else {
      checks.openai = { status: 'error', message: 'Invalid API key format' };
    }
  } else {
    checks.openai = { status: 'error', message: 'API key not configured' };
  }
  
  // Determine overall health
  const allHealthy = Object.values(checks).every(c => c.status === 'ok');
  const responseTime = Date.now() - startTime;

  let poolStats = { totalCount: 0, idleCount: 0, waitingCount: 0 };
  try {
    poolStats = getPoolStats();
  } catch {}
  
  return NextResponse.json({
    ok: allHealthy,
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    service: 'unified-portal',
    version: getVersion(),
    environment: process.env.NODE_ENV,
    responseTimeMs: responseTime,
    envConfigured: envStatus,
    checks,
    stats: {
      dbPool: poolStats,
      cache: globalCache.stats(),
      rateLimiter: getRateLimiterStats(),
    },
  }, { status: allHealthy ? 200 : 503 });
}
