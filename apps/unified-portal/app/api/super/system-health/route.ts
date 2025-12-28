export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import { requireRole } from '@/lib/supabase-server';
import { getBuildInfo, getErrorCountSinceReset, getUptimeSeconds } from '@/lib/system-health';

async function checkDatabaseConnection(): Promise<{ status: 'OK' | 'FAIL'; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { status: 'OK', latencyMs: Date.now() - start };
  } catch (error) {
    return { 
      status: 'FAIL', 
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkSupabaseConnection(): Promise<{ status: 'OK' | 'FAIL' | 'SKIP'; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl) {
      return { status: 'SKIP', latencyMs: 0, error: 'URL not configured' };
    }
    
    if (!supabaseKey) {
      return { status: 'SKIP', latencyMs: 0, error: 'Service key not configured' };
    }
    
    const response = await fetch(`${supabaseUrl}/rest/v1/projects?select=id&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Accept': 'application/json',
      },
    });
    
    if (response.ok) {
      return { status: 'OK', latencyMs: Date.now() - start };
    }
    
    return { 
      status: 'FAIL', 
      latencyMs: Date.now() - start,
      error: `HTTP ${response.status}`
    };
  } catch (error) {
    return { 
      status: 'FAIL', 
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

async function getLastAnalyticsEvent(): Promise<{ timestamp: string | null; eventType: string | null; ageSeconds: number | null }> {
  try {
    const result = await db.execute(sql`
      SELECT event_type, created_at 
      FROM analytics_events 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    const row = result.rows[0] as { event_type: string; created_at: Date } | undefined;
    if (!row) {
      return { timestamp: null, eventType: null, ageSeconds: null };
    }
    
    const timestamp = new Date(row.created_at);
    const ageSeconds = Math.floor((Date.now() - timestamp.getTime()) / 1000);
    
    return {
      timestamp: timestamp.toISOString(),
      eventType: row.event_type,
      ageSeconds,
    };
  } catch {
    return { timestamp: null, eventType: null, ageSeconds: null };
  }
}

async function getRecentCriticalErrors(): Promise<{ count: number; last10Minutes: number }> {
  const errorInfo = getErrorCountSinceReset();
  
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM analytics_events 
      WHERE event_type = 'error' 
      AND created_at > now() - interval '10 minutes'
    `);
    
    const dbErrors = Number(result.rows[0]?.count || 0);
    
    return {
      count: errorInfo.count,
      last10Minutes: dbErrors,
    };
  } catch {
    return {
      count: errorInfo.count,
      last10Minutes: 0,
    };
  }
}

export async function GET() {
  try {
    await requireRole(['super_admin', 'admin']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const checkedAt = new Date().toISOString();
  
  const [drizzleDb, supabaseDb, lastAnalytics, criticalErrors] = await Promise.all([
    checkDatabaseConnection(),
    checkSupabaseConnection(),
    getLastAnalyticsEvent(),
    getRecentCriticalErrors(),
  ]);

  const buildInfo = getBuildInfo();
  const uptimeSeconds = getUptimeSeconds();

  const supabaseOk = supabaseDb.status === 'OK' || supabaseDb.status === 'SKIP';
  const overallStatus = 
    drizzleDb.status === 'OK' && supabaseOk
      ? 'healthy' 
      : drizzleDb.status === 'FAIL'
        ? 'critical'
        : 'degraded';

  return NextResponse.json({
    status: overallStatus,
    checkedAt,
    
    databases: {
      drizzle: drizzleDb,
      supabase: supabaseDb,
    },
    
    analytics: {
      lastEvent: lastAnalytics,
      isRecent: lastAnalytics.ageSeconds !== null && lastAnalytics.ageSeconds < 3600,
    },
    
    errors: {
      criticalCount: criticalErrors.count,
      last10Minutes: criticalErrors.last10Minutes,
    },
    
    deployment: {
      version: buildInfo.version,
      buildHash: buildInfo.buildHash,
      deployedAt: buildInfo.deployedAt,
      environment: buildInfo.nodeEnv,
      uptimeSeconds,
      uptimeFormatted: formatUptime(uptimeSeconds),
    },
  });
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
