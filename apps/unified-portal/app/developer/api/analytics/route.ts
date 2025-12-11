import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getAnalyticsSummary, getUnansweredReport } from '@openhouse/api';
import { db } from '@openhouse/db';
import { admins, developments } from '@openhouse/db/schema';
import { eq, and, sql } from 'drizzle-orm';

async function validateDeveloperAccess(email: string, tenantId: string) {
  const admin = await db.query.admins.findFirst({
    where: and(
      eq(admins.email, email),
      eq(admins.tenant_id, tenantId)
    ),
    columns: { id: true, role: true }
  });

  if (!admin) {
    return { valid: false, error: 'Admin not found' };
  }

  return { valid: true, role: admin.role };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const developmentId = searchParams.get('developmentId') || undefined;
    const days = parseInt(searchParams.get('days') || '30');
    const reportType = searchParams.get('type') || 'summary';

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const access = await validateDeveloperAccess(user.email, tenantId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    if (reportType === 'unanswered') {
      const report = await getUnansweredReport(tenantId, developmentId, days);
      return NextResponse.json({ unansweredQuestions: report });
    }

    // Default: full analytics summary
    const summary = await getAnalyticsSummary(tenantId, developmentId, days);
    
    // Also get "what are people asking" from messages table (aggregated, anonymised)
    const devFilter = developmentId 
      ? sql`AND development_id = ${developmentId}::uuid`
      : sql``;

    const { rows: topQuestions } = await db.execute(sql`
      SELECT 
        question_topic as topic,
        COUNT(*) as count,
        COUNT(DISTINCT DATE(created_at)) as days_active
      FROM messages
      WHERE tenant_id = ${tenantId}::uuid
        ${devFilter}
        AND sender = 'user'
        AND question_topic IS NOT NULL
        AND created_at > now() - interval '${sql.raw(days.toString())} days'
      GROUP BY question_topic
      ORDER BY count DESC
      LIMIT 20
    `);

    // Get "what couldn't be answered" from information_requests
    const { rows: unansweredByTopic } = await db.execute(sql`
      SELECT 
        topic,
        status,
        COUNT(*) as count
      FROM information_requests
      WHERE tenant_id = ${tenantId}::uuid
        ${devFilter}
        AND created_at > now() - interval '${sql.raw(days.toString())} days'
      GROUP BY topic, status
      ORDER BY count DESC
    `);

    return NextResponse.json({
      ...summary,
      topQuestions,
      unansweredByTopic,
      period: { days }
    });

  } catch (error) {
    console.error('[Analytics API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
