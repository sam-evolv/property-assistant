export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { validateQRToken } from '@openhouse/api/qr-tokens';
import { logSecurityViolation } from '@/lib/api-auth';
import { db } from '@openhouse/db/client';
import { video_resources } from '@openhouse/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

function isPurchaserVideosEnabled(): boolean {
  return process.env.FEATURE_VIDEOS_PURCHASER === 'true' || process.env.FEATURE_VIDEOS === 'true';
}

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: 'public' },
      global: {
        headers: {
          'Cache-Control': 'no-cache',
          'x-request-id': `videos-count-${Date.now()}`
        }
      }
    }
  );
}

export async function GET(request: NextRequest) {
  const requestId = nanoid(12);

  try {
    if (!isPurchaserVideosEnabled()) {
      return NextResponse.json(
        { hasVideos: false, count: 0, requestId },
        { 
          status: 200,
          headers: { 'Cache-Control': 'private, max-age=60' }
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');

    if (!unitUid) {
      return NextResponse.json(
        { error: 'Unit UID is required', requestId },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    let isAuthenticated = false;

    if (token) {
      const payload = await validateQRToken(token);
      if (payload) {
        if (payload.supabaseUnitId === unitUid) {
          isAuthenticated = true;
        } else {
          logSecurityViolation({
            request_id: requestId,
            unit_uid: unitUid,
            attempted_resource: `token_unit:${payload.supabaseUnitId}`,
            reason: 'Token unit mismatch in purchaser-videos-count - cross-unit access blocked',
          });
        }
      }

      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!isAuthenticated && uuidPattern.test(token) && token === unitUid) {
        isAuthenticated = true;
      }
    }

    if (!isAuthenticated) {
      logSecurityViolation({
        request_id: requestId,
        unit_uid: unitUid,
        reason: 'Invalid or expired token in purchaser-videos-count request',
      });
      return NextResponse.json(
        { error: 'Invalid or expired token', requestId, error_code: 'AUTH_FAILED' },
        { status: 401 }
      );
    }

    const { data: supabaseUnit, error: unitError } = await supabase
      .from('units')
      .select('id, project_id')
      .eq('id', unitUid)
      .single();

    if (unitError || !supabaseUnit) {
      return NextResponse.json(
        { hasVideos: false, count: 0, requestId },
        { 
          status: 200,
          headers: { 'Cache-Control': 'private, max-age=60' }
        }
      );
    }

    const supabaseProjectId = supabaseUnit.project_id;

    if (!supabaseProjectId) {
      return NextResponse.json(
        { hasVideos: false, count: 0, requestId },
        { 
          status: 200,
          headers: { 'Cache-Control': 'private, max-age=60' }
        }
      );
    }

    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(video_resources)
      .where(
        and(
          eq(video_resources.development_id, supabaseProjectId),
          eq(video_resources.is_active, true)
        )
      );

    const count = result[0]?.count ?? 0;

    return NextResponse.json(
      { hasVideos: count > 0, count, requestId },
      { 
        status: 200,
        headers: { 'Cache-Control': 'private, max-age=60' }
      }
    );
  } catch (error) {
    console.error('[PurchaserVideosCountAPI] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video count', requestId },
      { status: 500 }
    );
  }
}
