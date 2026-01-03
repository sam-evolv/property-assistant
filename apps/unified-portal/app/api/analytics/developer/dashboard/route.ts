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

    const devFilter = developmentId ? sql`AND development_id = ${developmentId}` : sql``;
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
    
    // Active homeowners - uses messages table which should exist
    let activeHomeowners = 0;
    let previousActive = 0;
    try {
      const activeResult = await (developmentId 
        ? db.execute(sql`SELECT COUNT(DISTINCT m.user_id)::int as count FROM messages m WHERE m.tenant_id = ${tenantId} AND m.development_id = ${developmentId} AND m.created_at >= ${sevenDaysAgo} AND m.user_id IS NOT NULL`)
        : db.execute(sql`SELECT COUNT(DISTINCT m.user_id)::int as count FROM messages m WHERE m.tenant_id = ${tenantId} AND m.created_at >= ${sevenDaysAgo} AND m.user_id IS NOT NULL`));
      activeHomeowners = (activeResult.rows[0] as any)?.count || 0;
      
      const prevResult = await (developmentId 
        ? db.execute(sql`SELECT COUNT(DISTINCT m.user_id)::int as count FROM messages m WHERE m.tenant_id = ${tenantId} AND m.development_id = ${developmentId} AND m.created_at >= ${previousStartDate} AND m.created_at < ${sevenDaysAgo} AND m.user_id IS NOT NULL`)
        : db.execute(sql`SELECT COUNT(DISTINCT m.user_id)::int as count FROM messages m WHERE m.tenant_id = ${tenantId} AND m.created_at >= ${previousStartDate} AND m.created_at < ${sevenDaysAgo} AND m.user_id IS NOT NULL`));
      previousActive = (prevResult.rows[0] as any)?.count || 0;
    } catch (e) {
      console.log(`[DeveloperDashboard] Active users query failed (graceful fallback to 0):`, e);
    }
    
    // Message counts
    let totalMessages = 0;
    let previousMessages = 0;
    try {
      const msgResult = await db.select({ count: count() }).from(messages).where(
        developmentId
          ? and(eq(messages.tenant_id, tenantId), gte(messages.created_at, startDate), eq(messages.development_id, developmentId))
          : and(eq(messages.tenant_id, tenantId), gte(messages.created_at, startDate))
      );
      totalMessages = msgResult[0]?.count || 0;
      
      const prevMsgResult = await db.select({ count: count() }).from(messages).where(
        developmentId
          ? and(eq(messages.tenant_id, tenantId), gte(messages.created_at, previousStartDate), sql`created_at < ${startDate}`, eq(messages.development_id, developmentId))
          : and(eq(messages.tenant_id, tenantId), gte(messages.created_at, previousStartDate), sql`created_at < ${startDate}`)
      );
      previousMessages = prevMsgResult[0]?.count || 0;
    } catch (e) {
      console.log(`[DeveloperDashboard] Messages query failed (graceful fallback to 0):`, e);
    }
    
    // Question topics
    let questionTopicsResult = { rows: [] as any[] };
    try {
      questionTopicsResult = await db.execute(sql`
        SELECT COALESCE(question_topic, 'general') as topic, COUNT(*)::int as count
        FROM messages WHERE tenant_id = ${tenantId} AND created_at >= ${startDate} AND user_message IS NOT NULL ${devFilter}
        GROUP BY COALESCE(question_topic, 'general') ORDER BY COUNT(*) DESC LIMIT 8
      `);
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
    
    // Must-read compliance from both Supabase and Drizzle purchaser_agreements
    let mustRead = { total_units: totalUnits, acknowledged: 0 };
    try {
      // Check Supabase units table for important_docs_agreed_at
      let supabaseAckQuery = supabaseAdmin.from('units').select('*', { count: 'exact', head: true }).not('important_docs_agreed_at', 'is', null);
      if (developmentId) {
        supabaseAckQuery = supabaseAckQuery.eq('project_id', developmentId);
      }
      const { count: supabaseAckCount } = await supabaseAckQuery;
      
      // Also check Drizzle purchaser_agreements table
      let drizzleAckCount = 0;
      try {
        const drizzleResult = await db.execute(sql`
          SELECT COUNT(DISTINCT unit_id)::int as count 
          FROM purchaser_agreements 
          WHERE docs_version > 0
        `);
        drizzleAckCount = (drizzleResult.rows[0] as any)?.count || 0;
      } catch (drizzleError) {
        console.log(`[DeveloperDashboard] Drizzle purchaser_agreements query failed:`, drizzleError);
      }
      
      // Use the higher count (some agreements might be in one table, some in the other)
      const totalAcknowledged = Math.max(supabaseAckCount || 0, drizzleAckCount);
      mustRead = { total_units: totalUnits, acknowledged: totalAcknowledged };
      console.log(`[DeveloperDashboard] Must-read: supabase=${supabaseAckCount}, drizzle=${drizzleAckCount}, using=${totalAcknowledged}`);
    } catch (e) {
      console.log(`[DeveloperDashboard] Must-read compliance query failed (graceful fallback):`, e);
    }
    
    // Recent questions
    let recentQuestionsResult = { rows: [] as any[] };
    try {
      recentQuestionsResult = await db.execute(sql`
        SELECT user_message, question_topic, created_at, metadata FROM messages
        WHERE tenant_id = ${tenantId} AND user_message IS NOT NULL AND created_at >= ${startDate} ${devFilter}
        ORDER BY created_at DESC LIMIT 20
      `);
    } catch (e) {
      console.log(`[DeveloperDashboard] Recent questions query failed (graceful fallback):`, e);
    }
    
    // Chat activity
    let chatActivityResult = { rows: [] as any[] };
    try {
      chatActivityResult = await db.execute(sql`
        SELECT DATE(created_at) as date, COUNT(*)::int as count FROM messages
        WHERE tenant_id = ${tenantId} AND created_at >= ${startDate} ${devFilter}
        GROUP BY DATE(created_at) ORDER BY DATE(created_at) ASC
      `);
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
