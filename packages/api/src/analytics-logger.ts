import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';
import { createHash } from 'crypto';

export type EventType = 'chat_question' | 'document_view' | 'search' | 'unanswered' | 'error' | 'session_start';

interface LogAnalyticsParams {
  tenantId: string;
  developmentId?: string;
  houseTypeCode?: string;
  eventType: EventType;
  eventCategory?: string;
  eventData?: Record<string, any>;
  // Note: sessionId is NOT stored - we only use it to generate an irreversible
  // per-day hash that cannot be traced back to a specific resident
  sessionId?: string;
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
      sessionId
    } = params;

    // Create irreversible daily session hash - combines session ID with date and salt
    // This allows same-day event grouping but prevents cross-day tracking of individuals
    // The salt makes it impossible to reverse even with rainbow tables
    const ANALYTICS_SALT = 'oh-anon-2024-' + new Date().toISOString().split('T')[0];
    const sessionHash = sessionId 
      ? createHash('sha256').update(sessionId + ANALYTICS_SALT).digest('hex').substring(0, 16)
      : null;

    // Ensure event data is anonymised
    const sanitisedData = sanitiseEventData(eventData);

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
    // Don't throw if logging fails
    console.error('[Analytics] Failed to log event:', e);
  }
}

// Strip PII from event data
function sanitiseEventData(data: Record<string, any>): Record<string, any> {
  const piiPatterns = [
    /email/i, /name/i, /address/i, /phone/i, /mobile/i,
    /ip/i, /token/i, /password/i, /auth/i
  ];
  
  const sanitised: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (piiPatterns.some(pattern => pattern.test(key))) {
      continue; // Skip PII fields entirely
    }
    if (typeof value === 'string' && value.includes('@')) {
      continue; // Skip email-like strings
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitised[key] = sanitiseEventData(value);
    } else {
      sanitised[key] = value;
    }
  }
  
  return sanitised;
}

// Get analytics summary for dashboard
export async function getAnalyticsSummary(tenantId: string, developmentId?: string, days: number = 30) {
  const devFilter = developmentId 
    ? sql`AND development_id = ${developmentId}::uuid`
    : sql``;

  // Get event counts by type
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

  // Get daily trends
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

  // Get top question topics
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

  // Get house type breakdown
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

// Get "what couldn't be answered" report
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
