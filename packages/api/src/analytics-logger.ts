import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';
import { createHash } from 'crypto';

export type EventType = 
  | 'chat_question' 
  | 'chat_fallback'
  | 'document_view' 
  | 'document_open'
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
}

export async function getTopQuestions(options: {
  developmentId?: string;
  hours?: number;
  limit?: number;
}): Promise<TopQuestion[]> {
  try {
    const { developmentId, hours = 24, limit = 20 } = options;

    const devFilter = developmentId 
      ? sql`AND development_id = ${developmentId}::uuid`
      : sql``;

    const { rows } = await db.execute(sql`
      SELECT 
        event_data->>'question_preview' as question,
        COUNT(*) as count,
        MAX(created_at) as last_asked
      FROM analytics_events
      WHERE event_type = 'chat_question'
      AND event_data->>'question_preview' IS NOT NULL
      AND created_at > now() - interval '${sql.raw(hours.toString())} hours'
      ${devFilter}
      GROUP BY event_data->>'question_preview'
      ORDER BY count DESC
      LIMIT ${limit}
    `);

    return rows.map((r: any) => ({
      question: r.question || 'Unknown',
      count: Number(r.count),
      lastAsked: r.last_asked
    }));
  } catch (e) {
    console.error('[Analytics] Failed to get top questions:', e);
    return [];
  }
}

export interface UnactivatedSignup {
  sessionHash: string;
  signupTime: string;
  developmentName: string | null;
  hoursSinceSignup: number;
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
