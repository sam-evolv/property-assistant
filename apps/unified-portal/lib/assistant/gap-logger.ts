/**
 * Answer Gap Logger
 * 
 * Logs when the assistant cannot provide a grounded answer:
 * - Uses playbook fallback instead of document-grounded response
 * - Defers to developer/OMC due to missing data
 * - Smart Archive retrieval fails validation
 */

import { db } from '@openhouse/db/client';
import { answer_gap_log } from '@openhouse/db/schema';

export type GapReason = 
  | 'playbook_fallback'
  | 'defer_to_developer'
  | 'defer_to_omc'
  | 'low_doc_confidence'
  | 'no_documents_found'
  | 'category_mismatch'
  | 'scheme_mismatch'
  | 'missing_scheme_data'
  | 'validation_failed'
  | 'google_places_failed'
  | 'no_places_results'
  | 'amenities_fallback_used'
  | 'places_no_location'
  | 'unknown';

export interface GapLogEntry {
  scheme_id: string;
  unit_id?: string | null;
  user_question: string;
  intent_type?: string | null;
  attempted_sources?: string[];
  final_source?: string | null;
  gap_reason: GapReason;
}

export async function logAnswerGap(entry: GapLogEntry): Promise<void> {
  try {
    await db.insert(answer_gap_log).values({
      scheme_id: entry.scheme_id,
      unit_id: entry.unit_id || null,
      user_question: entry.user_question,
      intent_type: entry.intent_type || null,
      attempted_sources: entry.attempted_sources || [],
      final_source: entry.final_source || null,
      gap_reason: entry.gap_reason,
    });
    
    console.log('[GapLogger] Logged answer gap:', {
      scheme_id: entry.scheme_id,
      gap_reason: entry.gap_reason,
      intent_type: entry.intent_type,
    });
  } catch (error) {
    console.error('[GapLogger] Failed to log answer gap:', error);
  }
}

export async function getGapLogsByScheme(
  schemeId: string,
  options: {
    limit?: number;
    offset?: number;
    gapReason?: GapReason;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{
  logs: any[];
  totalCount: number;
}> {
  const { limit = 50, offset = 0 } = options;
  
  try {
    const { sql, eq, desc, and, gte, lte } = await import('drizzle-orm');
    
    const conditions = [eq(answer_gap_log.scheme_id, schemeId)];
    
    if (options.gapReason) {
      conditions.push(eq(answer_gap_log.gap_reason, options.gapReason));
    }
    
    if (options.startDate) {
      conditions.push(gte(answer_gap_log.created_at, options.startDate));
    }
    
    if (options.endDate) {
      conditions.push(lte(answer_gap_log.created_at, options.endDate));
    }
    
    const logs = await db
      .select()
      .from(answer_gap_log)
      .where(and(...conditions))
      .orderBy(desc(answer_gap_log.created_at))
      .limit(limit)
      .offset(offset);
    
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(answer_gap_log)
      .where(and(...conditions));
    
    const totalCount = Number(countResult[0]?.count || 0);
    
    return { logs, totalCount };
  } catch (error) {
    console.error('[GapLogger] Failed to get gap logs:', error);
    return { logs: [], totalCount: 0 };
  }
}

export interface GapSummary {
  totalGaps: number;
  byReason: Record<GapReason, number>;
  byIntent: Record<string, number>;
  recentTrend: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
}

export async function getGapSummary(schemeId: string): Promise<GapSummary> {
  try {
    const { sql, eq, gte, and, count } = await import('drizzle-orm');
    
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const [reasonCounts, intentCounts, trendCounts] = await Promise.all([
      db
        .select({
          gap_reason: answer_gap_log.gap_reason,
          count: sql<number>`count(*)`,
        })
        .from(answer_gap_log)
        .where(eq(answer_gap_log.scheme_id, schemeId))
        .groupBy(answer_gap_log.gap_reason),
      
      db
        .select({
          intent_type: answer_gap_log.intent_type,
          count: sql<number>`count(*)`,
        })
        .from(answer_gap_log)
        .where(eq(answer_gap_log.scheme_id, schemeId))
        .groupBy(answer_gap_log.intent_type),
      
      db
        .select({
          count24h: sql<number>`count(*) filter (where created_at >= ${last24h})`,
          count7d: sql<number>`count(*) filter (where created_at >= ${last7d})`,
          count30d: sql<number>`count(*) filter (where created_at >= ${last30d})`,
          total: sql<number>`count(*)`,
        })
        .from(answer_gap_log)
        .where(eq(answer_gap_log.scheme_id, schemeId)),
    ]);
    
    const byReason: Record<string, number> = {};
    for (const row of reasonCounts) {
      byReason[row.gap_reason || 'unknown'] = Number(row.count);
    }
    
    const byIntent: Record<string, number> = {};
    for (const row of intentCounts) {
      byIntent[row.intent_type || 'unknown'] = Number(row.count);
    }
    
    const trend = trendCounts[0] || { count24h: 0, count7d: 0, count30d: 0, total: 0 };
    
    return {
      totalGaps: Number(trend.total),
      byReason: byReason as Record<GapReason, number>,
      byIntent,
      recentTrend: {
        last24h: Number(trend.count24h),
        last7d: Number(trend.count7d),
        last30d: Number(trend.count30d),
      },
    };
  } catch (error) {
    console.error('[GapLogger] Failed to get gap summary:', error);
    return {
      totalGaps: 0,
      byReason: {} as Record<GapReason, number>,
      byIntent: {},
      recentTrend: { last24h: 0, last7d: 0, last30d: 0 },
    };
  }
}
