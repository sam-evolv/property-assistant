import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { noticeboard_posts, notice_comments, notice_audit_log } from '@openhouse/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'super_admin']);
    const tenantId = session.tenantId;
    const adminId = session.id;

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant ID found' }, { status: 400 });
    }

    const body = await request.json();
    const { noticeId, commentId, reason } = body;

    if (!noticeId && !commentId) {
      return NextResponse.json(
        { error: 'Notice ID or comment ID is required' },
        { status: 400 }
      );
    }

    if (noticeId) {
      const notice = await db
        .select()
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

      await db.insert(notice_audit_log).values({
        tenant_id: tenantId,
        notice_id: noticeId,
        action: 'takedown_by_admin',
        actor_type: 'admin',
        actor_id: adminId,
        original_content: {
          title: notice[0].title,
          content: notice[0].content,
          author_unit: notice[0].author_unit,
        },
        reason: reason || 'Content removed by administrator',
      });

      await db
        .update(noticeboard_posts)
        .set({
          hidden_at: new Date(),
          hidden_by: adminId,
          hidden_reason: reason || 'Content removed by administrator',
          updated_at: new Date(),
        })
        .where(eq(noticeboard_posts.id, noticeId));

      console.log('[Takedown] Admin hid notice:', noticeId);
    }

    if (commentId) {
      const comment = await db
        .select()
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

      await db.insert(notice_audit_log).values({
        tenant_id: tenantId,
        comment_id: commentId,
        action: 'takedown_comment_by_admin',
        actor_type: 'admin',
        actor_id: adminId,
        original_content: {
          body: comment[0].body,
          author_unit: comment[0].author_unit,
        },
        reason: reason || 'Comment removed by administrator',
      });

      await db
        .update(notice_comments)
        .set({
          hidden_at: new Date(),
          hidden_by: adminId,
          hidden_reason: reason || 'Comment removed by administrator',
          updated_at: new Date(),
        })
        .where(eq(notice_comments.id, commentId));

      console.log('[Takedown] Admin hid comment:', commentId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Takedown POST Error]:', error);
    return NextResponse.json(
      { error: 'Failed to take down content' },
      { status: 500 }
    );
  }
}
