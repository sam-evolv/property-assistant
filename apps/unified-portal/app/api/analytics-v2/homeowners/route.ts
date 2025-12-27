/*
 * =============================================================================
 * DEPRECATED - LEGACY ANALYTICS ENDPOINT
 * =============================================================================
 * This endpoint has been permanently disabled.
 * Use /api/analytics/summary instead.
 * 
 * Deprecation reason: Queries non-existent homeowners table, provides 
 * inconsistent metrics outside canonical analytics contract.
 * =============================================================================
 */

import { createLegacyAnalyticsResponse } from '@/lib/legacy-analytics-deprecation';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return createLegacyAnalyticsResponse();
}
