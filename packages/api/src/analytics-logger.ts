import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';
import { createHash } from 'crypto';

export type EventType = 
  | 'chat_question' 
  | 'chat_fallback'
  | 'document_view' 
  | 'document_open'
  | 'document_download'
  | 'search' 
  | 'unanswered' 
  | 'error' 
  | 'session_start'
  | 'qr_scan'
  | 'purchaser_signup'
  | 'purchaser_activate'
  | 'session_active';

interface LogAnalyticsParams {
  tenantId: string;
  developmentId?: string;
  houseTypeCode?: string;
  eventType: EventType;
  eventCategory?: string;
  eventData?: Record<string, any>;
  sessionId?: string;
  unitId?: string;
}

export async function logAnalyticsEvent(params: LogAnalyticsParams): Promise<void> {
  try {
    const {
      tenantId,
      developmentId,
      houseTypeCode,
      eventType,
      eventCategory,
      eventData = {},
      sessionId,
      unitId
    } = params;

    const ANALYTICS_SALT = 'oh-anon-2024-' + new Date().toISOString().split('T')[0];
    const sessionHash = sessionId 
      ? createHash('sha256').update(sessionId + ANALYTICS_SALT).digest('hex').substring(0, 16)
      : null;

    const sanitisedData = sanitiseEventData({
      ...eventData,
      unit_id: unitId || eventData.unit_id
    });

    await db.execute(sql`
      INSERT INTO analytics_events (
        tenant_id, development_id, house_type_code, event_type, 
        event_category, event_data, session_hash
      ) VALUES (
        ${tenantId}::uuid,
        ${developmentId ? sql`${developmentId}::uuid` : sql`NULL`},
        ${houseTypeCode || null},
        ${eventType},
        ${eventCategory || null},
        ${JSON.stringify(sanitisedData)}::jsonb,
        ${sessionHash}
      )
    `);
  } catch (e) {
    console.error('[Analytics] Failed to log event:', e);
  }
}

function sanitiseEventData(data: Record<string, any>): Record<string, any> {
  const piiPatterns = [
    /email/i, /name/i, /address/i, /phone/i, /mobile/i,
    /ip/i, /token/i, /password/i, /auth/i
  ];
  
  const sanitised: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (piiPatterns.some(pattern => pattern.test(key))) {
      continue;
    }
    if (typeof value === 'string' && value.includes('@')) {
      continue;
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitised[key] = sanitiseEventData(value);
    } else {
      sanitised[key] = value;
    }
  }
  
  return sanitised;
}

export async function getAnalyticsSummary(tenantId: string, developmentId?: string, days: number = 30) {
  const devFilter = developmentId 
    ? sql`AND development_id = ${developmentId}::uuid`
    : sql``;

  const { rows: eventCounts } = await db.execute(sql`
    SELECT 
      event_type,
      event_category,
      COUNT(*) as count,
      COUNT(DISTINCT session_hash) as unique_sessions
    FROM analytics_events
    WHERE tenant_id = ${tenantId}::uuid
      ${devFilter}
      AND created_at > now() - interval '${sql.raw(days.toString())} days'
    GROUP BY event_type, event_category
    ORDER BY count DESC
  `);

  const { rows: dailyTrends } = await db.execute(sql`
    SELECT 
      DATE(created_at) as date,
      event_type,
      COUNT(*) as count
    FROM analytics_events
    WHERE tenant_id = ${tenantId}::uuid
      ${devFilter}
      AND created_at > now() - interval '${sql.raw(days.toString())} days'
    GROUP BY DATE(created_at), event_type
    ORDER BY date DESC
  `);

  const { rows: topTopics } = await db.execute(sql`
    SELECT 
      event_category as topic,
      COUNT(*) as count
    FROM analytics_events
    WHERE tenant_id = ${tenantId}::uuid
      ${devFilter}
      AND event_type = 'chat_question'
      AND event_category IS NOT NULL
      AND created_at > now() - interval '${sql.raw(days.toString())} days'
    GROUP BY event_category
    ORDER BY count DESC
    LIMIT 15
  `);

  const { rows: houseTypeBreakdown } = await db.execute(sql`
    SELECT 
      house_type_code,
      COUNT(*) as total_events,
      COUNT(*) FILTER (WHERE event_type = 'chat_question') as questions,
      COUNT(*) FILTER (WHERE event_type = 'unanswered') as unanswered
    FROM analytics_events
    WHERE tenant_id = ${tenantId}::uuid
      ${devFilter}
      AND house_type_code IS NOT NULL
      AND created_at > now() - interval '${sql.raw(days.toString())} days'
    GROUP BY house_type_code
    ORDER BY total_events DESC
  `);

  return {
    eventCounts,
    dailyTrends,
    topTopics,
    houseTypeBreakdown
  };
}

export async function getUnansweredReport(tenantId: string, developmentId?: string, days: number = 30) {
  const devFilter = developmentId 
    ? sql`AND development_id = ${developmentId}::uuid`
    : sql``;

  const { rows } = await db.execute(sql`
    SELECT 
      event_category as topic,
      event_data->>'reason' as reason,
      COUNT(*) as count,
      MAX(created_at) as last_occurrence
    FROM analytics_events
    WHERE tenant_id = ${tenantId}::uuid
      ${devFilter}
      AND event_type = 'unanswered'
      AND created_at > now() - interval '${sql.raw(days.toString())} days'
    GROUP BY event_category, event_data->>'reason'
    ORDER BY count DESC
    LIMIT 50
  `);

  return rows;
}

export interface BetaKPIs {
  totalUnits: number;
  uniqueQrScans: number;
  totalSignups: number;
  activatedUsers: number;
  active24h: number;
  questions24h: number;
  questions7d: number;
  fallbackRate: number;
}

export async function getBetaKPIs(developmentId?: string): Promise<BetaKPIs> {
  try {
    const devFilter = developmentId 
      ? sql`AND development_id = ${developmentId}::uuid`
      : sql``;

    const { rows: unitCount } = await db.execute(sql`
      SELECT COUNT(*) as count FROM units 
      WHERE 1=1 ${developmentId ? sql`AND development_id = ${developmentId}::uuid` : sql``}
    `);

    const { rows: qrScans } = await db.execute(sql`
      SELECT COUNT(DISTINCT session_hash) as count 
      FROM analytics_events 
      WHERE event_type = 'qr_scan'
      ${devFilter}
    `);

    const { rows: signups } = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM analytics_events 
      WHERE event_type = 'purchaser_signup'
      ${devFilter}
    `);

    const { rows: activated } = await db.execute(sql`
      SELECT COUNT(DISTINCT session_hash) as count 
      FROM analytics_events 
      WHERE event_type IN ('purchaser_activate', 'chat_question', 'document_open')
      ${devFilter}
    `);

    const { rows: active24h } = await db.execute(sql`
      SELECT COUNT(DISTINCT session_hash) as count 
      FROM analytics_events 
      WHERE created_at > now() - interval '24 hours'
      ${devFilter}
    `);

    const { rows: q24h } = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM analytics_events 
      WHERE event_type = 'chat_question'
      AND created_at > now() - interval '24 hours'
      ${devFilter}
    `);

    const { rows: q7d } = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM analytics_events 
      WHERE event_type = 'chat_question'
      AND created_at > now() - interval '7 days'
      ${devFilter}
    `);

    const { rows: fallbacks } = await db.execute(sql`
      SELECT 
        COUNT(*) FILTER (WHERE event_type = 'chat_fallback') as fallback_count,
        COUNT(*) FILTER (WHERE event_type = 'chat_question') as question_count
      FROM analytics_events 
      WHERE event_type IN ('chat_question', 'chat_fallback')
      AND created_at > now() - interval '7 days'
      ${devFilter}
    `);

    const fallbackData = fallbacks[0] as any || { fallback_count: 0, question_count: 0 };
    const fallbackRate = fallbackData.question_count > 0 
      ? (Number(fallbackData.fallback_count) / Number(fallbackData.question_count)) * 100 
      : 0;

    return {
      totalUnits: Number((unitCount[0] as any)?.count || 0),
      uniqueQrScans: Number((qrScans[0] as any)?.count || 0),
      totalSignups: Number((signups[0] as any)?.count || 0),
      activatedUsers: Number((activated[0] as any)?.count || 0),
      active24h: Number((active24h[0] as any)?.count || 0),
      questions24h: Number((q24h[0] as any)?.count || 0),
      questions7d: Number((q7d[0] as any)?.count || 0),
      fallbackRate: Math.round(fallbackRate * 10) / 10
    };
  } catch (e) {
    console.error('[Analytics] Failed to get Beta KPIs:', e);
    return {
      totalUnits: 0,
      uniqueQrScans: 0,
      totalSignups: 0,
      activatedUsers: 0,
      active24h: 0,
      questions24h: 0,
      questions7d: 0,
      fallbackRate: 0
    };
  }
}

export interface LiveActivityEvent {
  id: string;
  eventType: string;
  eventCategory: string | null;
  developmentName: string | null;
  houseTypeCode: string | null;
  createdAt: string;
  eventData: Record<string, any>;
}

export async function getLiveActivity(options: {
  developmentId?: string;
  eventType?: string;
  hours?: number;
  limit?: number;
  offset?: number;
}): Promise<{ events: LiveActivityEvent[]; total: number }> {
  try {
    const { developmentId, eventType, hours = 24, limit = 50, offset = 0 } = options;

    let filters = sql`WHERE ae.created_at > now() - interval '${sql.raw(hours.toString())} hours'`;
    
    if (developmentId) {
      filters = sql`${filters} AND ae.development_id = ${developmentId}::uuid`;
    }
    if (eventType) {
      filters = sql`${filters} AND ae.event_type = ${eventType}`;
    }

    const { rows: countResult } = await db.execute(sql`
      SELECT COUNT(*) as total FROM analytics_events ae ${filters}
    `);
    const total = Number((countResult[0] as any)?.total || 0);

    const { rows } = await db.execute(sql`
      SELECT 
        ae.id::text,
        ae.event_type,
        ae.event_category,
        ae.house_type_code,
        ae.created_at,
        ae.event_data,
        d.name as development_name
      FROM analytics_events ae
      LEFT JOIN developments d ON ae.development_id = d.id
      ${filters}
      ORDER BY ae.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    return {
      events: rows.map((r: any) => ({
        id: r.id,
        eventType: r.event_type,
        eventCategory: r.event_category,
        developmentName: r.development_name,
        houseTypeCode: r.house_type_code,
        createdAt: r.created_at,
        eventData: r.event_data || {}
      })),
      total
    };
  } catch (e) {
    console.error('[Analytics] Failed to get live activity:', e);
    return { events: [], total: 0 };
  }
}

export interface TopQuestion {
  question: string;
  count: number;
  lastAsked: string;
  confidenceLevel?: string;
  developmentName?: string;
}

export async function getTopQuestions(options: {
  developmentId?: string;
  hours?: number;
  limit?: number;
}): Promise<TopQuestion[]> {
  try {
    const { developmentId, hours = 24, limit = 20 } = options;

    const devFilter = developmentId 
      ? sql`AND ae.development_id = ${developmentId}::uuid`
      : sql``;

    // Use question_preview if available, fallback to event_category for older events
    const { rows } = await db.execute(sql`
      SELECT 
        COALESCE(ae.event_data->>'question_preview', ae.event_category, 'Unknown') as question,
        COUNT(*) as count,
        MAX(ae.created_at) as last_asked,
        MAX(ae.event_data->>'confidenceLevel') as confidence_level,
        d.name as development_name
      FROM analytics_events ae
      LEFT JOIN developments d ON ae.development_id = d.id
      WHERE ae.event_type = 'chat_question'
      AND ae.created_at > now() - interval '${sql.raw(hours.toString())} hours'
      ${devFilter}
      GROUP BY COALESCE(ae.event_data->>'question_preview', ae.event_category, 'Unknown'), d.name
      ORDER BY count DESC
      LIMIT ${limit}
    `);

    return rows.map((r: any) => ({
      question: r.question || 'Unknown',
      count: Number(r.count),
      lastAsked: r.last_asked,
      confidenceLevel: r.confidence_level,
      developmentName: r.development_name
    }));
  } catch (e) {
    console.error('[Analytics] Failed to get top questions:', e);
    return [];
  }
}

export interface TrainingOpportunity {
  question: string;
  topic: string;
  developmentName: string | null;
  similarity: string;
  confidenceLevel: string;
  occurrences: number;
  lastAsked: string;
}

export async function getTrainingOpportunities(options: {
  developmentId?: string;
  hours?: number;
  limit?: number;
}): Promise<TrainingOpportunity[]> {
  try {
    const { developmentId, hours = 168, limit = 20 } = options; // Default 7 days

    const devFilter = developmentId 
      ? sql`AND ae.development_id = ${developmentId}::uuid`
      : sql``;

    // Find questions with low confidence or marked as needing training
    const { rows } = await db.execute(sql`
      SELECT 
        COALESCE(ae.event_data->>'question_preview', ae.event_category, 'Unknown') as question,
        ae.event_category as topic,
        d.name as development_name,
        ae.event_data->>'topSimilarity' as similarity,
        ae.event_data->>'confidenceLevel' as confidence_level,
        COUNT(*) as occurrences,
        MAX(ae.created_at) as last_asked
      FROM analytics_events ae
      LEFT JOIN developments d ON ae.development_id = d.id
      WHERE ae.event_type = 'chat_question'
      AND ae.created_at > now() - interval '${sql.raw(hours.toString())} hours'
      AND (
        ae.event_data->>'needsTraining' = 'true'
        OR ae.event_data->>'confidenceLevel' = 'low'
        OR CAST(ae.event_data->>'topSimilarity' AS DECIMAL) < 0.35
      )
      ${devFilter}
      GROUP BY 
        COALESCE(ae.event_data->>'question_preview', ae.event_category, 'Unknown'),
        ae.event_category,
        d.name,
        ae.event_data->>'topSimilarity',
        ae.event_data->>'confidenceLevel'
      ORDER BY occurrences DESC, last_asked DESC
      LIMIT ${limit}
    `);

    return rows.map((r: any) => ({
      question: r.question || 'Unknown',
      topic: r.topic || 'unknown',
      developmentName: r.development_name,
      similarity: r.similarity || '0',
      confidenceLevel: r.confidence_level || 'unknown',
      occurrences: Number(r.occurrences),
      lastAsked: r.last_asked
    }));
  } catch (e) {
    console.error('[Analytics] Failed to get training opportunities:', e);
    return [];
  }
}

export interface UnactivatedSignup {
  sessionHash: string;
  signupTime: string;
  developmentName: string | null;
  hoursSinceSignup: number;
}

// ============ UNANSWERED QUESTIONS ============

export interface UnansweredQuestion {
  question: string;
  topic: string;
  developmentName: string | null;
  reason: string;
  occurrences: number;
  lastAsked: string;
}

export async function getUnansweredQuestions(options: {
  developmentId?: string;
  hours?: number;
  limit?: number;
}): Promise<UnansweredQuestion[]> {
  try {
    const { developmentId, hours = 168, limit = 30 } = options; // Default 7 days

    const devFilter = developmentId 
      ? sql`AND ae.development_id = ${developmentId}::uuid`
      : sql``;

    const { rows } = await db.execute(sql`
      SELECT 
        COALESCE(ae.event_data->>'question_preview', 'Unknown question') as question,
        ae.event_category as topic,
        d.name as development_name,
        COALESCE(ae.event_data->>'reason', 'unknown') as reason,
        COUNT(*) as occurrences,
        MAX(ae.created_at) as last_asked
      FROM analytics_events ae
      LEFT JOIN developments d ON ae.development_id = d.id
      WHERE ae.event_type = 'unanswered'
      AND ae.created_at > now() - interval '${sql.raw(hours.toString())} hours'
      ${devFilter}
      GROUP BY 
        COALESCE(ae.event_data->>'question_preview', 'Unknown question'),
        ae.event_category,
        d.name,
        COALESCE(ae.event_data->>'reason', 'unknown')
      ORDER BY occurrences DESC, last_asked DESC
      LIMIT ${limit}
    `);

    return rows.map((r: any) => ({
      question: r.question || 'Unknown question',
      topic: r.topic || 'unknown',
      developmentName: r.development_name,
      reason: r.reason || 'unknown',
      occurrences: Number(r.occurrences),
      lastAsked: r.last_asked
    }));
  } catch (e) {
    console.error('[Analytics] Failed to get unanswered questions:', e);
    return [];
  }
}

// ============ DOCUMENT USAGE TRACKING ============

export interface DocumentUsage {
  documentName: string;
  documentId: string | null;
  developmentName: string | null;
  usageCount: number;
  avgSimilarity: number;
  lastUsed: string;
}

export async function getDocumentUsage(options: {
  developmentId?: string;
  hours?: number;
  limit?: number;
}): Promise<{ mostUsed: DocumentUsage[]; leastUsed: DocumentUsage[] }> {
  try {
    const { developmentId, hours = 168, limit = 15 } = options;

    const devFilter = developmentId 
      ? sql`AND ae.development_id = ${developmentId}::uuid`
      : sql``;

    // Get most used documents from analytics
    // Use WITH ORDINALITY to properly zip sourceDocIds and sourceDocNames arrays
    const { rows: mostUsedRows } = await db.execute(sql`
      WITH doc_refs AS (
        SELECT 
          ae.development_id,
          ids.val as doc_id,
          COALESCE(names.val, 'Unknown') as doc_name,
          COALESCE((ae.event_data->>'topSimilarity')::decimal, 0) as similarity,
          ae.created_at
        FROM analytics_events ae,
        LATERAL jsonb_array_elements_text(COALESCE(ae.event_data->'sourceDocIds', '[]'::jsonb)) WITH ORDINALITY AS ids(val, ord)
        LEFT JOIN LATERAL jsonb_array_elements_text(COALESCE(ae.event_data->'sourceDocNames', '[]'::jsonb)) WITH ORDINALITY AS names(val, ord)
          ON ids.ord = names.ord
        WHERE ae.event_type = 'chat_question'
        AND ae.event_data ? 'sourceDocIds'
        AND jsonb_array_length(COALESCE(ae.event_data->'sourceDocIds', '[]'::jsonb)) > 0
        AND ae.created_at > now() - interval '${sql.raw(hours.toString())} hours'
        ${devFilter}
      )
      SELECT 
        dr.doc_name as document_name,
        dr.doc_id as document_id,
        d.name as development_name,
        COUNT(*)::integer as usage_count,
        COALESCE(AVG(dr.similarity), 0) as avg_similarity,
        MAX(dr.created_at) as last_used
      FROM doc_refs dr
      LEFT JOIN developments d ON dr.development_id = d.id
      WHERE dr.doc_id IS NOT NULL AND dr.doc_id != ''
      GROUP BY dr.doc_name, dr.doc_id, d.name
      ORDER BY usage_count DESC
      LIMIT ${limit}
    `);

    // Get documents that exist but haven't been cited much
    // This lists all documents and their usage count (0 if never cited)
    const { rows: leastUsedRows } = await db.execute(sql`
      WITH doc_usage AS (
        SELECT 
          elem.doc_id,
          COUNT(*)::integer as usage_count
        FROM analytics_events ae,
        LATERAL jsonb_array_elements_text(COALESCE(ae.event_data->'sourceDocIds', '[]'::jsonb)) as elem(doc_id)
        WHERE ae.event_type = 'chat_question'
        AND ae.event_data ? 'sourceDocIds'
        AND ae.created_at > now() - interval '${sql.raw(hours.toString())} hours'
        ${devFilter}
        GROUP BY elem.doc_id
      ),
      all_docs AS (
        SELECT 
          docs.id::text as doc_id,
          docs.file_name as document_name,
          d.name as development_name
        FROM documents docs
        LEFT JOIN developments d ON docs.development_id = d.id
        WHERE docs.file_name IS NOT NULL AND docs.file_name != ''
        ${developmentId ? sql`AND docs.development_id = ${developmentId}::uuid` : sql``}
      )
      SELECT 
        ad.document_name,
        ad.doc_id as document_id,
        ad.development_name,
        COALESCE(du.usage_count, 0)::integer as usage_count,
        0::decimal as avg_similarity,
        NULL::timestamptz as last_used
      FROM all_docs ad
      LEFT JOIN doc_usage du ON ad.doc_id = du.doc_id
      ORDER BY COALESCE(du.usage_count, 0) ASC, ad.document_name ASC
      LIMIT ${limit}
    `);

    return {
      mostUsed: mostUsedRows.map((r: any) => ({
        documentName: r.document_name || 'Unknown',
        documentId: r.document_id,
        developmentName: r.development_name,
        usageCount: Number(r.usage_count) || 0,
        avgSimilarity: parseFloat(r.avg_similarity) || 0,
        lastUsed: r.last_used
      })),
      leastUsed: leastUsedRows.map((r: any) => ({
        documentName: r.document_name || 'Unknown',
        documentId: r.document_id,
        developmentName: r.development_name,
        usageCount: Number(r.usage_count) || 0,
        avgSimilarity: parseFloat(r.avg_similarity) || 0,
        lastUsed: r.last_used
      }))
    };
  } catch (e) {
    console.error('[Analytics] Failed to get document usage:', e);
    return { mostUsed: [], leastUsed: [] };
  }
}

// ============ CONVERSATION COMPLETION TRACKING ============

export interface ConversationStats {
  totalConversations: number;
  avgMessagesPerSession: number;
  singleMessageSessions: number;
  multiMessageSessions: number;
  deepConversations: number; // 5+ messages
  sessionsByDepth: { depth: number; count: number }[];
}

export async function getConversationStats(options: {
  developmentId?: string;
  hours?: number;
}): Promise<ConversationStats> {
  try {
    const { developmentId, hours = 168 } = options;

    const devFilter = developmentId 
      ? sql`AND development_id = ${developmentId}::uuid`
      : sql``;

    // Get conversation depth by session - with explicit integer casting
    const { rows: sessionDepths } = await db.execute(sql`
      SELECT 
        session_hash,
        COUNT(*)::integer as message_count
      FROM analytics_events
      WHERE event_type = 'chat_question'
      AND session_hash IS NOT NULL
      AND session_hash != ''
      AND created_at > now() - interval '${sql.raw(hours.toString())} hours'
      ${devFilter}
      GROUP BY session_hash
    `);

    // Safely convert to numbers with fallback
    const depths = sessionDepths.map((r: any) => {
      const count = r.message_count;
      return typeof count === 'number' ? count : parseInt(String(count), 10) || 0;
    });
    
    const totalConversations = depths.length;
    
    // Guard against divide by zero
    const totalMessages = depths.reduce((a, b) => a + b, 0);
    const avgMessages = totalConversations > 0 
      ? totalMessages / totalConversations 
      : 0;

    const singleMessage = depths.filter(d => d === 1).length;
    const multiMessage = depths.filter(d => d >= 2).length;
    const deepConversations = depths.filter(d => d >= 5).length;

    // Group by depth for histogram
    const depthCounts = new Map<number, number>();
    depths.forEach(d => {
      const bucket = Math.min(d, 10); // Cap at 10+ for grouping
      depthCounts.set(bucket, (depthCounts.get(bucket) || 0) + 1);
    });

    const sessionsByDepth = Array.from(depthCounts.entries())
      .map(([depth, count]) => ({ depth, count }))
      .sort((a, b) => a.depth - b.depth);

    return {
      totalConversations,
      avgMessagesPerSession: Math.round(avgMessages * 10) / 10,
      singleMessageSessions: singleMessage,
      multiMessageSessions: multiMessage,
      deepConversations,
      sessionsByDepth
    };
  } catch (e) {
    console.error('[Analytics] Failed to get conversation stats:', e);
    return {
      totalConversations: 0,
      avgMessagesPerSession: 0,
      singleMessageSessions: 0,
      multiMessageSessions: 0,
      deepConversations: 0,
      sessionsByDepth: []
    };
  }
}

export async function getUnactivatedSignups(options: {
  developmentId?: string;
  windowHours?: number;
  limit?: number;
}): Promise<UnactivatedSignup[]> {
  try {
    const { developmentId, windowHours = 6, limit = 50 } = options;

    const devFilter = developmentId 
      ? sql`AND s.development_id = ${developmentId}::uuid`
      : sql``;

    const { rows } = await db.execute(sql`
      WITH signups AS (
        SELECT 
          session_hash,
          development_id,
          MIN(created_at) as signup_time
        FROM analytics_events
        WHERE event_type = 'purchaser_signup'
        AND session_hash IS NOT NULL
        ${devFilter}
        GROUP BY session_hash, development_id
      ),
      activated AS (
        SELECT DISTINCT session_hash
        FROM analytics_events
        WHERE event_type IN ('chat_question', 'document_open', 'purchaser_activate')
      )
      SELECT 
        s.session_hash,
        s.signup_time,
        d.name as development_name,
        EXTRACT(EPOCH FROM (now() - s.signup_time)) / 3600 as hours_since
      FROM signups s
      LEFT JOIN developments d ON s.development_id = d.id
      LEFT JOIN activated a ON s.session_hash = a.session_hash
      WHERE a.session_hash IS NULL
      AND s.signup_time < now() - interval '${sql.raw(windowHours.toString())} hours'
      ORDER BY s.signup_time DESC
      LIMIT ${limit}
    `);

    return rows.map((r: any) => ({
      sessionHash: r.session_hash,
      signupTime: r.signup_time,
      developmentName: r.development_name,
      hoursSinceSignup: Math.round(Number(r.hours_since) * 10) / 10
    }));
  } catch (e) {
    console.error('[Analytics] Failed to get unactivated signups:', e);
    return [];
  }
}
