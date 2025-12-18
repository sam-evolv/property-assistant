import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { messages, analyticsEvents } from '@openhouse/db/schema';
import { sql, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [messagesStats, downloadStats] = await Promise.all([
      // Count messages and unique users
      db.select({
        totalMessages: sql<number>`count(*)`,
        uniqueUsers: sql<number>`count(distinct user_id)`,
      }).from(messages),
      
      // Count document downloads from analytics_events
      db.select({
        count: sql<number>`count(*)`,
      }).from(analyticsEvents)
        .where(eq(analyticsEvents.event_type, 'document_download'))
    ]);

    const questionsAnswered = Number(messagesStats[0]?.totalMessages || 0);
    const activeUsers = Number(messagesStats[0]?.uniqueUsers || 0);
    const pdfDownloads = Number(downloadStats[0]?.count || 0);
    
    // Total interactions = questions + downloads
    const totalInteractions = questionsAnswered + pdfDownloads;
    
    const engagementRate = activeUsers > 0 
      ? Math.round((totalInteractions / activeUsers) * 10) 
      : 0;

    const response = NextResponse.json({
      active_users: activeUsers,
      questions_answered: questionsAnswered,
      pdf_downloads: pdfDownloads,
      total_interactions: totalInteractions,
      engagement_rate: `${engagementRate}%`,
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
