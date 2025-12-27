export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

const summaryQuerySchema = z.object({
  scope: z.enum(['superadmin', 'developer']),
  project_id: z.string().uuid().optional(),
  developer_id: z.string().uuid().optional(),
  time_window: z.enum(['7d', '14d', '30d', '90d']).default('30d'),
});

export interface CanonicalMetricError {
  metric: string;
  reason: string;
  attempted_query?: string;
}

export interface CanonicalAnalyticsSummary {
  total_events: number;
  total_questions: number;
  questions_in_window: number;
  active_units_in_window: number;
  active_tenants_in_window: number;
  recovered_events_count: number;
  inferred_events_count: number;
  live_events_count: number;
  total_qr_scans: number;
  total_signups: number;
  total_document_opens: number;
  qr_scans_in_window: number;
  signups_in_window: number;
  document_opens_in_window: number;
  computed_at: string;
  time_window: string;
  time_window_days: number;
  scope: string;
  project_id?: string;
  developer_id?: string;
  errors: CanonicalMetricError[];
}

function daysFromWindow(window: string): number {
  switch (window) {
    case '7d': return 7;
    case '14d': return 14;
    case '30d': return 30;
    case '90d': return 90;
    default: return 30;
  }
}

export async function GET(request: Request) {
  const computedAt = new Date().toISOString();
  const errors: CanonicalMetricError[] = [];

  try {
    const { searchParams } = new URL(request.url);
    
    const parseResult = summaryQuerySchema.safeParse({
      scope: searchParams.get('scope') || 'superadmin',
      project_id: searchParams.get('project_id') || undefined,
      developer_id: searchParams.get('developer_id') || undefined,
      time_window: searchParams.get('time_window') || '30d',
    });

    if (!parseResult.success) {
      return NextResponse.json({
        error: 'Invalid query parameters',
        details: parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
        computed_at: computedAt,
      }, { status: 400 });
    }

    const { scope, project_id, developer_id, time_window } = parseResult.data;
    const days = daysFromWindow(time_window);

    if (scope === 'developer' && !developer_id) {
      return NextResponse.json({
        error: 'Tenant isolation violation',
        details: 'developer_id is required when scope=developer to prevent cross-tenant data leakage',
        computed_at: computedAt,
      }, { status: 400 });
    }

    const projectFilter = project_id
      ? sql`AND development_id = ${project_id}::uuid`
      : sql``;
    const developerFilter = developer_id
      ? sql`AND tenant_id = ${developer_id}::uuid`
      : sql``;
    const combinedFilter = sql.join([projectFilter, developerFilter], sql.raw(' '));

    const windowFilter = sql`AND created_at > now() - make_interval(days => ${days})`;
    const combinedWithWindow = sql.join([combinedFilter, windowFilter], sql.raw(' '));

    const queries = [
      db.execute(sql`
        SELECT COUNT(*)::int as count FROM analytics_events
        WHERE 1=1 ${combinedWithWindow}
      `).catch(e => { 
        errors.push({ metric: 'total_events', reason: e.message }); 
        return { rows: [{ count: 0 }] }; 
      }),

      db.execute(sql`
        SELECT COUNT(*)::int as count FROM analytics_events
        WHERE event_type = 'chat_question' ${combinedFilter}
      `).catch(e => { 
        errors.push({ metric: 'total_questions', reason: e.message }); 
        return { rows: [{ count: 0 }] }; 
      }),

      db.execute(sql`
        SELECT COUNT(*)::int as count FROM analytics_events
        WHERE event_type = 'chat_question' ${combinedWithWindow}
      `).catch(e => { 
        errors.push({ metric: 'questions_in_window', reason: e.message }); 
        return { rows: [{ count: 0 }] }; 
      }),

      db.execute(sql`
        SELECT COUNT(DISTINCT event_data->>'unit_id')::int as count FROM analytics_events
        WHERE event_data ? 'unit_id' ${combinedWithWindow}
      `).catch(e => { 
        errors.push({ metric: 'active_units_in_window', reason: e.message }); 
        return { rows: [{ count: 0 }] }; 
      }),

      db.execute(sql`
        SELECT COUNT(DISTINCT session_hash)::int as count FROM analytics_events
        WHERE session_hash IS NOT NULL ${combinedWithWindow}
      `).catch(e => { 
        errors.push({ metric: 'active_tenants_in_window', reason: e.message }); 
        return { rows: [{ count: 0 }] }; 
      }),

      db.execute(sql`
        SELECT COUNT(*)::int as count FROM analytics_events
        WHERE (event_data->>'recovered')::boolean = true ${combinedWithWindow}
      `).catch(e => { 
        errors.push({ metric: 'recovered_events_count', reason: e.message }); 
        return { rows: [{ count: 0 }] }; 
      }),

      db.execute(sql`
        SELECT COUNT(*)::int as count FROM analytics_events
        WHERE (event_data->>'inferred')::boolean = true ${combinedWithWindow}
      `).catch(e => { 
        errors.push({ metric: 'inferred_events_count', reason: e.message }); 
        return { rows: [{ count: 0 }] }; 
      }),

      db.execute(sql`
        SELECT COUNT(*)::int as count FROM analytics_events
        WHERE (event_data->>'recovered') IS NULL 
        AND (event_data->>'inferred') IS NULL ${combinedWithWindow}
      `).catch(e => { 
        errors.push({ metric: 'live_events_count', reason: e.message }); 
        return { rows: [{ count: 0 }] }; 
      }),

      db.execute(sql`
        SELECT COUNT(*)::int as count FROM analytics_events
        WHERE event_type = 'qr_scan' ${combinedFilter}
      `).catch(e => { 
        errors.push({ metric: 'total_qr_scans', reason: e.message }); 
        return { rows: [{ count: 0 }] }; 
      }),

      db.execute(sql`
        SELECT COUNT(*)::int as count FROM analytics_events
        WHERE event_type = 'purchaser_signup' ${combinedFilter}
      `).catch(e => { 
        errors.push({ metric: 'total_signups', reason: e.message }); 
        return { rows: [{ count: 0 }] }; 
      }),

      db.execute(sql`
        SELECT COUNT(*)::int as count FROM analytics_events
        WHERE event_type = 'document_open' ${combinedFilter}
      `).catch(e => { 
        errors.push({ metric: 'total_document_opens', reason: e.message }); 
        return { rows: [{ count: 0 }] }; 
      }),

      db.execute(sql`
        SELECT COUNT(*)::int as count FROM analytics_events
        WHERE event_type = 'qr_scan' ${combinedWithWindow}
      `).catch(e => { 
        errors.push({ metric: 'qr_scans_in_window', reason: e.message }); 
        return { rows: [{ count: 0 }] }; 
      }),

      db.execute(sql`
        SELECT COUNT(*)::int as count FROM analytics_events
        WHERE event_type = 'purchaser_signup' ${combinedWithWindow}
      `).catch(e => { 
        errors.push({ metric: 'signups_in_window', reason: e.message }); 
        return { rows: [{ count: 0 }] }; 
      }),

      db.execute(sql`
        SELECT COUNT(*)::int as count FROM analytics_events
        WHERE event_type = 'document_open' ${combinedWithWindow}
      `).catch(e => { 
        errors.push({ metric: 'document_opens_in_window', reason: e.message }); 
        return { rows: [{ count: 0 }] }; 
      }),
    ];

    const results = await Promise.all(queries);

    const summary: CanonicalAnalyticsSummary = {
      total_events: Number(results[0].rows[0]?.count) || 0,
      total_questions: Number(results[1].rows[0]?.count) || 0,
      questions_in_window: Number(results[2].rows[0]?.count) || 0,
      active_units_in_window: Number(results[3].rows[0]?.count) || 0,
      active_tenants_in_window: Number(results[4].rows[0]?.count) || 0,
      recovered_events_count: Number(results[5].rows[0]?.count) || 0,
      inferred_events_count: Number(results[6].rows[0]?.count) || 0,
      live_events_count: Number(results[7].rows[0]?.count) || 0,
      total_qr_scans: Number(results[8].rows[0]?.count) || 0,
      total_signups: Number(results[9].rows[0]?.count) || 0,
      total_document_opens: Number(results[10].rows[0]?.count) || 0,
      qr_scans_in_window: Number(results[11].rows[0]?.count) || 0,
      signups_in_window: Number(results[12].rows[0]?.count) || 0,
      document_opens_in_window: Number(results[13].rows[0]?.count) || 0,
      computed_at: computedAt,
      time_window,
      time_window_days: days,
      scope,
      project_id,
      developer_id,
      errors,
    };

    if (errors.length > 0) {
      console.error('[ANALYTICS SUMMARY] Partial failure:', errors);
    }

    return NextResponse.json(summary);
  } catch (error) {
    console.error('[ANALYTICS SUMMARY] Critical error:', error);
    return NextResponse.json({
      error: 'Failed to compute analytics summary',
      reason: error instanceof Error ? error.message : 'Unknown error',
      computed_at: computedAt,
      errors: [{ metric: 'all', reason: 'Query execution failed' }],
    }, { status: 500 });
  }
}
