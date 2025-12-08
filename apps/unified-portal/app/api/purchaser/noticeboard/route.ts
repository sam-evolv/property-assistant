import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db/client';
import { noticeboard_posts, tenants } from '@openhouse/db/schema';
import { eq, desc, and, lte, gte, or, isNull } from 'drizzle-orm';
import { validateQRToken } from '@openhouse/api/qr-tokens';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    const payload = await validateQRToken(token);
    if (!payload || payload.supabaseUnitId !== unitUid) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select('id, address, project_id')
      .eq('id', unitUid)
      .single();

    if (unitError || !unit) {
      console.error('[Noticeboard] Unit not found in Supabase:', unitError);
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
    const now = new Date();

    const posts = await db
      .select({
        id: noticeboard_posts.id,
        title: noticeboard_posts.title,
        content: noticeboard_posts.content,
        priority: noticeboard_posts.priority,
        created_at: noticeboard_posts.created_at,
        author_name: noticeboard_posts.author_name,
        author_unit: noticeboard_posts.author_unit,
      })
      .from(noticeboard_posts)
      .where(
        and(
          eq(noticeboard_posts.tenant_id, tenantId),
          eq(noticeboard_posts.active, true),
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

    const notices = posts.map((post) => ({
      id: post.id,
      title: post.title,
      message: post.content,
      created_at: post.created_at,
      priority: (post.priority ?? 0) >= 3 ? 'high' : (post.priority ?? 0) >= 2 ? 'medium' : 'low',
      category: 'general',
      author_name: post.author_name,
      author_unit: post.author_unit,
    }));

    return NextResponse.json({ notices });
  } catch (error) {
    console.error('[Purchaser Noticeboard GET Error]:', error);
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

    const payload = await validateQRToken(token);
    if (!payload || payload.supabaseUnitId !== unitUid) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select('id, address, project_id')
      .eq('id', unitUid)
      .single();

    if (unitError || !unit) {
      console.error('[Noticeboard] Unit not found in Supabase:', unitError);
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
    const body = await request.json();
    const { title, message, category, priority, authorName } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Title and message are required' },
        { status: 400 }
      );
    }

    let priorityValue = 0;
    if (priority === 'high') priorityValue = 3;
    else if (priority === 'medium') priorityValue = 2;
    else if (priority === 'low') priorityValue = 1;

    const unitAddress = unit.address || 'Unknown Unit';

    const [post] = await db
      .insert(noticeboard_posts)
      .values({
        tenant_id: tenantId,
        title,
        content: message,
        priority: priorityValue,
        active: true,
        author_name: authorName?.trim() || 'Resident',
        author_unit: unitAddress,
      })
      .returning();

    console.log('[Noticeboard] Created post:', post.id, 'by unit:', unitAddress);

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
      },
    });
  } catch (error) {
    console.error('[Purchaser Noticeboard POST Error]:', error);
    return NextResponse.json(
      { error: 'Failed to create notice' },
      { status: 500 }
    );
  }
}
