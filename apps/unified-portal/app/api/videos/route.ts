export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminContextFromSession } from '@/lib/api-auth';
import { isVideosFeatureEnabled } from '@/lib/feature-flags';
import { parseVideoUrl } from '@/lib/video-parser';
import { db } from '@openhouse/db/client';
import { video_resources, developments } from '@openhouse/db/schema';
import { eq, and, desc } from 'drizzle-orm';

async function validateDevelopmentExists(developmentId: string, tenantId: string): Promise<boolean> {
  const dev = await db.query.developments.findFirst({
    where: and(
      eq(developments.id, developmentId),
      eq(developments.tenant_id, tenantId)
    ),
    columns: { id: true },
  });

  return !!dev;
}

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
    const fetchAll = searchParams.get('all') === 'true';

    if (!developmentId && !fetchAll) {
      return NextResponse.json({ error: 'developmentId is required' }, { status: 400 });
    }

    const conditions = [
      eq(video_resources.tenant_id, adminContext.tenantId),
      eq(video_resources.is_active, true),
    ];

    if (developmentId) {
      conditions.push(eq(video_resources.development_id, developmentId));
    }

    const videos = await db.query.video_resources.findMany({
      where: and(...conditions),
      orderBy: [desc(video_resources.sort_order), desc(video_resources.created_at)],
    });

    return NextResponse.json({ videos });
  } catch (error: any) {
    const isDev = process.env.NODE_ENV !== 'production';
    console.error('[VIDEOS API] Error fetching videos:', error);
    return NextResponse.json({
      error: 'Failed to fetch videos',
      where: 'GET /api/videos',
      ...(isDev && { message: error?.message, cause: error?.cause?.message }),
    }, { status: 500 });
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
    const { developmentId, developmentIds, videoUrl, title, description } = body;

    const targetIds: string[] = developmentIds && Array.isArray(developmentIds) && developmentIds.length > 0
      ? developmentIds
      : developmentId ? [developmentId] : [];

    if (targetIds.length === 0 || !videoUrl || !title) {
      return NextResponse.json(
        { error: 'developmentId (or developmentIds), videoUrl, and title are required' },
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

    const validationResults = await Promise.all(
      targetIds.map(id => validateDevelopmentExists(id, adminContext.tenantId))
    );

    const invalidIds = targetIds.filter((_, i) => !validationResults[i]);
    if (invalidIds.length > 0) {
      console.log('[VIDEOS API] Developments not found:', invalidIds);
      return NextResponse.json(
        { error: `Development(s) not found or access denied` },
        { status: 403 }
      );
    }

    const videoValues = targetIds.map(devId => ({
      tenant_id: adminContext.tenantId,
      development_id: devId,
      provider: parsed.provider,
      video_url: videoUrl,
      embed_url: parsed.embedUrl,
      video_id: parsed.videoId,
      title,
      description: description || null,
      thumbnail_url: parsed.thumbnailUrl,
      created_by: adminContext.id,
    }));

    const createdVideos = await db.insert(video_resources).values(videoValues).returning();

    console.log(`[VIDEOS API] Created ${createdVideos.length} video(s) across ${targetIds.length} development(s)`);

    return NextResponse.json({
      video: createdVideos[0],
      videos: createdVideos,
      count: createdVideos.length,
    });
  } catch (error: any) {
    const isDev = process.env.NODE_ENV !== 'production';
    console.error('[VIDEOS API] Error creating video:', error);
    return NextResponse.json({
      error: 'Failed to create video',
      where: 'POST /api/videos',
      ...(isDev && { message: error?.message, cause: error?.cause?.message }),
    }, { status: 500 });
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
  } catch (error: any) {
    const isDev = process.env.NODE_ENV !== 'production';
    console.error('[VIDEOS API] Error deleting video:', error);
    return NextResponse.json({
      error: 'Failed to delete video',
      where: 'DELETE /api/videos',
      ...(isDev && { message: error?.message, cause: error?.cause?.message }),
    }, { status: 500 });
  }
}
