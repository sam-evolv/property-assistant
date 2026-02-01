import { NextRequest, NextResponse } from 'next/server';
import { db, dataAccessLog, admins } from '@openhouse/db';
import { desc, eq, gte, lte, sql, ilike, or, and, type SQL } from 'drizzle-orm';
import { requireRole } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireRole(['super_admin']);

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const action = searchParams.get('action') || '';
    const search = searchParams.get('search') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    const conditions: SQL[] = [gte(dataAccessLog.created_at, dateThreshold)];
    
    if (action && action !== 'all') {
      conditions.push(eq(dataAccessLog.action, action));
    }
    
    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          ilike(dataAccessLog.accessor_email, searchPattern),
          ilike(dataAccessLog.resource_description, searchPattern)
        )!
      );
    }

    const whereClause = and(...conditions);

    const logs = await db
      .select({
        id: dataAccessLog.id,
        accessor_id: dataAccessLog.accessor_id,
        accessor_email: dataAccessLog.accessor_email,
        accessor_role: dataAccessLog.accessor_role,
        action: dataAccessLog.action,
        resource_type: dataAccessLog.resource_type,
        resource_id: dataAccessLog.resource_id,
        resource_description: dataAccessLog.resource_description,
        ip_address: dataAccessLog.ip_address,
        created_at: dataAccessLog.created_at,
      })
      .from(dataAccessLog)
      .where(whereClause)
      .orderBy(desc(dataAccessLog.created_at))
      .limit(limit)
      .offset(offset);

    const formattedLogs = logs.map((log) => ({
      id: log.id,
      accessorEmail: log.accessor_email || 'Unknown',
      accessorRole: log.accessor_role || 'Unknown',
      action: formatAction(log.action),
      rawAction: log.action,
      resourceType: log.resource_type,
      resourceDescription: log.resource_description || 'N/A',
      ipAddress: log.ip_address || 'Unknown',
      createdAt: log.created_at?.toISOString() || new Date().toISOString(),
    }));

    const [totalCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(dataAccessLog)
      .where(whereClause);

    return NextResponse.json({
      logs: formattedLogs,
      total: totalCount?.count || 0,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('[Audit Log API] Error:', error);
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}

function formatAction(action: string): string {
  const actionMap: Record<string, string> = {
    viewed_chat_analytics: 'Viewed chat analytics',
    viewed_chat_history: 'Viewed chat history',
    viewed_message_details: 'Viewed message details',
    viewed_unit_messages: 'Viewed unit messages',
    exported_data: 'Exported data',
    viewed_purchaser_details: 'Viewed purchaser details',
    viewed_pipeline_data: 'Viewed pipeline data',
  };
  return actionMap[action] || action;
}
