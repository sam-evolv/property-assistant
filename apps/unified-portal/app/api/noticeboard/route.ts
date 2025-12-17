export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { noticeboard_posts } from '@openhouse/db/schema';
import { eq, desc, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant ID found' }, { status: 400 });
    }

    const posts = await db
      .select()
      .from(noticeboard_posts)
      .where(eq(noticeboard_posts.tenant_id, tenantId))
      .orderBy(desc(noticeboard_posts.priority), desc(noticeboard_posts.created_at));

    return NextResponse.json({ posts });
  } catch (error) {
    console.error('[Noticeboard GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant ID found' }, { status: 400 });
    }

    const body = await request.json();
    const { title, content, priority, start_date, end_date, active } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    const [post] = await db
      .insert(noticeboard_posts)
      .values({
        tenant_id: tenantId,
        title,
        content,
        priority: priority || 0,
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
        active: active !== undefined ? active : true,
      })
      .returning();

    return NextResponse.json({ post });
  } catch (error) {
    console.error('[Noticeboard POST Error]:', error);
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    );
  }
}
