import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { messages, developments } from '@openhouse/db/schema';
import { sql, eq } from 'drizzle-orm';
import { getServerSession } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: { developmentId: string } }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { developmentId } = params;
    if (!UUID_RE.test(developmentId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Verify the development belongs to the caller's tenant (super_admin may
    // access any development).
    const development = await db.query.developments.findFirst({
      where: eq(developments.id, developmentId),
      columns: { id: true, tenant_id: true },
    });
    if (!development) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (session.role !== 'super_admin' && development.tenant_id !== session.tenantId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await db.select({
      total_messages: sql<number>`COUNT(*)::int`,
      total_tokens: sql<number>`COALESCE(SUM(${messages.token_count}), 0)::int`,
      avg_response_time_ms: sql<number>`COALESCE(AVG(${messages.latency_ms}), 0)::int`,
    })
      .from(messages)
      .where(sql`${messages.development_id} = ${developmentId} AND ${messages.created_at} >= ${startDate}`);

    const usage = result[0] || {
      total_messages: 0,
      total_tokens: 0,
      avg_response_time_ms: 0,
    };

    const estimated_cost_usd = (usage.total_tokens / 1000000) * 2.0;

    return NextResponse.json({
      ...usage,
      estimated_cost_usd: parseFloat(estimated_cost_usd.toFixed(4)),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch development usage metrics' },
      { status: 500 }
    );
  }
}
