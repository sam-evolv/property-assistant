import { NextRequest, NextResponse } from 'next/server';
import { assertDeveloper, enforceTenantScope, enforceDevelopmentScope } from '@/lib/api-auth';
import { db } from '@openhouse/db';
import { messages, homeowners, documents } from '@openhouse/db/schema';
import { sql, gte, and, eq, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      db: { schema: 'public' }
    }
  );
}

export const dynamic = 'force-dynamic';

function createErrorResponse(
  requestId: string, 
  error: string, 
  details: string | null,
  status: number
) {
  console.error(`[DeveloperDashboard] requestId=${requestId} status=${status} error=${error} details=${details || 'none'}`);
  return NextResponse.json(
    { 
      error, 
      details,
      requestId,
      endpoint: '/api/analytics/developer/dashboard',
      timestamp: new Date().toISOString(),
    },
    { 
      status,
      headers: { 'x-request-id': requestId }
    }
  );
}

export async function GET(request: NextRequest) {
  const requestId = `dash_${nanoid(12)}`;
  
  try {
    // SECURITY: Verify developer role - fails if not authenticated
    const context = await assertDeveloper();
    
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get('tenantId') || undefined;
    // SECURITY: Cross-tenant access forbidden - logs violation and throws on mismatch
    const tenantId = enforceTenantScope(context, requestedTenantId, requestId);
    
    const requestedDevelopmentId = searchParams.get('developmentId') || undefined;
    // SECURITY: Cross-project access forbidden - logs violation and throws on mismatch
    const developmentId = await enforceDevelopmentScope(context, requestedDevelopmentId, requestId);
    
    const days = parseInt(searchParams.get('days') || '30');

    const now = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const previousStartDate = new Date();
    previousStartDate.setDate(previousStartDate.getDate() - (days * 2));
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const supabaseAdmin = getSupabaseAdmin();

    // Run queries sequentially to avoid connection pool exhaustion
    // Units are stored in Supabase, use Supabase client to query them
    let totalUnits = 0;
    let onboardedUnits = 0;
    try {
      let unitsQuery = supabaseAdmin.from('units').select('*', { count: 'exact', head: true });
      if (developmentId) {
        unitsQuery = unitsQuery.eq('project_id', developmentId);
      }
      const { count: unitCount, error: unitError } = await unitsQuery;
      if (!unitError) {
        totalUnits = unitCount || 0;
      } else {
        console.log(`[DeveloperDashboard] Units query error:`, unitError);
      }
      
      // Count onboarded units - those with purchaser_name set (using correct Supabase syntax)
      let onboardedQuery = supabaseAdmin.from('units').select('*', { count: 'exact', head: true }).not('purchaser_name', 'is', null);
      if (developmentId) {
        onboardedQuery = onboardedQuery.eq('project_id', developmentId);
      }
      const { count: onboardedCount, error: onboardedError } = await onboardedQuery;
      if (!onboardedError) {
        onboardedUnits = onboardedCount || 0;
      } else {
        console.log(`[DeveloperDashboard] Onboarded units query error:`, onboardedError);
      }
      console.log(`[DeveloperDashboard] Onboarded units count:`, onboardedUnits);
    } catch (unitError) {
      console.log(`[DeveloperDashboard] Units exception:`, unitError);
    }
    
    // Use onboarded units as registered homeowners
    let registeredHomeowners = onboardedUnits;
    
    // Active homeowners - counts ANY portal interaction in the last 7 days:
    // 1. Chat messages (messages table - Drizzle)
    // 2. Document acknowledgements in last 7 days (purchaser_agreements - Drizzle, same as Homeowners page)
    // 3. Analytics events like logins, signups (analytics_events - Drizzle)
    let activeHomeowners = 0;
    let previousActive = 0;
    try {
      // Count active users from multiple sources - using purchaser_agreements (same as Homeowners page)
      let drizzleActiveCount = 0;
      let purchaserAgreementsActiveCount = 0;

      // First try to count from purchaser_agreements (most reliable - actual portal interaction)
      try {
        const agreementsActiveResult = await db.execute(sql`
          SELECT COUNT(DISTINCT unit_id)::int as count
          FROM purchaser_agreements
          WHERE agreed_at >= ${sevenDaysAgo}
            AND unit_id IS NOT NULL
        `);
        purchaserAgreementsActiveCount = (agreementsActiveResult.rows[0] as any)?.count || 0;
        console.log(`[DeveloperDashboard] Active from purchaser_agreements: ${purchaserAgreementsActiveCount}`);
      } catch (agreementError) {
        console.log(`[DeveloperDashboard] purchaser_agreements active query failed:`, agreementError);
      }

      // Then try Drizzle tables (messages + analytics_events)
      try {
        const activeResult = await (developmentId
          ? db.execute(sql`
              SELECT COUNT(DISTINCT user_id)::int as count FROM (
                -- Users who sent chat messages
                SELECT m.user_id FROM messages m
                WHERE m.development_id = ${developmentId}::uuid
                  AND m.created_at >= ${sevenDaysAgo}
                  AND m.user_id IS NOT NULL AND m.user_id != 'anonymous'

                UNION

                -- Users with analytics events (logins, QR scans, doc opens, signups)
                SELECT COALESCE(ae.event_data->>'unit_id', ae.session_hash) as user_id
                FROM analytics_events ae
                WHERE ae.development_id = ${developmentId}::uuid
                  AND ae.created_at >= ${sevenDaysAgo}
                  AND ae.event_type IN ('portal_visit', 'login', 'qr_scan', 'document_open', 'purchaser_signup')
                  AND (ae.event_data->>'unit_id' IS NOT NULL OR ae.session_hash IS NOT NULL)
              ) all_active
              WHERE user_id IS NOT NULL
            `)
          : db.execute(sql`
              SELECT COUNT(DISTINCT user_id)::int as count FROM (
                -- Users who sent chat messages
                SELECT m.user_id FROM messages m
                INNER JOIN developments d ON m.development_id = d.id
                WHERE d.tenant_id = ${tenantId}::uuid
                  AND m.created_at >= ${sevenDaysAgo}
                  AND m.user_id IS NOT NULL AND m.user_id != 'anonymous'

                UNION

                -- Users with analytics events (logins, QR scans, doc opens, signups)
                SELECT COALESCE(ae.event_data->>'unit_id', ae.session_hash) as user_id
                FROM analytics_events ae
                WHERE ae.tenant_id = ${tenantId}::uuid
                  AND ae.created_at >= ${sevenDaysAgo}
                  AND ae.event_type IN ('portal_visit', 'login', 'qr_scan', 'document_open', 'purchaser_signup')
                  AND (ae.event_data->>'unit_id' IS NOT NULL OR ae.session_hash IS NOT NULL)
              ) all_active
              WHERE user_id IS NOT NULL
            `));
        drizzleActiveCount = (activeResult.rows[0] as any)?.count || 0;
        console.log(`[DeveloperDashboard] Active from messages/events: ${drizzleActiveCount}`);
      } catch (drizzleError) {
        console.log(`[DeveloperDashboard] Drizzle active query failed:`, drizzleError);
      }

      // Also count from Supabase units table - users who acknowledged docs in last 7 days
      let supabaseActiveCount = 0;
      try {
        let supabaseActiveQuery = supabaseAdmin
          .from('units')
          .select('id', { count: 'exact', head: true })
          .gte('important_docs_agreed_at', sevenDaysAgo.toISOString());

        if (developmentId) {
          supabaseActiveQuery = supabaseActiveQuery.eq('project_id', developmentId);
        }
        const { count } = await supabaseActiveQuery;
        supabaseActiveCount = count || 0;
        console.log(`[DeveloperDashboard] Active from Supabase units: ${supabaseActiveCount}`);
      } catch (supabaseError) {
        console.log(`[DeveloperDashboard] Supabase active query failed:`, supabaseError);
      }

      // Combine all sources - use the maximum since there's likely overlap
      activeHomeowners = Math.max(drizzleActiveCount, supabaseActiveCount, purchaserAgreementsActiveCount);

      // If multiple sources have activity, add them with overlap adjustment
      const activeSources = [drizzleActiveCount, supabaseActiveCount, purchaserAgreementsActiveCount].filter(c => c > 0);
      if (activeSources.length > 1) {
        // Sum them but reduce for expected overlap
        const total = activeSources.reduce((a, b) => a + b, 0);
        activeHomeowners = Math.max(activeHomeowners, Math.floor(total * 0.7)); // 30% overlap assumed
      }

      console.log(`[DeveloperDashboard] Active users: drizzle=${drizzleActiveCount}, supabase=${supabaseActiveCount}, agreements=${purchaserAgreementsActiveCount}, combined=${activeHomeowners}`);

      // Previous period for comparison
      const prevResult = await (developmentId
        ? db.execute(sql`
            SELECT COUNT(DISTINCT user_id)::int as count FROM (
              SELECT m.user_id FROM messages m
              WHERE m.development_id = ${developmentId}::uuid
                AND m.created_at >= ${previousStartDate} AND m.created_at < ${sevenDaysAgo}
                AND m.user_id IS NOT NULL AND m.user_id != 'anonymous'

              UNION

              SELECT COALESCE(ae.event_data->>'unit_id', ae.session_hash) as user_id
              FROM analytics_events ae
              WHERE ae.development_id = ${developmentId}::uuid
                AND ae.created_at >= ${previousStartDate} AND ae.created_at < ${sevenDaysAgo}
                AND ae.event_type IN ('portal_visit', 'login', 'qr_scan', 'document_open', 'purchaser_signup')
                AND (ae.event_data->>'unit_id' IS NOT NULL OR ae.session_hash IS NOT NULL)
            ) all_active
            WHERE user_id IS NOT NULL
          `)
        : db.execute(sql`
            SELECT COUNT(DISTINCT user_id)::int as count FROM (
              SELECT m.user_id FROM messages m
              INNER JOIN developments d ON m.development_id = d.id
              WHERE d.tenant_id = ${tenantId}::uuid
                AND m.created_at >= ${previousStartDate} AND m.created_at < ${sevenDaysAgo}
                AND m.user_id IS NOT NULL AND m.user_id != 'anonymous'

              UNION

              SELECT COALESCE(ae.event_data->>'unit_id', ae.session_hash) as user_id
              FROM analytics_events ae
              WHERE ae.tenant_id = ${tenantId}::uuid
                AND ae.created_at >= ${previousStartDate} AND ae.created_at < ${sevenDaysAgo}
                AND ae.event_type IN ('portal_visit', 'login', 'qr_scan', 'document_open', 'purchaser_signup')
                AND (ae.event_data->>'unit_id' IS NOT NULL OR ae.session_hash IS NOT NULL)
            ) all_active
            WHERE user_id IS NOT NULL
          `));
      previousActive = (prevResult.rows[0] as any)?.count || 0;
    } catch (e) {
      console.log(`[DeveloperDashboard] Active users query failed (graceful fallback to 0):`, e);
    }
    
    // Message counts - FIX: Use JOIN through developments for tenant filtering
    let totalMessages = 0;
    let previousMessages = 0;
    try {
      const msgResult = await (developmentId
        ? db.execute(sql`SELECT COUNT(*)::int as count FROM messages m WHERE m.development_id = ${developmentId} AND m.created_at >= ${startDate}`)
        : db.execute(sql`SELECT COUNT(*)::int as count FROM messages m INNER JOIN developments d ON m.development_id = d.id WHERE d.tenant_id = ${tenantId} AND m.created_at >= ${startDate}`));
      totalMessages = (msgResult.rows[0] as any)?.count || 0;

      const prevMsgResult = await (developmentId
        ? db.execute(sql`SELECT COUNT(*)::int as count FROM messages m WHERE m.development_id = ${developmentId} AND m.created_at >= ${previousStartDate} AND m.created_at < ${startDate}`)
        : db.execute(sql`SELECT COUNT(*)::int as count FROM messages m INNER JOIN developments d ON m.development_id = d.id WHERE d.tenant_id = ${tenantId} AND m.created_at >= ${previousStartDate} AND m.created_at < ${startDate}`));
      previousMessages = (prevMsgResult.rows[0] as any)?.count || 0;
    } catch (e) {
      console.log(`[DeveloperDashboard] Messages query failed (graceful fallback to 0):`, e);
    }
    
    // Question topics - FIX: Use JOIN through developments for tenant filtering
    let questionTopicsResult = { rows: [] as any[] };
    try {
      questionTopicsResult = await (developmentId
        ? db.execute(sql`
            SELECT COALESCE(question_topic, 'general') as topic, COUNT(*)::int as count
            FROM messages m WHERE m.development_id = ${developmentId} AND m.created_at >= ${startDate} AND m.user_message IS NOT NULL
            GROUP BY COALESCE(question_topic, 'general') ORDER BY COUNT(*) DESC LIMIT 8
          `)
        : db.execute(sql`
            SELECT COALESCE(m.question_topic, 'general') as topic, COUNT(*)::int as count
            FROM messages m INNER JOIN developments d ON m.development_id = d.id
            WHERE d.tenant_id = ${tenantId} AND m.created_at >= ${startDate} AND m.user_message IS NOT NULL
            GROUP BY COALESCE(m.question_topic, 'general') ORDER BY COUNT(*) DESC LIMIT 8
          `));
    } catch (e) {
      console.log(`[DeveloperDashboard] Question topics query failed (graceful fallback):`, e);
    }
    
    // Document coverage from Supabase instead of Drizzle
    let docCoverage = { total_docs: 0, covered_house_types: 0, total_house_types: 0 };
    try {
      const { data: docs, count: docCount } = await supabaseAdmin.from('document_sections').select('metadata', { count: 'exact' });
      const houseTypes = new Set((docs || []).map((d: any) => d.metadata?.house_type_code).filter(Boolean));
      docCoverage = { total_docs: docCount || 0, covered_house_types: houseTypes.size, total_house_types: houseTypes.size || 1 };
    } catch (e) {
      console.log(`[DeveloperDashboard] Document coverage query failed (graceful fallback):`, e);
    }
    
    // Must-read compliance - MUST match exact logic from Homeowners tab (list.tsx)
    // The Homeowners tab uses 'projects' table for development info and 'purchaser_agreements' table for acknowledgements
    let mustRead = { total_units: totalUnits, acknowledged: 0 };
    try {
      // Get all units with their project_id
      let unitsWithAckQuery = supabaseAdmin
        .from('units')
        .select('id, important_docs_agreed_version, project_id');

      if (developmentId) {
        unitsWithAckQuery = unitsWithAckQuery.eq('project_id', developmentId);
      }

      const { data: unitsWithAck, error: unitsError } = await unitsWithAckQuery;

      if (unitsError) {
        console.log(`[DeveloperDashboard] Units acknowledgement query error:`, unitsError);
      } else if (unitsWithAck && unitsWithAck.length > 0) {
        // Get development version from 'projects' table (Supabase) - same as Homeowners page
        const developmentIds = [...new Set(unitsWithAck.map(u => u.project_id))];
        const { data: projects } = await supabaseAdmin
          .from('projects')
          .select('id, important_docs_version')
          .in('id', developmentIds);

        // Create a map of development_id -> important_docs_version
        const devVersionMap: Record<string, number> = {};
        (projects || []).forEach((p: any) => {
          devVersionMap[p.id] = p.important_docs_version || 0;
        });

        // CRITICAL: Get acknowledgement status from purchaser_agreements table (Drizzle)
        // This is what the Homeowners page does - uses purchaser_agreements for the real source of truth
        let acknowledgedUnitsFromAgreements = new Map<string, number>();
        try {
          const agreementsResult = await db.execute(sql`
            SELECT DISTINCT ON (unit_id) unit_id, docs_version
            FROM purchaser_agreements
            WHERE unit_id IS NOT NULL
            ORDER BY unit_id, agreed_at DESC
          `);
          for (const row of agreementsResult.rows as any[]) {
            acknowledgedUnitsFromAgreements.set(row.unit_id, row.docs_version || 1);
          }
          console.log(`[DeveloperDashboard] Found ${acknowledgedUnitsFromAgreements.size} acknowledged units from purchaser_agreements`);
        } catch (agreementError) {
          console.log(`[DeveloperDashboard] purchaser_agreements query failed, falling back to unit field:`, agreementError);
        }

        // Count units that have acknowledged using EXACT same logic as Homeowners tab
        let acknowledgedCount = 0;
        for (const unit of unitsWithAck) {
          // Use purchaser_agreements as primary source (like Homeowners page), fall back to unit field
          const agreedVersion = acknowledgedUnitsFromAgreements.get(unit.id) || unit.important_docs_agreed_version || 0;
          const devVersion = devVersionMap[unit.project_id] || 0;

          // Exact logic from Homeowners tab list.tsx hasUnitAcknowledged():
          // If no version is set anywhere (devVersion === 0), check if agreed at least version 1
          // Otherwise, check if agreed >= dev version
          if (devVersion === 0) {
            if (agreedVersion >= 1) {
              acknowledgedCount++;
            }
          } else {
            if (agreedVersion >= devVersion) {
              acknowledgedCount++;
            }
          }
        }

        mustRead = { total_units: totalUnits, acknowledged: acknowledgedCount };
        console.log(`[DeveloperDashboard] Must-read compliance: ${acknowledgedCount} of ${totalUnits} acknowledged (matched Homeowners tab logic)`);
      }
    } catch (e) {
      console.log(`[DeveloperDashboard] Must-read compliance query failed (graceful fallback):`, e);
    }
    
    // Recent questions - FIX: Use JOIN through developments for tenant filtering
    let recentQuestionsResult = { rows: [] as any[] };
    try {
      recentQuestionsResult = await (developmentId
        ? db.execute(sql`
            SELECT user_message, question_topic, created_at, metadata FROM messages m
            WHERE m.development_id = ${developmentId} AND m.user_message IS NOT NULL AND m.created_at >= ${startDate}
            ORDER BY m.created_at DESC LIMIT 20
          `)
        : db.execute(sql`
            SELECT m.user_message, m.question_topic, m.created_at, m.metadata FROM messages m
            INNER JOIN developments d ON m.development_id = d.id
            WHERE d.tenant_id = ${tenantId} AND m.user_message IS NOT NULL AND m.created_at >= ${startDate}
            ORDER BY m.created_at DESC LIMIT 20
          `));
    } catch (e) {
      console.log(`[DeveloperDashboard] Recent questions query failed (graceful fallback):`, e);
    }
    
    // Chat activity - FIX: Use JOIN through developments for tenant filtering
    let chatActivityResult = { rows: [] as any[] };
    try {
      chatActivityResult = await (developmentId
        ? db.execute(sql`
            SELECT DATE(created_at) as date, COUNT(*)::int as count FROM messages m
            WHERE m.development_id = ${developmentId} AND m.created_at >= ${startDate}
            GROUP BY DATE(m.created_at) ORDER BY DATE(m.created_at) ASC
          `)
        : db.execute(sql`
            SELECT DATE(m.created_at) as date, COUNT(*)::int as count FROM messages m
            INNER JOIN developments d ON m.development_id = d.id
            WHERE d.tenant_id = ${tenantId} AND m.created_at >= ${startDate}
            GROUP BY DATE(m.created_at) ORDER BY DATE(m.created_at) ASC
          `));
    } catch (e) {
      console.log(`[DeveloperDashboard] Chat activity query failed (graceful fallback):`, e);
    }
    
    // House type engagement from Supabase
    let houseTypeEngagementResult = { rows: [] as any[] };
    try {
      const { data: unitsData } = await supabaseAdmin.from('units').select('house_type_code').not('house_type_code', 'is', null);
      const houseTypeCounts = (unitsData || []).reduce((acc: any, u: any) => {
        acc[u.house_type_code] = (acc[u.house_type_code] || 0) + 1;
        return acc;
      }, {});
      houseTypeEngagementResult = { 
        rows: Object.entries(houseTypeCounts).slice(0, 10).map(([ht, count]) => ({ 
          house_type_code: ht, active_users: 0, message_count: count as number 
        }))
      };
    } catch (e) {
      console.log(`[DeveloperDashboard] House type engagement query failed (graceful fallback):`, e);
    }

    // All values are now set above with graceful fallbacks
    // Debug logging
    console.log('[DeveloperDashboard] Stats: units=', totalUnits, 'onboarded=', onboardedUnits, 'active=', activeHomeowners, 'messages=', totalMessages);

    // Onboarding rate = units with purchaser info / total units
    const onboardingRate = totalUnits > 0 
      ? Math.round((registeredHomeowners / totalUnits) * 100) 
      : 0;
    
    // Engagement rate = active users in 7 days / total units
    const engagementRate = totalUnits > 0 
      ? Math.round((activeHomeowners / totalUnits) * 100) 
      : 0;
    
    const activeGrowth = previousActive > 0 
      ? Math.round(((activeHomeowners - previousActive) / previousActive) * 100) 
      : (activeHomeowners > 0 ? 100 : 0);
    
    const messageGrowth = previousMessages > 0 
      ? Math.round(((totalMessages - previousMessages) / previousMessages) * 100) 
      : (totalMessages > 0 ? 100 : 0);

    const documentCoverageRate = docCoverage.total_house_types > 0
      ? Math.round((docCoverage.covered_house_types / docCoverage.total_house_types) * 100)
      : 0;

    const mustReadRate = mustRead.total_units > 0
      ? Math.round((mustRead.acknowledged / mustRead.total_units) * 100)
      : 0;

    // Calculate previous period rates for comparison
    // Engagement has historical data via previousActive from messages table
    const previousEngagementRate = totalUnits > 0 
      ? Math.round((previousActive / totalUnits) * 100)
      : 0;
    
    // Calculate deltas (percentage points difference)
    // Engagement delta is always calculated when we have units (even if previous was 0)
    const engagementDelta = totalUnits > 0 ? engagementRate - previousEngagementRate : undefined;
    
    // Onboarding and Must-Read don't have historical snapshots yet
    // Return undefined to indicate no comparison available (UI will not show badge)
    const onboardingDelta = undefined;
    const mustReadDelta = undefined;

    const formatTopicLabel = (topic: string): string => {
      if (!topic) return 'General';
      return topic
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    };

    const questionTopics = (questionTopicsResult.rows as any[]).map(row => ({
      topic: row.topic,
      label: formatTopicLabel(row.topic),
      count: row.count,
    }));

    const chatActivity = (chatActivityResult.rows as any[]).map(row => ({
      date: row.date,
      count: row.count,
    }));

    const onboardingFunnel = [
      { stage: 'Total Units', count: totalUnits, colour: '#D4AF37' },
      { stage: 'Registered', count: registeredHomeowners, colour: '#93C5FD' },
      { stage: 'Active (7d)', count: activeHomeowners, colour: '#34D399' },
    ];

    const unansweredQueries = (recentQuestionsResult.rows as any[])
      .filter(row => {
        const meta = row.metadata as any;
        return meta?.confidence === 'low' || meta?.no_context === true;
      })
      .slice(0, 5)
      .map(row => ({
        question: row.user_message?.substring(0, 100) + (row.user_message?.length > 100 ? '...' : ''),
        topic: formatTopicLabel(row.question_topic || 'general'),
        date: row.created_at,
      }));

    const houseTypeEngagement = (houseTypeEngagementResult.rows as any[]).map(row => ({
      houseType: row.house_type_code,
      activeUsers: row.active_users,
      messageCount: row.message_count,
    }));

    console.log(`[DeveloperDashboard] requestId=${requestId} OK: tenant=${tenantId} dev=${developmentId || 'all'} units=${totalUnits} homeowners=${registeredHomeowners}`);
    
    return NextResponse.json({
      requestId,
      kpis: {
        onboardingRate: {
          value: onboardingRate,
          label: 'Onboarding Rate',
          description: `${registeredHomeowners} of ${totalUnits} units onboarded`,
          suffix: '%',
          delta: onboardingDelta,
          inactiveCount: totalUnits - registeredHomeowners,
        },
        engagementRate: {
          value: engagementRate,
          label: 'Engagement Rate',
          description: `${activeHomeowners} of ${totalUnits} active (7d)`,
          suffix: '%',
          growth: activeGrowth,
          delta: engagementDelta,
          inactiveCount: totalUnits - activeHomeowners,
        },
        documentCoverage: {
          value: documentCoverageRate,
          label: 'Document Coverage',
          description: `${docCoverage?.covered_house_types || 0} of ${docCoverage?.total_house_types || 0} house types`,
          suffix: '%',
        },
        mustReadCompliance: {
          value: mustReadRate,
          label: 'Must-Read Compliance',
          description: `${mustRead?.acknowledged || 0} of ${mustRead?.total_units || 0} units acknowledged`,
          suffix: '%',
          delta: mustReadDelta,
          pendingCount: (mustRead?.total_units || 0) - (mustRead?.acknowledged || 0),
        },
      },
      questionTopics,
      chatActivity,
      onboardingFunnel,
      unansweredQueries,
      houseTypeEngagement,
      summary: {
        totalUnits,
        registeredHomeowners,
        activeHomeowners,
        totalMessages,
        messageGrowth,
        totalDocuments: docCoverage?.total_docs || 0,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error(`[DeveloperDashboard] requestId=${requestId} CRITICAL ERROR:`, {
      message: errorMessage,
      stack: errorStack,
    });
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return createErrorResponse(requestId, 'Authentication required', errorMessage, 401);
    }
    
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return createErrorResponse(requestId, 'Access denied', errorMessage, 403);
    }
    
    // Database or query errors
    if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
      return createErrorResponse(requestId, 'Database schema error', 'Required table missing - contact support', 500);
    }
    
    if (errorMessage.includes('connection') || errorMessage.includes('ECONNREFUSED')) {
      return createErrorResponse(requestId, 'Database connection failed', 'Unable to connect to database', 503);
    }
    
    return createErrorResponse(requestId, 'Failed to load dashboard', errorMessage, 500);
  }
}
