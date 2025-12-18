import { NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { createClient } from '@supabase/supabase-js';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
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
  } catch (error) {
    checks.drizzle = { 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Connection failed',
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
  
  return NextResponse.json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    service: 'unified-portal',
    version: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
    environment: process.env.NODE_ENV,
    envConfigured: envStatus,
    checks,
  }, { status: allHealthy ? 200 : 503 });
}
