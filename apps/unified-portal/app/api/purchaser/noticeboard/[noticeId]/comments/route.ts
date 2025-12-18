import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { notice_comments, noticeboard_posts, notice_audit_log } from '@openhouse/db/schema';
import { eq, and, desc, gte, isNull, sql } from 'drizzle-orm';
import { validatePurchaserToken } from '@openhouse/api/qr-tokens';
import { getUnitInfo } from '@openhouse/api';

export const dynamic = 'force-dynamic';

const COMMENTS_PER_HOUR_LIMIT = 20;
const EDIT_WINDOW_MINUTES = 10;

async function checkCommentRateLimit(unitId: string, tenantId: string): Promise<{ allowed: boolean; remaining: number }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const recentComments = await db
    .select({ count: sql<number>`count(*)` })
    .from(notice_comments)
    .where(
      and(
        eq(notice_comments.tenant_id, tenantId),
        eq(notice_comments.unit_id, unitId),
        gte(notice_comments.created_at, oneHourAgo),
        eq(notice_comments.is_deleted, false),
        isNull(notice_comments.hidden_at)
      )
    );
  
  const count = Number(recentComments[0]?.count || 0);
  return {
    allowed: count < COMMENTS_PER_HOUR_LIMIT,
    remaining: Math.max(0, COMMENTS_PER_HOUR_LIMIT - count)
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ noticeId: string }> }
) {
  try {
    const { noticeId } = await params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');

    if (!token || !unitUid) {
      return NextResponse.json(
        { error: 'Token and unit UID are required' },
        { status: 400 }
      );
    }

    const tokenResult = await validatePurchaserToken(token, unitUid);
    if (!tokenResult.valid) {
      return NextResponse.json(
        { error: tokenResult.error || 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const unit = await getUnitInfo(unitUid);

    if (!unit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    const tenantId = unit.tenant_id;

    const notice = await db
      .select({ id: noticeboard_posts.id })
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

    const now = new Date();
    const comments = await db
      .select({
        id: notice_comments.id,
        author_name: notice_comments.author_name,
        author_unit: notice_comments.author_unit,
        body: notice_comments.body,
        created_at: notice_comments.created_at,
        updated_at: notice_comments.updated_at,
        unit_id: notice_comments.unit_id,
      })
      .from(notice_comments)
      .where(
        and(
          eq(notice_comments.notice_id, noticeId),
          eq(notice_comments.tenant_id, tenantId),
          eq(notice_comments.is_deleted, false),
          isNull(notice_comments.hidden_at)
        )
      )
      .orderBy(desc(notice_comments.created_at))
      .limit(100);

    const enrichedComments = comments.map((comment) => {
      const createdAt = new Date(comment.created_at);
      const editWindowEnd = new Date(createdAt.getTime() + EDIT_WINDOW_MINUTES * 60 * 1000);
      const canEdit = comment.unit_id === unitUid && now < editWindowEnd;
      const canDelete = comment.unit_id === unitUid;

      return {
        ...comment,
        is_own_comment: comment.unit_id === unitUid,
        can_edit: canEdit,
        can_delete: canDelete,
        edit_window_ends: editWindowEnd.toISOString(),
      };
    });

    return NextResponse.json({ comments: enrichedComments });
  } catch (error) {
    console.error('[Comments GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ noticeId: string }> }
) {
  console.log('[Comments POST] Request received');
  try {
    const { noticeId } = await params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');
    
    console.log('[Comments POST] noticeId:', noticeId, 'unitUid:', unitUid, 'token:', token ? 'present' : 'missing');

    if (!token || !unitUid) {
      console.log('[Comments POST] Missing token or unitUid');
      return NextResponse.json(
        { error: 'Token and unit UID are required' },
        { status: 400 }
      );
    }

    const tokenResult = await validatePurchaserToken(token, unitUid);
    console.log('[Comments POST] Token validation:', tokenResult.valid ? 'valid' : 'invalid', 'isShowhouse:', tokenResult.isShowhouse);
    
    if (!tokenResult.valid) {
      console.log('[Comments POST] Token validation failed');
      return NextResponse.json(
        { error: tokenResult.error || 'Invalid or expired token' },
        { status: 401 }
      );
    }
    
    console.log('[Comments POST] Token validated, unitId:', tokenResult.unitId);

    const unit = await getUnitInfo(unitUid);
    console.log('[Comments POST] Unit lookup:', unit ? 'found' : 'not found');

    if (!unit) {
      console.log('[Comments POST] Returning 404 - Unit not found');
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    const tenantId = unit.tenant_id;
    console.log('[Comments POST] Using tenantId from unit:', tenantId);

    const rateLimit = await checkCommentRateLimit(unitUid, tenantId);
    if (!rateLimit.allowed) {
      console.log('[Comments POST] Rate limit exceeded');
      return NextResponse.json(
        { error: 'You have reached the comment limit. Please try again later.' },
        { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
      );
    }

    console.log('[Comments POST] Looking for notice:', noticeId, 'with tenant:', tenantId);
    const notice = await db
      .select({ id: noticeboard_posts.id })
      .from(noticeboard_posts)
      .where(
        and(
          eq(noticeboard_posts.id, noticeId),
          eq(noticeboard_posts.tenant_id, tenantId)
        )
      )
      .limit(1);

    console.log('[Comments POST] Notice lookup result:', notice?.length || 0, 'notices found');

    if (!notice || notice.length === 0) {
      console.log('[Comments POST] Returning 404 - Notice not found');
      return NextResponse.json(
        { error: 'Notice not found' },
        { status: 404 }
      );
    }
    
    console.log('[Comments POST] All checks passed, proceeding to create comment');

    const body = await request.json();
    const { text, termsAccepted } = body;

    if (!termsAccepted) {
      return NextResponse.json(
        { error: 'You must accept the community guidelines to comment', requiresTerms: true },
        { status: 400 }
      );
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Comment text is required' },
        { status: 400 }
      );
    }

    if (text.length > 2000) {
      return NextResponse.json(
        { error: 'Comment must be 2000 characters or less' },
        { status: 400 }
      );
    }

    const unitAddress = unit.address || 'Unknown Unit';

    const [comment] = await db
      .insert(notice_comments)
      .values({
        notice_id: noticeId,
        tenant_id: tenantId,
        development_id: null,
        unit_id: unitUid,
        author_name: 'Resident',
        author_unit: unitAddress,
        body: text.trim(),
      })
      .returning();

    console.log('[Comments] Created comment:', comment.id, 'by unit:', unitUid);

    return NextResponse.json({
      success: true,
      comment: {
        id: comment.id,
        author_name: comment.author_name,
        author_unit: comment.author_unit,
        body: comment.body,
        created_at: comment.created_at,
        is_own_comment: true,
        can_edit: true,
        can_delete: true,
      },
      rate_limit: {
        remaining: rateLimit.remaining - 1,
        limit: COMMENTS_PER_HOUR_LIMIT,
      }
    });
  } catch (error) {
    console.error('[Comments POST Error]:', error);
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ noticeId: string }> }
) {
  try {
    const { noticeId } = await params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');
    const commentId = searchParams.get('commentId');

    if (!token || !unitUid || !commentId) {
      return NextResponse.json(
        { error: 'Token, unit UID, and comment ID are required' },
        { status: 400 }
      );
    }

    const tokenResult = await validatePurchaserToken(token, unitUid);
    if (!tokenResult.valid) {
      return NextResponse.json(
        { error: tokenResult.error || 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const unit = await getUnitInfo(unitUid);
    if (!unit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    const tenantId = unit.tenant_id;

    const existingComment = await db
      .select()
      .from(notice_comments)
      .where(
        and(
          eq(notice_comments.id, commentId),
          eq(notice_comments.notice_id, noticeId),
          eq(notice_comments.tenant_id, tenantId),
          eq(notice_comments.is_deleted, false)
        )
      )
      .limit(1);

    if (!existingComment || existingComment.length === 0) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    const comment = existingComment[0];

    if (comment.unit_id !== unitUid) {
      return NextResponse.json(
        { error: 'You can only edit your own comments' },
        { status: 403 }
      );
    }

    const now = new Date();
    const createdAt = new Date(comment.created_at);
    const editWindowEnd = new Date(createdAt.getTime() + EDIT_WINDOW_MINUTES * 60 * 1000);

    if (now >= editWindowEnd) {
      return NextResponse.json(
        { error: `Editing is only allowed within ${EDIT_WINDOW_MINUTES} minutes of posting` },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { text } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Comment text is required' },
        { status: 400 }
      );
    }

    if (text.length > 2000) {
      return NextResponse.json(
        { error: 'Comment must be 2000 characters or less' },
        { status: 400 }
      );
    }

    await db.insert(notice_audit_log).values({
      tenant_id: tenantId,
      notice_id: noticeId,
      comment_id: commentId,
      action: 'edit_comment',
      actor_type: 'resident',
      actor_id: unitUid,
      original_content: { body: comment.body },
    });

    await db
      .update(notice_comments)
      .set({
        body: text.trim(),
        updated_at: new Date(),
      })
      .where(eq(notice_comments.id, commentId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Comments PATCH Error]:', error);
    return NextResponse.json(
      { error: 'Failed to update comment' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ noticeId: string }> }
) {
  try {
    const { noticeId } = await params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');
    const commentId = searchParams.get('commentId');

    if (!token || !unitUid || !commentId) {
      return NextResponse.json(
        { error: 'Token, unit UID, and comment ID are required' },
        { status: 400 }
      );
    }

    const tokenResult = await validatePurchaserToken(token, unitUid);
    if (!tokenResult.valid) {
      return NextResponse.json(
        { error: tokenResult.error || 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const unit = await getUnitInfo(unitUid);
    if (!unit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    const tenantId = unit.tenant_id;

    const comment = await db
      .select({
        id: notice_comments.id,
        unit_id: notice_comments.unit_id,
        body: notice_comments.body,
        author_unit: notice_comments.author_unit,
      })
      .from(notice_comments)
      .where(
        and(
          eq(notice_comments.id, commentId),
          eq(notice_comments.notice_id, noticeId),
          eq(notice_comments.tenant_id, tenantId),
          eq(notice_comments.is_deleted, false)
        )
      )
      .limit(1);

    if (!comment || comment.length === 0) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    if (comment[0].unit_id !== unitUid) {
      return NextResponse.json(
        { error: 'You can only delete your own comments' },
        { status: 403 }
      );
    }

    await db.insert(notice_audit_log).values({
      tenant_id: tenantId,
      notice_id: noticeId,
      comment_id: commentId,
      action: 'delete_comment_by_author',
      actor_type: 'resident',
      actor_id: unitUid,
      original_content: { body: comment[0].body, author_unit: comment[0].author_unit },
    });

    await db
      .update(notice_comments)
      .set({
        is_deleted: true,
        updated_at: new Date(),
      })
      .where(eq(notice_comments.id, commentId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Comments DELETE Error]:', error);
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    );
  }
}
