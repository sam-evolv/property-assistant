export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminContextFromSession } from '@/lib/api-auth';
import { isVideosFeatureEnabled } from '@/lib/feature-flags';
import { parseVideoUrl } from '@/lib/video-parser';
import { db } from '@openhouse/db/client';
import { video_resources, developments } from '@openhouse/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    if (!isVideosFeatureEnabled()) {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 404 });
    }

    const adminContext = await getAdminContextFromSession();
    if (!adminContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get('developmentId');

    if (!developmentId) {
      return NextResponse.json({ error: 'developmentId is required' }, { status: 400 });
    }

    const videos = await db.query.video_resources.findMany({
      where: and(
        eq(video_resources.tenant_id, adminContext.tenantId),
        eq(video_resources.development_id, developmentId),
        eq(video_resources.is_active, true)
      ),
      orderBy: [desc(video_resources.sort_order), desc(video_resources.created_at)],
    });

    return NextResponse.json({ videos });
  } catch (error) {
    console.error('[VIDEOS API] Error fetching videos:', error);
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isVideosFeatureEnabled()) {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 404 });
    }

    const adminContext = await getAdminContextFromSession();
    if (!adminContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { developmentId, videoUrl, title, description } = body;

    if (!developmentId || !videoUrl || !title) {
      return NextResponse.json(
        { error: 'developmentId, videoUrl, and title are required' },
        { status: 400 }
      );
    }

    const parsed = parseVideoUrl(videoUrl);
    if (!parsed) {
      return NextResponse.json(
        { error: 'Invalid video URL. Only YouTube and Vimeo links are supported.' },
        { status: 400 }
      );
    }

    const development = await db.query.developments.findFirst({
      where: and(
        eq(developments.id, developmentId),
        eq(developments.tenant_id, adminContext.tenantId)
      ),
    });

    if (!development) {
      return NextResponse.json(
        { error: 'Development not found or access denied' },
        { status: 403 }
      );
    }

    const [video] = await db.insert(video_resources).values({
      tenant_id: adminContext.tenantId,
      development_id: developmentId,
      provider: parsed.provider,
      video_url: videoUrl,
      embed_url: parsed.embedUrl,
      video_id: parsed.videoId,
      title,
      description: description || null,
      thumbnail_url: parsed.thumbnailUrl,
      created_by: adminContext.id,
    }).returning();

    console.log(`[VIDEOS API] Created video: ${video.id} for development ${developmentId}`);

    return NextResponse.json({ video });
  } catch (error) {
    console.error('[VIDEOS API] Error creating video:', error);
    return NextResponse.json({ error: 'Failed to create video' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isVideosFeatureEnabled()) {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 404 });
    }

    const adminContext = await getAdminContextFromSession();
    if (!adminContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('id');

    if (!videoId) {
      return NextResponse.json({ error: 'Video id is required' }, { status: 400 });
    }

    const existing = await db.query.video_resources.findFirst({
      where: and(
        eq(video_resources.id, videoId),
        eq(video_resources.tenant_id, adminContext.tenantId)
      ),
    });

    if (!existing) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    await db.update(video_resources)
      .set({ is_active: false, updated_at: new Date() })
      .where(eq(video_resources.id, videoId));

    console.log(`[VIDEOS API] Deleted video: ${videoId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[VIDEOS API] Error deleting video:', error);
    return NextResponse.json({ error: 'Failed to delete video' }, { status: 500 });
  }
}
