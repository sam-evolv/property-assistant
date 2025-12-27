import { NextRequest, NextResponse } from 'next/server';
import { assertDeveloper, enforceTenantScope, enforceDevelopmentScope } from '@/lib/api-auth';
import { db } from '@openhouse/db';
import { messages, homeowners, documents, units } from '@openhouse/db/schema';
import { sql, gte, and, eq, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';

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
    const context = await assertDeveloper();
    
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get('tenantId') || undefined;
    const tenantId = enforceTenantScope(context, requestedTenantId);
    
    const requestedDevelopmentId = searchParams.get('developmentId') || undefined;
    const developmentId = await enforceDevelopmentScope(context, requestedDevelopmentId);
    
    const days = parseInt(searchParams.get('days') || '30');

    const now = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const previousStartDate = new Date();
    previousStartDate.setDate(previousStartDate.getDate() - (days * 2));
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const devFilter = developmentId ? sql`AND development_id = ${developmentId}` : sql``;
    const devFilterDrizzle = developmentId ? eq(units.development_id, developmentId) : sql`1=1`;
    const msgDevFilter = developmentId ? eq(messages.development_id, developmentId) : sql`1=1`;
    const docDevFilter = developmentId ? eq(documents.development_id, developmentId) : sql`1=1`;
    const homeownerDevFilter = developmentId ? eq(homeowners.development_id, developmentId) : sql`1=1`;

    // Run queries sequentially to avoid connection pool exhaustion
    const totalUnitsResult = await db.select({ count: count() })
      .from(units)
      .where(and(eq(units.tenant_id, tenantId), devFilterDrizzle));
    
    const registeredHomeownersResult = await db.select({ count: count() })
      .from(homeowners)
      .where(and(eq(homeowners.tenant_id, tenantId), homeownerDevFilter));
    
    const activeHomeownersResult = await (developmentId 
      ? db.execute(sql`
          SELECT COUNT(DISTINCT m.user_id)::int as count
          FROM messages m
          WHERE m.tenant_id = ${tenantId}
            AND m.development_id = ${developmentId}
            AND m.created_at >= ${sevenDaysAgo} 
            AND m.user_id IS NOT NULL
        `)
      : db.execute(sql`
          SELECT COUNT(DISTINCT m.user_id)::int as count
          FROM messages m
          WHERE m.tenant_id = ${tenantId}
            AND m.created_at >= ${sevenDaysAgo} 
            AND m.user_id IS NOT NULL
        `));
    
    const previousActiveResult = await (developmentId 
      ? db.execute(sql`
          SELECT COUNT(DISTINCT m.user_id)::int as count
          FROM messages m
          WHERE m.tenant_id = ${tenantId}
            AND m.development_id = ${developmentId}
            AND m.created_at >= ${previousStartDate} 
            AND m.created_at < ${sevenDaysAgo}
            AND m.user_id IS NOT NULL
        `)
      : db.execute(sql`
          SELECT COUNT(DISTINCT m.user_id)::int as count
          FROM messages m
          WHERE m.tenant_id = ${tenantId}
            AND m.created_at >= ${previousStartDate} 
            AND m.created_at < ${sevenDaysAgo}
            AND m.user_id IS NOT NULL
        `));
    
    const totalMessagesResult = await db.select({ count: count() })
      .from(messages)
      .where(and(
        eq(messages.tenant_id, tenantId),
        gte(messages.created_at, startDate),
        msgDevFilter
      ));
    
    const previousMessagesResult = await db.select({ count: count() })
      .from(messages)
      .where(and(
        eq(messages.tenant_id, tenantId),
        gte(messages.created_at, previousStartDate),
        sql`created_at < ${startDate}`,
        msgDevFilter
      ));
    
    const questionTopicsResult = await db.execute(sql`
      SELECT 
        COALESCE(question_topic, 'general') as topic,
        COUNT(*)::int as count
      FROM messages
      WHERE tenant_id = ${tenantId}
        AND created_at >= ${startDate}
        AND user_message IS NOT NULL
        ${devFilter}
      GROUP BY COALESCE(question_topic, 'general')
      ORDER BY COUNT(*) DESC
      LIMIT 8
    `);
    
    const documentCoverageResult = await db.execute(sql`
      SELECT 
        COUNT(DISTINCT d.id)::int as total_docs,
        COUNT(DISTINCT d.house_type_code)::int as covered_house_types,
        (SELECT COUNT(DISTINCT house_type_code)::int FROM units WHERE tenant_id = ${tenantId} ${devFilter}) as total_house_types
      FROM documents d
      WHERE d.tenant_id = ${tenantId}
        ${developmentId ? sql`AND d.development_id = ${developmentId}` : sql``}
    `);
    
    const mustReadComplianceResult = await db.execute(sql`
      SELECT 
        COUNT(*)::int as total_units,
        COUNT(CASE WHEN important_docs_agreed_at IS NOT NULL THEN 1 END)::int as acknowledged
      FROM units
      WHERE tenant_id = ${tenantId}
        ${devFilter}
    `);
    
    const recentQuestionsResult = await db.execute(sql`
      SELECT 
        user_message,
        question_topic,
        created_at,
        metadata
      FROM messages
      WHERE tenant_id = ${tenantId}
        AND user_message IS NOT NULL
        AND created_at >= ${startDate}
        ${devFilter}
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    const chatActivityResult = await db.execute(sql`
      SELECT 
        DATE(created_at) as date,
        COUNT(*)::int as count
      FROM messages
      WHERE tenant_id = ${tenantId}
        AND created_at >= ${startDate}
        ${devFilter}
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `);
    
    const houseTypeEngagementResult = await db.execute(sql`
      SELECT 
        u.house_type_code,
        COUNT(DISTINCT m.user_id)::int as active_users,
        COUNT(m.id)::int as message_count
      FROM units u
      LEFT JOIN messages m ON m.user_id = u.unit_uid AND m.tenant_id = ${tenantId} AND m.created_at >= ${startDate}
      WHERE u.tenant_id = ${tenantId}
        AND u.house_type_code IS NOT NULL
        ${devFilter}
      GROUP BY u.house_type_code
      ORDER BY message_count DESC
      LIMIT 10
    `);

    const totalUnits = totalUnitsResult[0]?.count || 0;
    const registeredHomeowners = registeredHomeownersResult[0]?.count || 0;
    const activeHomeowners = (activeHomeownersResult.rows[0] as any)?.count || 0;
    const previousActive = (previousActiveResult.rows[0] as any)?.count || 0;
    const totalMessages = totalMessagesResult[0]?.count || 0;
    const previousMessages = previousMessagesResult[0]?.count || 0;
    
    // Debug logging
    console.log('[Dashboard Debug] developmentId:', developmentId);
    console.log('[Dashboard Debug] tenantId:', tenantId);
    console.log('[Dashboard Debug] sevenDaysAgo:', sevenDaysAgo);
    console.log('[Dashboard Debug] activeHomeownersResult:', JSON.stringify(activeHomeownersResult.rows));
    console.log('[Dashboard Debug] activeHomeowners count:', activeHomeowners);

    const onboardingRate = totalUnits > 0 
      ? Math.round((registeredHomeowners / totalUnits) * 100) 
      : 0;
    
    const engagementRate = registeredHomeowners > 0 
      ? Math.round((activeHomeowners / registeredHomeowners) * 100) 
      : 0;
    
    const activeGrowth = previousActive > 0 
      ? Math.round(((activeHomeowners - previousActive) / previousActive) * 100) 
      : (activeHomeowners > 0 ? 100 : 0);
    
    const messageGrowth = previousMessages > 0 
      ? Math.round(((totalMessages - previousMessages) / previousMessages) * 100) 
      : (totalMessages > 0 ? 100 : 0);

    const docCoverage = documentCoverageResult.rows[0] as any;
    const documentCoverageRate = docCoverage?.total_house_types > 0
      ? Math.round((docCoverage.covered_house_types / docCoverage.total_house_types) * 100)
      : 0;

    const mustRead = mustReadComplianceResult.rows[0] as any;
    const mustReadRate = mustRead?.total_units > 0
      ? Math.round((mustRead.acknowledged / mustRead.total_units) * 100)
      : 0;

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
          description: `${registeredHomeowners} of ${totalUnits} units registered`,
          suffix: '%',
        },
        engagementRate: {
          value: engagementRate,
          label: 'Engagement Rate',
          description: `${activeHomeowners} active in last 7 days`,
          suffix: '%',
          growth: activeGrowth,
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
