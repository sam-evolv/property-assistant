import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { notice_reports, noticeboard_posts, notice_comments, notice_audit_log, admins } from '@openhouse/db/schema';
import { eq, and, desc, sql, isNull, or } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant ID found' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    const reports = await db
      .select({
        id: notice_reports.id,
        notice_id: notice_reports.notice_id,
        comment_id: notice_reports.comment_id,
        reason: notice_reports.reason,
        status: notice_reports.status,
        created_at: notice_reports.created_at,
        reviewed_at: notice_reports.reviewed_at,
        resolution_notes: notice_reports.resolution_notes,
      })
      .from(notice_reports)
      .where(
        and(
          eq(notice_reports.tenant_id, tenantId),
          status === 'all' ? undefined : eq(notice_reports.status, status)
        )
      )
      .orderBy(desc(notice_reports.created_at))
      .limit(100);

    const enrichedReports = await Promise.all(
      reports.map(async (report) => {
        let contentPreview = '';
        let authorUnit = '';
        let contentType = '';

        if (report.notice_id) {
          const notice = await db
            .select({
              title: noticeboard_posts.title,
              content: noticeboard_posts.content,
              author_unit: noticeboard_posts.author_unit,
              hidden_at: noticeboard_posts.hidden_at,
            })
            .from(noticeboard_posts)
            .where(eq(noticeboard_posts.id, report.notice_id))
            .limit(1);

          if (notice[0]) {
            contentPreview = `${notice[0].title}: ${notice[0].content.substring(0, 100)}...`;
            authorUnit = notice[0].author_unit || 'Unknown';
            contentType = notice[0].hidden_at ? 'notice (hidden)' : 'notice';
          }
        } else if (report.comment_id) {
          const comment = await db
            .select({
              body: notice_comments.body,
              author_unit: notice_comments.author_unit,
              hidden_at: notice_comments.hidden_at,
            })
            .from(notice_comments)
            .where(eq(notice_comments.id, report.comment_id))
            .limit(1);

          if (comment[0]) {
            contentPreview = comment[0].body.substring(0, 150) + '...';
            authorUnit = comment[0].author_unit || 'Unknown';
            contentType = comment[0].hidden_at ? 'comment (hidden)' : 'comment';
          }
        }

        return {
          ...report,
          content_preview: contentPreview,
          author_unit: authorUnit,
          content_type: contentType,
        };
      })
    );

    const stats = await db
      .select({
        status: notice_reports.status,
        count: sql<number>`count(*)`,
      })
      .from(notice_reports)
      .where(eq(notice_reports.tenant_id, tenantId))
      .groupBy(notice_reports.status);

    return NextResponse.json({
      reports: enrichedReports,
      stats: stats.reduce((acc, s) => ({ ...acc, [s.status]: Number(s.count) }), {}),
    });
  } catch (error) {
    console.error('[Moderation GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'super_admin']);
    const tenantId = session.tenantId;
    const adminId = session.id;

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant ID found' }, { status: 400 });
    }

    const body = await request.json();
    const { reportId, action, resolutionNotes } = body;

    if (!reportId || !action) {
      return NextResponse.json(
        { error: 'Report ID and action are required' },
        { status: 400 }
      );
    }

    const report = await db
      .select()
      .from(notice_reports)
      .where(
        and(
          eq(notice_reports.id, reportId),
          eq(notice_reports.tenant_id, tenantId)
        )
      )
      .limit(1);

    if (!report || report.length === 0) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    const reportData = report[0];

    if (action === 'hide') {
      if (reportData.notice_id) {
        const notice = await db
          .select()
          .from(noticeboard_posts)
          .where(eq(noticeboard_posts.id, reportData.notice_id))
          .limit(1);

        if (notice[0]) {
          await db.insert(notice_audit_log).values({
            tenant_id: tenantId,
            notice_id: reportData.notice_id,
            action: 'hide_by_admin',
            actor_type: 'admin',
            actor_id: adminId,
            original_content: { title: notice[0].title, content: notice[0].content },
            reason: resolutionNotes || 'Reported content hidden by administrator',
          });

          await db
            .update(noticeboard_posts)
            .set({
              hidden_at: new Date(),
              hidden_by: adminId,
              hidden_reason: resolutionNotes || 'Content hidden following community report',
            })
            .where(eq(noticeboard_posts.id, reportData.notice_id));
        }
      } else if (reportData.comment_id) {
        const comment = await db
          .select()
          .from(notice_comments)
          .where(eq(notice_comments.id, reportData.comment_id))
          .limit(1);

        if (comment[0]) {
          await db.insert(notice_audit_log).values({
            tenant_id: tenantId,
            comment_id: reportData.comment_id,
            action: 'hide_comment_by_admin',
            actor_type: 'admin',
            actor_id: adminId,
            original_content: { body: comment[0].body },
            reason: resolutionNotes || 'Reported comment hidden by administrator',
          });

          await db
            .update(notice_comments)
            .set({
              hidden_at: new Date(),
              hidden_by: adminId,
              hidden_reason: resolutionNotes || 'Comment hidden following community report',
            })
            .where(eq(notice_comments.id, reportData.comment_id));
        }
      }

      await db
        .update(notice_reports)
        .set({
          status: 'resolved',
          reviewed_by: adminId,
          reviewed_at: new Date(),
          resolution_notes: resolutionNotes || 'Content hidden',
        })
        .where(eq(notice_reports.id, reportId));

    } else if (action === 'dismiss') {
      await db
        .update(notice_reports)
        .set({
          status: 'dismissed',
          reviewed_by: adminId,
          reviewed_at: new Date(),
          resolution_notes: resolutionNotes || 'Report dismissed - no action required',
        })
        .where(eq(notice_reports.id, reportId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Moderation PATCH Error]:', error);
    return NextResponse.json(
      { error: 'Failed to process report' },
      { status: 500 }
    );
  }
}
