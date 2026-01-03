export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

const querySchema = z.object({
  developer_id: z.string().uuid(),
  project_id: z.string().uuid().optional(),
  days: z.coerce.number().min(1).max(90).default(30),
});

export interface ChatResolutionData {
  totalChats: number;
  resolvedByAi: number;
  escalatedToHuman: number;
  resolutionRate: number;
  pendingInfoRequests: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const parseResult = querySchema.safeParse({
      developer_id: searchParams.get('developer_id') || undefined,
      project_id: searchParams.get('project_id') || undefined,
      days: searchParams.get('days') || 30,
    });

    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const { developer_id, project_id, days } = parseResult.data;

    const projectFilter = project_id 
      ? sql`AND development_id = ${project_id}::uuid` 
      : sql``;

    const [messagesResult, infoRequestsResult] = await Promise.all([
      db.execute(sql`
        SELECT 
          COUNT(*)::int as total_messages,
          COUNT(CASE WHEN ai_message IS NOT NULL AND ai_message != '' THEN 1 END)::int as ai_responded
        FROM messages
        WHERE development_id IN (
          SELECT id FROM developments WHERE tenant_id = ${developer_id}::uuid
        )
          AND created_at > NOW() - MAKE_INTERVAL(days => ${days})
          ${projectFilter}
      `),
      db.execute(sql`
        SELECT 
          COUNT(*)::int as total_requests,
          COUNT(CASE WHEN status = 'pending' THEN 1 END)::int as pending_requests,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END)::int as resolved_requests
        FROM information_requests
        WHERE tenant_id = ${developer_id}::uuid
          AND created_at > NOW() - MAKE_INTERVAL(days => ${days})
      `).catch(() => ({ rows: [{ total_requests: 0, pending_requests: 0, resolved_requests: 0 }] })),
    ]);

    const msgData = messagesResult.rows[0] as any;
    const reqData = infoRequestsResult.rows[0] as any;
    
    const totalMessages = msgData?.total_messages || 0;
    const aiResponded = msgData?.ai_responded || 0;
    const pendingInfoRequests = reqData?.pending_requests || 0;
    const totalInfoRequests = reqData?.total_requests || 0;
    
    // Resolution rate = (AI responded messages) / (total messages)
    // Escalated = info requests that were created (indicating AI couldn't answer)
    const resolutionRate = totalMessages > 0 
      ? Math.round((aiResponded / totalMessages) * 100)
      : (totalMessages === 0 && totalInfoRequests === 0 ? 100 : 0);

    return NextResponse.json({
      totalChats: totalMessages,
      resolvedByAi: aiResponded,
      escalatedToHuman: totalInfoRequests,
      resolutionRate: Math.min(100, resolutionRate),
      pendingInfoRequests,
    });
  } catch (error) {
    console.error('[API] /api/analytics/chat-resolution error:', error);
    return NextResponse.json({ 
      totalChats: 0,
      resolvedByAi: 0,
      escalatedToHuman: 0,
      resolutionRate: 0,
      pendingInfoRequests: 0,
    });
  }
}
