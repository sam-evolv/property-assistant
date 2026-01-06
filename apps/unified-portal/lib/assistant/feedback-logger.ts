/**
 * Micro-Feedback Capture
 * 
 * Logs thumbs-up/thumbs-down feedback on assistant responses.
 * Only available in test mode or for developer/admin users.
 */

import { db } from '@openhouse/db/client';
import { assistant_feedback } from '@openhouse/db/schema';

export type FeedbackValue = 'up' | 'down';

export interface FeedbackEntry {
  tenant_id: string;
  scheme_id: string;
  unit_id?: string | null;
  user_question: string;
  assistant_response: string;
  source_type: string;
  feedback_value: FeedbackValue;
  user_role?: string;
  session_id?: string;
}

export function canCaptureFeedback(
  isTestMode: boolean,
  userRole?: string
): boolean {
  if (isTestMode) return true;
  if (userRole === 'developer' || userRole === 'admin' || userRole === 'superadmin') return true;
  return false;
}

export async function logFeedback(entry: FeedbackEntry): Promise<{ success: boolean; id?: string }> {
  try {
    const result = await db.insert(assistant_feedback).values({
      tenant_id: entry.tenant_id,
      scheme_id: entry.scheme_id,
      unit_id: entry.unit_id || null,
      user_question: entry.user_question,
      assistant_response: entry.assistant_response.substring(0, 2000),
      source_type: entry.source_type,
      feedback_value: entry.feedback_value,
      user_role: entry.user_role || null,
      session_id: entry.session_id || null,
    }).returning({ id: assistant_feedback.id });
    
    console.log('[FeedbackLogger] Logged feedback:', {
      scheme_id: entry.scheme_id,
      feedback_value: entry.feedback_value,
      source_type: entry.source_type,
    });
    
    return { success: true, id: result[0]?.id };
  } catch (error) {
    console.error('[FeedbackLogger] Failed to log feedback:', error);
    return { success: false };
  }
}

export interface FeedbackSummary {
  totalFeedback: number;
  upCount: number;
  downCount: number;
  bySource: Record<string, { up: number; down: number }>;
  recentTrend: {
    last24h: { up: number; down: number };
    last7d: { up: number; down: number };
  };
}

export async function getFeedbackSummary(tenantId: string, schemeId: string): Promise<FeedbackSummary> {
  try {
    const { sql, eq, and } = await import('drizzle-orm');
    
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const tenantSchemeFilter = and(
      eq(assistant_feedback.tenant_id, tenantId),
      eq(assistant_feedback.scheme_id, schemeId)
    );
    
    const [sourceCounts, trendCounts] = await Promise.all([
      db
        .select({
          source_type: assistant_feedback.source_type,
          feedback_value: assistant_feedback.feedback_value,
          count: sql<number>`count(*)`,
        })
        .from(assistant_feedback)
        .where(tenantSchemeFilter)
        .groupBy(assistant_feedback.source_type, assistant_feedback.feedback_value),
      
      db
        .select({
          up24h: sql<number>`count(*) filter (where feedback_value = 'up' and created_at >= ${last24h})`,
          down24h: sql<number>`count(*) filter (where feedback_value = 'down' and created_at >= ${last24h})`,
          up7d: sql<number>`count(*) filter (where feedback_value = 'up' and created_at >= ${last7d})`,
          down7d: sql<number>`count(*) filter (where feedback_value = 'down' and created_at >= ${last7d})`,
          totalUp: sql<number>`count(*) filter (where feedback_value = 'up')`,
          totalDown: sql<number>`count(*) filter (where feedback_value = 'down')`,
        })
        .from(assistant_feedback)
        .where(tenantSchemeFilter),
    ]);
    
    const bySource: Record<string, { up: number; down: number }> = {};
    for (const row of sourceCounts) {
      const source = row.source_type || 'unknown';
      if (!bySource[source]) {
        bySource[source] = { up: 0, down: 0 };
      }
      if (row.feedback_value === 'up') {
        bySource[source].up = Number(row.count);
      } else {
        bySource[source].down = Number(row.count);
      }
    }
    
    const trend = trendCounts[0] || { up24h: 0, down24h: 0, up7d: 0, down7d: 0, totalUp: 0, totalDown: 0 };
    
    return {
      totalFeedback: Number(trend.totalUp) + Number(trend.totalDown),
      upCount: Number(trend.totalUp),
      downCount: Number(trend.totalDown),
      bySource,
      recentTrend: {
        last24h: { up: Number(trend.up24h), down: Number(trend.down24h) },
        last7d: { up: Number(trend.up7d), down: Number(trend.down7d) },
      },
    };
  } catch (error) {
    console.error('[FeedbackLogger] Failed to get feedback summary:', error);
    return {
      totalFeedback: 0,
      upCount: 0,
      downCount: 0,
      bySource: {},
      recentTrend: { last24h: { up: 0, down: 0 }, last7d: { up: 0, down: 0 } },
    };
  }
}
