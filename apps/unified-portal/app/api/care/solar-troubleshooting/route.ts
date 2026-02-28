/**
 * GET /api/care/solar-troubleshooting — Search solar troubleshooting KB
 *
 * Query params:
 * - errorCode: search by error code (e.g., "F32")
 * - symptom: search by symptom text (fuzzy match)
 * - homeownerFixable: filter to only homeowner-fixable issues
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  SOLAR_TROUBLESHOOTING,
  findByErrorCode,
  findBySymptom,
  getHomeownerFixable,
} from '@/lib/care/solarTroubleshooting';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const errorCode = searchParams.get('errorCode');
    const symptom = searchParams.get('symptom');
    const homeownerFixableOnly = searchParams.get('homeownerFixable') === 'true';

    let results = [...SOLAR_TROUBLESHOOTING];

    if (errorCode) {
      const entry = findByErrorCode(errorCode);
      results = entry ? [entry] : [];
    } else if (symptom) {
      results = findBySymptom(symptom);
    } else if (homeownerFixableOnly) {
      results = getHomeownerFixable();
    }

    return NextResponse.json({
      results,
      count: results.length,
    });
  } catch (error) {
    console.error('[Solar Troubleshooting API] error:', error);
    return NextResponse.json(
      { error: 'Failed to search troubleshooting KB' },
      { status: 500 }
    );
  }
}
