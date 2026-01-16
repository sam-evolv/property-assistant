import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { analyticsEvents } from '@openhouse/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// Event types that count as "Documents Served" - matches event-types.ts definition
const DOCUMENT_SERVED_EVENT_TYPES = [
  'document_view',
  'document_download',
  'document_open',
  'drawing_view',
  'drawing_download',
  'chat_document_served',
  'elevation_view',
];

export async function GET() {
  try {
    // Use analytics_events table for all metrics (consistent with Beta Control Room)
    // This table has complete activity data vs messages table which may be incomplete
    const [activeUsersResult, questionsResult, documentsResult] = await Promise.all([
      // Active users = distinct session_hash from all events
      db.execute(sql`
        SELECT COUNT(DISTINCT session_hash) as count
        FROM analytics_events
        WHERE session_hash IS NOT NULL
      `),

      // Questions answered = count of chat_question events
      db.execute(sql`
        SELECT COUNT(*) as count
        FROM analytics_events
        WHERE event_type = 'chat_question'
      `),

      // Documents served = count of all document-related events
      db.execute(sql`
        SELECT COUNT(*) as count
        FROM analytics_events
        WHERE event_type IN (${sql.raw(DOCUMENT_SERVED_EVENT_TYPES.map(t => `'${t}'`).join(', '))})
      `)
    ]);

    const activeUsers = Number((activeUsersResult.rows[0] as any)?.count || 0);
    const questionsAnswered = Number((questionsResult.rows[0] as any)?.count || 0);
    const documentsServed = Number((documentsResult.rows[0] as any)?.count || 0);

    // Total interactions = questions + documents served
    const totalInteractions = questionsAnswered + documentsServed;

    const engagementRate = activeUsers > 0
      ? Math.round((totalInteractions / activeUsers) * 10)
      : 0;

    const response = NextResponse.json({
      active_users: activeUsers,
      questions_answered: questionsAnswered,
      documents_served: documentsServed,
      total_interactions: totalInteractions,
      engagement_rate: `${engagementRate}%`,
      // Keep pdf_downloads for backward compatibility
      pdf_downloads: documentsServed,
    });

    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    response.headers.set('Cache-Control', 'no-store, max-age=0');

    return response;
  } catch (error) {
    console.error('[Public Stats] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}
