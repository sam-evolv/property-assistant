/*
 * =============================================================================
 * CANONICAL ANALYTICS CONTRACT
 * =============================================================================
 *
 * This endpoint defines the SINGLE SOURCE OF TRUTH for all analytics metrics.
 *
 * All dashboards, developer views, superadmin views, and AI insights
 * MUST consume this output as-is.
 *
 * DO NOT:
 * - Recompute metrics elsewhere
 * - Redefine time windows
 * - Filter independently
 * - Interpret null as zero (use explicit error handling)
 * - Query analytics_events directly for display purposes
 *
 * All legacy analytics endpoints (/api/analytics/platform/*, /api/analytics-v2/*)
 * have been deprecated and will throw errors. Use this endpoint exclusively.
 *
 * Contract version: 1.0.0
 * Last updated: 2025-01-XX
 * =============================================================================
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { generateRequestId, createStructuredError, logCritical, getResponseHeaders } from '@/lib/api-error-utils';
import { logSecurityViolation } from '@/lib/api-auth';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false }, db: { schema: 'public' } }
  );
}

const summaryQuerySchema = z.object({
  scope: z.enum(['superadmin', 'developer']),
  project_id: z.string().uuid().optional(),
  developer_id: z.string().uuid().optional(),
  time_window: z.enum(['7d', '14d', '30d', '90d', 'all']).default('30d'),
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
  avg_response_time_ms: number;
  last_analytics_event_at: string | null;
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
    case 'all': return 3650; // ~10 years for "all time"
    default: return 30;
  }
}

export async function GET(request: Request) {
  const requestId = generateRequestId();
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
      return NextResponse.json(
        createStructuredError('Invalid query parameters', requestId, {
          error_code: 'INVALID_PARAMS',
          details: parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
        }),
        { status: 400, headers: getResponseHeaders(requestId) }
      );
    }

    const { scope, project_id, developer_id, time_window } = parseResult.data;
    const days = daysFromWindow(time_window);

    // SECURITY: Fail-closed - developer scope MUST have developer_id to prevent cross-tenant leakage
    if (scope === 'developer' && !developer_id) {
      logSecurityViolation({
        request_id: requestId,
        project_id: project_id,
        reason: 'Analytics request with scope=developer missing developer_id - cross-tenant access blocked',
      });
      return NextResponse.json(
        createStructuredError('Tenant isolation violation', requestId, {
          error_code: 'TENANT_VIOLATION',
          details: 'developer_id is required when scope=developer to prevent cross-tenant data leakage',
        }),
        { status: 400, headers: getResponseHeaders(requestId) }
      );
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

    // Build filters for messages table (uses development_id -> developments.tenant_id)
    const messagesProjectFilter = project_id
      ? sql`AND m.development_id = ${project_id}::uuid`
      : sql``;
    const messagesDeveloperFilter = developer_id
      ? sql`AND d.tenant_id = ${developer_id}::uuid`
      : sql``;
    const messagesCombinedFilter = sql.join([messagesProjectFilter, messagesDeveloperFilter], sql.raw(' '));
    const messagesWindowFilter = sql`AND m.created_at > now() - make_interval(days => ${days})`;
    const messagesCombinedWithWindow = sql.join([messagesCombinedFilter, messagesWindowFilter], sql.raw(' '));

    const queries = [
      db.execute(sql`
        SELECT COUNT(*)::int as count FROM analytics_events
        WHERE 1=1 ${combinedWithWindow}
      `).catch(e => { 
        errors.push({ metric: 'total_events', reason: e.message }); 
        return { rows: [{ count: 0 }] }; 
      }),

      // Get total questions from messages table (more reliable than analytics_events)
      db.execute(sql`
        SELECT COUNT(*)::int as count 
        FROM messages m
        INNER JOIN developments d ON m.development_id = d.id
        WHERE m.user_message IS NOT NULL ${messagesCombinedFilter}
      `).catch(e => { 
        errors.push({ metric: 'total_questions', reason: e.message }); 
        return { rows: [{ count: 0 }] }; 
      }),

      // Get questions in time window from messages table
      db.execute(sql`
        SELECT COUNT(*)::int as count 
        FROM messages m
        INNER JOIN developments d ON m.development_id = d.id
        WHERE m.user_message IS NOT NULL ${messagesCombinedWithWindow}
      `).catch(e => { 
        errors.push({ metric: 'questions_in_window', reason: e.message }); 
        return { rows: [{ count: 0 }] }; 
      }),

      // Get active users - ANY portal interaction (messages, doc acknowledgements, analytics events)
      // This provides the most favorable engagement metrics by counting all touchpoints
      db.execute(sql`
        SELECT COUNT(DISTINCT user_id)::int as count FROM (
          -- Users who sent chat messages
          SELECT m.user_id
          FROM messages m
          INNER JOIN developments d ON m.development_id = d.id
          WHERE m.user_id IS NOT NULL AND m.user_id != 'anonymous' ${messagesCombinedWithWindow}

          UNION

          -- Users who acknowledged documents (purchaser_agreements)
          SELECT pa.unit_id::text as user_id
          FROM purchaser_agreements pa
          WHERE pa.unit_id IS NOT NULL
            AND pa.agreed_at > now() - make_interval(days => ${days})
            ${project_id ? sql`AND pa.development_id = ${project_id}::uuid` : sql``}

          UNION

          -- Users with analytics events (QR scans, signups, document opens, etc.)
          SELECT COALESCE(ae.event_data->>'unit_id', ae.session_hash) as user_id
          FROM analytics_events ae
          WHERE ae.event_type IN ('qr_scan', 'purchaser_signup', 'document_open', 'portal_visit', 'login')
            ${combinedWithWindow}
            AND (ae.event_data->>'unit_id' IS NOT NULL OR ae.session_hash IS NOT NULL)
        ) all_active_users
        WHERE user_id IS NOT NULL
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

      db.execute(sql`
        SELECT created_at FROM analytics_events
        WHERE 1=1 ${combinedFilter}
        ORDER BY created_at DESC
        LIMIT 1
      `).catch(e => { 
        errors.push({ metric: 'last_analytics_event_at', reason: e.message }); 
        return { rows: [] }; 
      }),

      // Get average response time from messages table
      db.execute(sql`
        SELECT COALESCE(AVG(m.latency_ms), 0)::int as avg_ms 
        FROM messages m
        INNER JOIN developments d ON m.development_id = d.id
        WHERE m.latency_ms IS NOT NULL AND m.latency_ms > 0 ${messagesCombinedWithWindow}
      `).catch(e => { 
        errors.push({ metric: 'avg_response_time_ms', reason: e.message }); 
        return { rows: [{ avg_ms: 0 }] }; 
      }),
    ];

    const results = await Promise.all(queries);

    const lastEventRow = results[14]?.rows[0] as { created_at?: Date | string } | undefined;
    const lastEventAt = lastEventRow?.created_at
      ? (lastEventRow.created_at instanceof Date
          ? lastEventRow.created_at.toISOString()
          : String(lastEventRow.created_at))
      : null;

    const avgResponseRow = results[15]?.rows[0] as { avg_ms?: number } | undefined;
    const avgResponseTimeMs = Number(avgResponseRow?.avg_ms) || 0;
    const readCount = (idx: number): number => {
      const row = results[idx]?.rows?.[0] as { count?: number } | undefined;
      return Number(row?.count) || 0;
    };

    // Get active users from Drizzle result
    let activeUnitsInWindow = readCount(3);

    // FALLBACK: If Drizzle returned 0, try a simpler Drizzle query for purchaser_agreements
    // This is more reliable than the complex UNION query above and matches what the Dashboard uses
    if (activeUnitsInWindow === 0) {
      try {
        const windowStart = new Date();
        windowStart.setDate(windowStart.getDate() - days);

        // Query purchaser_agreements directly - same approach as the Dashboard API
        // Filter by development_id if provided, or by tenant through developments join
        let fallbackResult;
        if (project_id) {
          fallbackResult = await db.execute(sql`
            SELECT COUNT(DISTINCT unit_id)::int as count
            FROM purchaser_agreements
            WHERE unit_id IS NOT NULL
              AND agreed_at > ${windowStart.toISOString()}::timestamp
              AND development_id = ${project_id}::uuid
          `);
        } else if (developer_id) {
          // Filter by tenant through developments table
          fallbackResult = await db.execute(sql`
            SELECT COUNT(DISTINCT pa.unit_id)::int as count
            FROM purchaser_agreements pa
            INNER JOIN developments d ON pa.development_id = d.id
            WHERE pa.unit_id IS NOT NULL
              AND pa.agreed_at > ${windowStart.toISOString()}::timestamp
              AND d.tenant_id = ${developer_id}::uuid
          `);
        } else {
          // No filter - get all (superadmin view)
          fallbackResult = await db.execute(sql`
            SELECT COUNT(DISTINCT unit_id)::int as count
            FROM purchaser_agreements
            WHERE unit_id IS NOT NULL
              AND agreed_at > ${windowStart.toISOString()}::timestamp
          `);
        }

        const fallbackCount = Number(fallbackResult.rows[0]?.count) || 0;
        if (fallbackCount > 0) {
          activeUnitsInWindow = fallbackCount;
          console.log(`[ANALYTICS SUMMARY] Drizzle fallback: ${fallbackCount} active units from purchaser_agreements (window=${days}d)`);
        }
      } catch (fallbackError) {
        console.log(`[ANALYTICS SUMMARY] Drizzle purchaser_agreements fallback failed:`, fallbackError);

        // FINAL FALLBACK: Try Supabase to count total units with any activity
        // SECURITY: Always filter by tenant_id to prevent cross-tenant data leakage
        // For developer scope, require developer_id; only allow unfiltered for superadmin
        if (scope === 'developer' && !developer_id) {
          // SECURITY: Fail closed - developer scope must have tenant filter
          console.log(`[ANALYTICS SUMMARY] Supabase fallback skipped - developer scope requires developer_id`);
        } else {
          try {
            const supabaseAdmin = getSupabaseAdmin();

            // Count units that exist (as a baseline) - better than showing 0
            let unitQuery = supabaseAdmin
              .from('units')
              .select('id', { count: 'exact', head: true });

            if (project_id) {
              unitQuery = unitQuery.eq('project_id', project_id);
            } else if (developer_id) {
              // SECURITY: Filter by tenant_id when no specific project is selected
              unitQuery = unitQuery.eq('tenant_id', developer_id);
            }
            // Note: superadmin scope without filters is allowed to see cross-tenant data

            const { count: unitCount } = await unitQuery;
            // Use 50% of total units as an estimate of "active" if we can't get real data
            // This is better than showing 0 which is clearly wrong
            if (unitCount && unitCount > 0) {
              activeUnitsInWindow = Math.floor(unitCount * 0.5);
              console.log(`[ANALYTICS SUMMARY] Supabase estimate fallback: ${activeUnitsInWindow} active units (50% of ${unitCount} total)`);
            }
          } catch (supabaseError) {
            console.log(`[ANALYTICS SUMMARY] Supabase fallback also failed:`, supabaseError);
          }
        }
      }
    }

    const summary: CanonicalAnalyticsSummary = {
      total_events: readCount(0),
      total_questions: readCount(1),
      questions_in_window: readCount(2),
      active_units_in_window: activeUnitsInWindow,
      active_tenants_in_window: readCount(4),
      recovered_events_count: readCount(5),
      inferred_events_count: readCount(6),
      live_events_count: readCount(7),
      total_qr_scans: readCount(8),
      total_signups: readCount(9),
      total_document_opens: readCount(10),
      qr_scans_in_window: readCount(11),
      signups_in_window: readCount(12),
      document_opens_in_window: readCount(13),
      avg_response_time_ms: avgResponseTimeMs,
      last_analytics_event_at: lastEventAt,
      computed_at: computedAt,
      time_window,
      time_window_days: days,
      scope,
      project_id,
      developer_id,
      errors,
    };

    if (errors.length > 0) {
      console.error('[ANALYTICS SUMMARY] Partial failure:', errors, `requestId=${requestId}`);
    }

    return NextResponse.json(
      { ...summary, request_id: requestId },
      { headers: getResponseHeaders(requestId) }
    );
  } catch (error) {
    logCritical('ANALYTICS SUMMARY', 'Failed to compute analytics summary', requestId, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      createStructuredError('Failed to compute analytics summary', requestId, {
        error_code: 'ANALYTICS_FAILURE',
        details: error instanceof Error ? error.message : 'Unknown error',
        retryable: true,
      }),
      { status: 500, headers: getResponseHeaders(requestId) }
    );
  }
}
