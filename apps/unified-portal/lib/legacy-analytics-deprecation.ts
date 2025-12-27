/*
 * =============================================================================
 * LEGACY ANALYTICS DEPRECATION UTILITY
 * =============================================================================
 * 
 * This file provides utilities for marking legacy analytics endpoints as 
 * deprecated. All analytics data MUST flow through /api/analytics/summary.
 *
 * DO NOT remove this file or modify the deprecation behavior.
 * =============================================================================
 */

import { NextResponse } from 'next/server';

export const LEGACY_DEPRECATION_ERROR = {
  error: 'Legacy analytics endpoint disabled',
  message: 'This endpoint has been deprecated. Use /api/analytics/summary instead.',
  migration_guide: 'All analytics data is now served from /api/analytics/summary with explicit time windows, tenant isolation, and error handling.',
  canonical_endpoint: '/api/analytics/summary',
  deprecated_at: '2025-01-XX',
};

export function createLegacyAnalyticsResponse(): NextResponse {
  console.error('[LEGACY ANALYTICS] Deprecated endpoint called. Caller must migrate to /api/analytics/summary');
  return NextResponse.json(LEGACY_DEPRECATION_ERROR, { status: 410 });
}

export function logLegacyAnalyticsUsage(endpoint: string, caller?: string): void {
  console.error(
    `[LEGACY ANALYTICS WARNING] Deprecated endpoint "${endpoint}" was called` +
    (caller ? ` by "${caller}"` : '') +
    `. This endpoint will be removed. Migrate to /api/analytics/summary.`
  );
}
