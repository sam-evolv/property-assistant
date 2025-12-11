import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db/client';
import { notice_reports, noticeboard_posts, notice_comments, tenants } from '@openhouse/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { validateQRToken } from '@openhouse/api/qr-tokens';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REPORTS_PER_HOUR_LIMIT = 10;

async function checkReportRateLimit(unitId: string, tenantId: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const recentReports = await db
    .select({ count: sql<number>`count(*)` })
    .from(notice_reports)
    .where(
      and(
        eq(notice_reports.tenant_id, tenantId),
        eq(notice_reports.reporter_unit_id, unitId),
        gte(notice_reports.created_at, oneHourAgo)
      )
    );
  
  return Number(recentReports[0]?.count || 0) < REPORTS_PER_HOUR_LIMIT;
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');

    if (!token || !unitUid) {
      return NextResponse.json(
        { error: 'Token and unit UID are required' },
        { status: 400 }
      );
    }

    const payload = await validateQRToken(token);
    if (!payload || payload.supabaseUnitId !== unitUid) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select('id')
      .eq('id', unitUid)
      .single();

    if (unitError || !unit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    const tenantResult = await db
      .select({ id: tenants.id })
      .from(tenants)
      .limit(1);

    if (!tenantResult || tenantResult.length === 0) {
      return NextResponse.json(
        { error: 'No tenant configured' },
        { status: 500 }
      );
    }

    const tenantId = tenantResult[0].id;

    const allowed = await checkReportRateLimit(unitUid, tenantId);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many reports. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { noticeId, commentId, reason } = body;

    if (!noticeId && !commentId) {
      return NextResponse.json(
        { error: 'Notice ID or comment ID is required' },
        { status: 400 }
      );
    }

    if (!reason || reason.trim().length < 10) {
      return NextResponse.json(
        { error: 'Please provide a reason (at least 10 characters)' },
        { status: 400 }
      );
    }

    if (reason.length > 1000) {
      return NextResponse.json(
        { error: 'Reason must be 1000 characters or less' },
        { status: 400 }
      );
    }

    if (noticeId) {
      const notice = await db
        .select({ id: noticeboard_posts.id, unit_id: noticeboard_posts.unit_id })
        .from(noticeboard_posts)
        .where(
          and(
            eq(noticeboard_posts.id, noticeId),
            eq(noticeboard_posts.tenant_id, tenantId)
          )
        )
        .limit(1);

      if (!notice || notice.length === 0) {
        return NextResponse.json(
          { error: 'Notice not found' },
          { status: 404 }
        );
      }

      if (notice[0].unit_id === unitUid) {
        return NextResponse.json(
          { error: 'You cannot report your own post' },
          { status: 400 }
        );
      }
    }

    if (commentId) {
      const comment = await db
        .select({ id: notice_comments.id, unit_id: notice_comments.unit_id })
        .from(notice_comments)
        .where(
          and(
            eq(notice_comments.id, commentId),
            eq(notice_comments.tenant_id, tenantId)
          )
        )
        .limit(1);

      if (!comment || comment.length === 0) {
        return NextResponse.json(
          { error: 'Comment not found' },
          { status: 404 }
        );
      }

      if (comment[0].unit_id === unitUid) {
        return NextResponse.json(
          { error: 'You cannot report your own comment' },
          { status: 400 }
        );
      }
    }

    await db.insert(notice_reports).values({
      tenant_id: tenantId,
      notice_id: noticeId || null,
      comment_id: commentId || null,
      reporter_unit_id: unitUid,
      reason: reason.trim(),
      status: 'pending',
    });

    console.log('[Report] Created report for', noticeId ? `notice ${noticeId}` : `comment ${commentId}`);

    return NextResponse.json({
      success: true,
      message: 'Thank you for your report. Our team will review it shortly.',
    });
  } catch (error) {
    console.error('[Report POST Error]:', error);
    return NextResponse.json(
      { error: 'Failed to submit report' },
      { status: 500 }
    );
  }
}
