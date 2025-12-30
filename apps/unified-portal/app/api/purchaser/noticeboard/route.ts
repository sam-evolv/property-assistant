import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { noticeboard_posts, notice_audit_log } from '@openhouse/db/schema';
import { eq, desc, and, lte, gte, or, isNull, sql } from 'drizzle-orm';
import { validatePurchaserToken } from '@openhouse/api/qr-tokens';
import { getUnitInfo, logError } from '@openhouse/api';

export const dynamic = 'force-dynamic';

const POSTS_PER_HOUR_LIMIT = 5;
const EDIT_WINDOW_MINUTES = 10;

async function checkRateLimit(unitId: string, tenantId: string): Promise<{ allowed: boolean; remaining: number }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const recentPosts = await db
    .select({ count: sql<number>`count(*)` })
    .from(noticeboard_posts)
    .where(
      and(
        eq(noticeboard_posts.tenant_id, tenantId),
        eq(noticeboard_posts.unit_id, unitId),
        gte(noticeboard_posts.created_at, oneHourAgo),
        eq(noticeboard_posts.active, true),
        isNull(noticeboard_posts.hidden_at)
      )
    );
  
  const count = Number(recentPosts[0]?.count || 0);
  return {
    allowed: count < POSTS_PER_HOUR_LIMIT,
    remaining: Math.max(0, POSTS_PER_HOUR_LIMIT - count)
  };
}

export async function GET(request: NextRequest) {
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

    const tokenResult = await validatePurchaserToken(token, unitUid);
    if (!tokenResult.valid) {
      return NextResponse.json(
        { error: tokenResult.error || 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const unit = await getUnitInfo(unitUid);

    if (!unit) {
      console.error('[Noticeboard] Unit not found in any database:', unitUid);
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    if (!unit.tenant_id) {
      console.error('[Noticeboard] Unit has no tenant association:', unitUid);
      return NextResponse.json(
        { error: 'Unit not linked to a tenant' },
        { status: 400 }
      );
    }

    const tenantId: string = unit.tenant_id;
    const now = new Date();
    
    console.log('[Noticeboard GET] Fetching posts for tenant:', tenantId, 'unit:', unitUid);

    const posts = await db
      .select({
        id: noticeboard_posts.id,
        title: noticeboard_posts.title,
        content: noticeboard_posts.content,
        priority: noticeboard_posts.priority,
        created_at: noticeboard_posts.created_at,
        updated_at: noticeboard_posts.updated_at,
        author_name: noticeboard_posts.author_name,
        author_unit: noticeboard_posts.author_unit,
        unit_id: noticeboard_posts.unit_id,
      })
      .from(noticeboard_posts)
      .where(
        and(
          eq(noticeboard_posts.tenant_id, tenantId),
          eq(noticeboard_posts.active, true),
          isNull(noticeboard_posts.hidden_at),
          or(
            isNull(noticeboard_posts.start_date),
            lte(noticeboard_posts.start_date, now)
          ),
          or(
            isNull(noticeboard_posts.end_date),
            gte(noticeboard_posts.end_date, now)
          )
        )
      )
      .orderBy(desc(noticeboard_posts.priority), desc(noticeboard_posts.created_at))
      .limit(50);

    console.log('[Noticeboard GET] Found', posts.length, 'posts');
    
    const notices = posts.map((post) => {
      const createdAt = new Date(post.created_at);
      const editWindowEnd = new Date(createdAt.getTime() + EDIT_WINDOW_MINUTES * 60 * 1000);
      const canEdit = post.unit_id === unitUid && now < editWindowEnd;
      const canDelete = post.unit_id === unitUid;
      
      return {
        id: post.id,
        title: post.title,
        message: post.content,
        created_at: post.created_at,
        updated_at: post.updated_at,
        priority: (post.priority ?? 0) >= 3 ? 'high' : (post.priority ?? 0) >= 2 ? 'medium' : 'low',
        category: 'general',
        author_name: post.author_name,
        author_unit: post.author_unit,
        is_own_post: post.unit_id === unitUid,
        can_edit: canEdit,
        can_delete: canDelete,
        edit_window_ends: editWindowEnd.toISOString(),
      };
    });

    return NextResponse.json({ notices });
  } catch (error) {
    const err = error as Error;
    console.error('[Purchaser Noticeboard GET Error]:', err);
    void logError({
      errorType: 'purchaser',
      errorCode: 'NOTICEBOARD_GET_FAILED',
      errorMessage: err.message || 'Failed to fetch notices',
      stackTrace: err.stack,
      endpoint: '/api/purchaser/noticeboard',
      requestContext: { method: 'GET' },
    });
    return NextResponse.json(
      { error: 'Failed to fetch notices' },
      { status: 500 }
    );
  }
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

    const tokenResult = await validatePurchaserToken(token, unitUid);
    if (!tokenResult.valid) {
      return NextResponse.json(
        { error: tokenResult.error || 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const unit = await getUnitInfo(unitUid);

    if (!unit) {
      console.error('[Noticeboard POST] Unit not found in any database:', unitUid);
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    if (!unit.tenant_id) {
      console.error('[Noticeboard POST] Unit has no tenant association:', unitUid);
      return NextResponse.json(
        { error: 'Unit not linked to a tenant' },
        { status: 400 }
      );
    }

    const tenantId: string = unit.tenant_id;
    const developmentId = unit.development_id;
    const unitAddress = unit.address;
    
    const rateLimit = await checkRateLimit(unitUid, tenantId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'You have reached the posting limit. Please try again later.' },
        { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
      );
    }

    const body = await request.json();
    const { title, message, category, priority, termsAccepted } = body;

    if (!termsAccepted) {
      return NextResponse.json(
        { error: 'You must accept the community guidelines to post', requiresTerms: true },
        { status: 400 }
      );
    }

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Title and message are required' },
        { status: 400 }
      );
    }

    if (title.length > 200) {
      return NextResponse.json(
        { error: 'Title must be 200 characters or less' },
        { status: 400 }
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { error: 'Message must be 5000 characters or less' },
        { status: 400 }
      );
    }

    let priorityValue = 0;
    if (priority === 'high') priorityValue = 3;
    else if (priority === 'medium') priorityValue = 2;
    else if (priority === 'low') priorityValue = 1;

    const [post] = await db
      .insert(noticeboard_posts)
      .values({
        tenant_id: tenantId,
        development_id: developmentId,
        unit_id: unitUid,
        title: title.trim(),
        content: message.trim(),
        priority: priorityValue,
        active: true,
        author_name: 'Resident',
        author_unit: unitAddress,
      })
      .returning();

    console.log('[Noticeboard] Created post:', post.id, 'by unit:', unitUid);

    return NextResponse.json({
      success: true,
      post: {
        id: post.id,
        title: post.title,
        message: post.content,
        created_at: post.created_at,
        priority: priority || 'low',
        category: category || 'general',
        author_unit: unitAddress,
        can_edit: true,
        can_delete: true,
      },
      rate_limit: {
        remaining: rateLimit.remaining - 1,
        limit: POSTS_PER_HOUR_LIMIT,
      }
    });
  } catch (error) {
    const err = error as Error;
    console.error('[Purchaser Noticeboard POST Error]:', err);
    void logError({
      errorType: 'purchaser',
      errorCode: 'NOTICEBOARD_POST_FAILED',
      errorMessage: err.message || 'Failed to create notice',
      stackTrace: err.stack,
      endpoint: '/api/purchaser/noticeboard',
      requestContext: { method: 'POST' },
    });
    return NextResponse.json(
      { error: 'Failed to create notice' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');
    const noticeId = searchParams.get('noticeId');

    if (!token || !unitUid || !noticeId) {
      return NextResponse.json(
        { error: 'Token, unit UID, and notice ID are required' },
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

    if (!unit.tenant_id) {
      return NextResponse.json(
        { error: 'Unit not linked to a tenant' },
        { status: 400 }
      );
    }

    const tenantId: string = unit.tenant_id;

    const existingPost = await db
      .select()
      .from(noticeboard_posts)
      .where(
        and(
          eq(noticeboard_posts.id, noticeId),
          eq(noticeboard_posts.tenant_id, tenantId)
        )
      )
      .limit(1);

    if (!existingPost || existingPost.length === 0) {
      return NextResponse.json(
        { error: 'Notice not found' },
        { status: 404 }
      );
    }

    const post = existingPost[0];

    if (post.unit_id !== unitUid) {
      return NextResponse.json(
        { error: 'You can only edit your own posts' },
        { status: 403 }
      );
    }

    const now = new Date();
    const createdAt = new Date(post.created_at);
    const editWindowEnd = new Date(createdAt.getTime() + EDIT_WINDOW_MINUTES * 60 * 1000);

    if (now >= editWindowEnd) {
      return NextResponse.json(
        { error: `Editing is only allowed within ${EDIT_WINDOW_MINUTES} minutes of posting` },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, message } = body;

    if (!title && !message) {
      return NextResponse.json(
        { error: 'At least title or message must be provided' },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = { updated_at: new Date() };
    if (title) updates.title = title.trim().substring(0, 200);
    if (message) updates.content = message.trim().substring(0, 5000);

    await db
      .update(noticeboard_posts)
      .set(updates)
      .where(eq(noticeboard_posts.id, noticeId));

    await db.insert(notice_audit_log).values({
      tenant_id: tenantId,
      notice_id: noticeId,
      action: 'edit',
      actor_type: 'resident',
      actor_id: unitUid,
      original_content: { title: post.title, content: post.content },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const err = error as Error;
    console.error('[Purchaser Noticeboard PATCH Error]:', err);
    void logError({
      errorType: 'purchaser',
      errorCode: 'NOTICEBOARD_PATCH_FAILED',
      errorMessage: err.message || 'Failed to update notice',
      stackTrace: err.stack,
      endpoint: '/api/purchaser/noticeboard',
      requestContext: { method: 'PATCH' },
    });
    return NextResponse.json(
      { error: 'Failed to update notice' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');
    const noticeId = searchParams.get('noticeId');

    if (!token || !unitUid || !noticeId) {
      return NextResponse.json(
        { error: 'Token, unit UID, and notice ID are required' },
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

    if (!unit.tenant_id) {
      return NextResponse.json(
        { error: 'Unit not linked to a tenant' },
        { status: 400 }
      );
    }

    const tenantId: string = unit.tenant_id;

    const existingPost = await db
      .select()
      .from(noticeboard_posts)
      .where(
        and(
          eq(noticeboard_posts.id, noticeId),
          eq(noticeboard_posts.tenant_id, tenantId)
        )
      )
      .limit(1);

    if (!existingPost || existingPost.length === 0) {
      return NextResponse.json(
        { error: 'Notice not found' },
        { status: 404 }
      );
    }

    const post = existingPost[0];

    if (post.unit_id !== unitUid) {
      return NextResponse.json(
        { error: 'You can only delete your own posts' },
        { status: 403 }
      );
    }

    await db.insert(notice_audit_log).values({
      tenant_id: tenantId,
      notice_id: noticeId,
      action: 'delete_by_author',
      actor_type: 'resident',
      actor_id: unitUid,
      original_content: { title: post.title, content: post.content, author_unit: post.author_unit },
    });

    await db
      .update(noticeboard_posts)
      .set({ active: false, updated_at: new Date() })
      .where(eq(noticeboard_posts.id, noticeId));

    return NextResponse.json({ success: true });
  } catch (error) {
    const err = error as Error;
    console.error('[Purchaser Noticeboard DELETE Error]:', err);
    void logError({
      errorType: 'purchaser',
      errorCode: 'NOTICEBOARD_DELETE_FAILED',
      errorMessage: err.message || 'Failed to delete notice',
      stackTrace: err.stack,
      endpoint: '/api/purchaser/noticeboard',
      requestContext: { method: 'DELETE' },
    });
    return NextResponse.json(
      { error: 'Failed to delete notice' },
      { status: 500 }
    );
  }
}
