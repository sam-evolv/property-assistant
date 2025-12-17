export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { notice_comments, noticeboard_posts, units, developments } from '@openhouse/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: noticeId } = await params;
    const session = await requireRole(['developer', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant ID found' }, { status: 400 });
    }

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
      return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
    }

    const comments = await db
      .select({
        id: notice_comments.id,
        author_name: notice_comments.author_name,
        body: notice_comments.body,
        is_deleted: notice_comments.is_deleted,
        created_at: notice_comments.created_at,
        unit_id: notice_comments.unit_id,
        development_id: notice_comments.development_id,
      })
      .from(notice_comments)
      .where(
        and(
          eq(notice_comments.notice_id, noticeId),
          eq(notice_comments.tenant_id, tenantId)
        )
      )
      .orderBy(desc(notice_comments.created_at))
      .limit(200);

    return NextResponse.json({ comments });
  } catch (error) {
    console.error('[Developer Comments GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: noticeId } = await params;
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('commentId');

    if (!commentId) {
      return NextResponse.json({ error: 'Comment ID required' }, { status: 400 });
    }

    const session = await requireRole(['developer', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant ID found' }, { status: 400 });
    }

    const comment = await db
      .select({ id: notice_comments.id })
      .from(notice_comments)
      .where(
        and(
          eq(notice_comments.id, commentId),
          eq(notice_comments.notice_id, noticeId),
          eq(notice_comments.tenant_id, tenantId)
        )
      )
      .limit(1);

    if (!comment || comment.length === 0) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
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
    console.error('[Developer Comments DELETE Error]:', error);
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    );
  }
}
