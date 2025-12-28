export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';

interface AuditLog {
  id: string;
  type: string;
  action: string;
  actor: string | null;
  metadata: any;
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const hours = parseInt(searchParams.get('hours') || '24', 10);
  const typeFilter = searchParams.get('type');

  try {
    let query;
    const intervalHours = `${hours} hours`;

    if (typeFilter === 'error') {
      query = sql`
        SELECT 
          id::text as id,
          event_type as type,
          event_category as action,
          session_hash as actor,
          event_data as metadata,
          created_at
        FROM analytics_events 
        WHERE created_at > now() - make_interval(hours => ${hours})
        AND (event_type ILIKE '%error%' OR event_category ILIKE '%error%')
        ORDER BY created_at DESC 
        LIMIT 500
      `;
    } else if (typeFilter === 'warning') {
      query = sql`
        SELECT 
          id::text as id,
          event_type as type,
          event_category as action,
          session_hash as actor,
          event_data as metadata,
          created_at
        FROM analytics_events 
        WHERE created_at > now() - make_interval(hours => ${hours})
        AND (event_type ILIKE '%warn%' OR event_category ILIKE '%warn%')
        ORDER BY created_at DESC 
        LIMIT 500
      `;
    } else if (typeFilter === 'info') {
      query = sql`
        SELECT 
          id::text as id,
          event_type as type,
          event_category as action,
          session_hash as actor,
          event_data as metadata,
          created_at
        FROM analytics_events 
        WHERE created_at > now() - make_interval(hours => ${hours})
        AND event_type NOT ILIKE '%error%' 
        AND event_type NOT ILIKE '%warn%'
        AND event_category NOT ILIKE '%error%' 
        AND event_category NOT ILIKE '%warn%'
        ORDER BY created_at DESC 
        LIMIT 500
      `;
    } else {
      query = sql`
        SELECT 
          id::text as id,
          event_type as type,
          event_category as action,
          session_hash as actor,
          event_data as metadata,
          created_at
        FROM analytics_events 
        WHERE created_at > now() - make_interval(hours => ${hours})
        ORDER BY created_at DESC 
        LIMIT 500
      `;
    }

    const result = await db.execute(query);

    const logs: AuditLog[] = (result.rows || []).map((row: any) => ({
      id: row.id || String(Math.random()),
      type: row.type || 'event',
      action: row.action || row.type || 'system',
      actor: row.actor || null,
      metadata: row.metadata || {},
      created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    }));

    console.log(`[SystemLogs] Returning ${logs.length} logs for last ${hours}h`);

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error('[SystemLogs] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch logs', logs: [] },
      { status: 500 }
    );
  }
}
