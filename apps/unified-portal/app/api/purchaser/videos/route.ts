export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { validateQRToken } from '@openhouse/api/qr-tokens';
import { logSecurityViolation } from '@/lib/api-auth';
import { db } from '@openhouse/db/client';
import { video_resources } from '@openhouse/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
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
          'x-request-id': `videos-${Date.now()}`
        }
      }
    }
  );
}

export async function GET(request: NextRequest) {
  const requestId = nanoid(12);

  try {
    if (!isPurchaserVideosEnabled()) {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 404 });
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
          console.log(`[PurchaserVideosAPI] QR token validated for unit ${unitUid}`);
        } else {
          logSecurityViolation({
            request_id: requestId,
            unit_uid: unitUid,
            attempted_resource: `token_unit:${payload.supabaseUnitId}`,
            reason: 'Token unit mismatch in purchaser-videos - cross-unit access blocked',
          });
        }
      }

      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!isAuthenticated && uuidPattern.test(token) && token === unitUid) {
        isAuthenticated = true;
        console.log(`[PurchaserVideosAPI] Demo/direct access for unit ${unitUid}`);
      }
    }

    if (!isAuthenticated) {
      logSecurityViolation({
        request_id: requestId,
        unit_uid: unitUid,
        reason: 'Invalid or expired token in purchaser-videos request',
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
      console.error('[PurchaserVideosAPI] Unit not found:', unitUid, unitError?.message);
      return NextResponse.json({ videos: [], requestId });
    }

    const supabaseProjectId = supabaseUnit.project_id;

    if (!supabaseProjectId) {
      console.warn('[PurchaserVideosAPI] Unit has no project_id:', unitUid);
      return NextResponse.json({ videos: [], requestId });
    }

    // Videos are stored with development_id = Supabase project_id
    // Query videos directly by the project_id (no need to look up Drizzle developments)
    const videos = await db.query.video_resources.findMany({
      where: and(
        eq(video_resources.development_id, supabaseProjectId),
        eq(video_resources.is_active, true)
      ),
      orderBy: [desc(video_resources.sort_order), desc(video_resources.created_at)],
    });

    console.log(`[PurchaserVideosAPI] Found ${videos.length} videos for unit ${unitUid}, project ${supabaseProjectId}`);

    const safeVideos = videos.map(v => ({
      id: v.id,
      title: v.title,
      description: v.description,
      provider: v.provider,
      embed_url: v.embed_url,
      thumbnail_url: v.thumbnail_url,
    }));

    return NextResponse.json({ videos: safeVideos, requestId });
  } catch (error) {
    console.error('[PurchaserVideosAPI] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch videos', requestId }, { status: 500 });
  }
}
