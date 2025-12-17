import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db';
import { messages } from '@openhouse/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const [messagesStats, documentsCount] = await Promise.all([
      db.select({
        totalMessages: sql<number>`count(*)`,
        uniqueUsers: sql<number>`count(distinct user_id)`,
      }).from(messages),
      
      supabase
        .from('document_sections')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', PROJECT_ID)
        .not('metadata->archive_category', 'is', null)
    ]);

    const questionsAnswered = Number(messagesStats[0]?.totalMessages || 0);
    const activeUsers = Number(messagesStats[0]?.uniqueUsers || 0);
    const pdfDownloads = documentsCount.count || 0;
    
    const engagementRate = activeUsers > 0 
      ? Math.round((questionsAnswered / activeUsers) * 10) 
      : 0;

    const response = NextResponse.json({
      active_users: activeUsers,
      questions_answered: questionsAnswered,
      pdf_downloads: pdfDownloads,
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
