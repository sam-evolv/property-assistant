import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { notice_comments, units, noticeboard_posts } from '@openhouse/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { validateQRToken } from '@openhouse/api/qr-tokens';

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

    const payload = await validateQRToken(token);
    if (!payload || payload.supabaseUnitId !== unitUid) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const unit = await db
      .select({
        tenant_id: units.tenant_id,
        development_id: units.development_id,
      })
      .from(units)
      .where(eq(units.unit_uid, unitUid))
      .limit(1);

    if (!unit || unit.length === 0) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    const { tenant_id, development_id } = unit[0];

    if (!development_id) {
      return NextResponse.json(
        { error: 'Unit is not associated with a development' },
        { status: 400 }
      );
    }

    const notice = await db
      .select({ id: noticeboard_posts.id })
      .from(noticeboard_posts)
      .where(
        and(
          eq(noticeboard_posts.id, noticeId),
          eq(noticeboard_posts.tenant_id, tenant_id)
        )
      )
      .limit(1);

    if (!notice || notice.length === 0) {
      return NextResponse.json(
        { error: 'Notice not found' },
        { status: 404 }
      );
    }

    const comments = await db
      .select({
        id: notice_comments.id,
        author_name: notice_comments.author_name,
        body: notice_comments.body,
        created_at: notice_comments.created_at,
        unit_id: notice_comments.unit_id,
      })
      .from(notice_comments)
      .where(
        and(
          eq(notice_comments.notice_id, noticeId),
          eq(notice_comments.tenant_id, tenant_id),
          eq(notice_comments.is_deleted, false),
          eq(notice_comments.development_id, development_id)
        )
      )
      .orderBy(desc(notice_comments.created_at))
      .limit(100);

    return NextResponse.json({ comments });
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

    const payload = await validateQRToken(token);
    if (!payload || payload.supabaseUnitId !== unitUid) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const unit = await db
      .select({
        id: units.id,
        tenant_id: units.tenant_id,
        development_id: units.development_id,
        unit_number: units.unit_number,
      })
      .from(units)
      .where(eq(units.unit_uid, unitUid))
      .limit(1);

    if (!unit || unit.length === 0) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    const { id: unit_id, tenant_id, development_id, unit_number } = unit[0];

    if (!development_id) {
      return NextResponse.json(
        { error: 'Unit is not associated with a development' },
        { status: 400 }
      );
    }

    const notice = await db
      .select({ id: noticeboard_posts.id })
      .from(noticeboard_posts)
      .where(
        and(
          eq(noticeboard_posts.id, noticeId),
          eq(noticeboard_posts.tenant_id, tenant_id)
        )
      )
      .limit(1);

    if (!notice || notice.length === 0) {
      return NextResponse.json(
        { error: 'Notice not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { text, authorName } = body;

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

    const displayName = authorName?.trim() || `Unit ${unit_number}` || 'Anonymous';

    const [comment] = await db
      .insert(notice_comments)
      .values({
        notice_id: noticeId,
        tenant_id,
        development_id,
        unit_id,
        author_name: displayName,
        body: text.trim(),
      })
      .returning();

    return NextResponse.json({
      success: true,
      comment: {
        id: comment.id,
        author_name: comment.author_name,
        body: comment.body,
        created_at: comment.created_at,
      },
    });
  } catch (error) {
    console.error('[Comments POST Error]:', error);
    return NextResponse.json(
      { error: 'Failed to create comment' },
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

    const payload = await validateQRToken(token);
    if (!payload || payload.supabaseUnitId !== unitUid) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const unit = await db
      .select({
        id: units.id,
        tenant_id: units.tenant_id,
        development_id: units.development_id,
      })
      .from(units)
      .where(eq(units.unit_uid, unitUid))
      .limit(1);

    if (!unit || unit.length === 0) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    const { id: unit_id, tenant_id, development_id } = unit[0];

    if (!development_id) {
      return NextResponse.json(
        { error: 'Unit is not associated with a development' },
        { status: 400 }
      );
    }

    const comment = await db
      .select({
        id: notice_comments.id,
        unit_id: notice_comments.unit_id,
      })
      .from(notice_comments)
      .where(
        and(
          eq(notice_comments.id, commentId),
          eq(notice_comments.notice_id, noticeId),
          eq(notice_comments.tenant_id, tenant_id),
          eq(notice_comments.development_id, development_id),
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

    if (comment[0].unit_id !== unit_id) {
      return NextResponse.json(
        { error: 'You can only delete your own comments' },
        { status: 403 }
      );
    }

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
