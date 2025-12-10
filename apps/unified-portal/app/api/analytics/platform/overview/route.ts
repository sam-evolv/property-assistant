import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db';
import { messages, homeowners, admins } from '@openhouse/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REAL_PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';

export async function GET() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get units count for the real project
    const { count: unitCount, error: unitError } = await supabaseAdmin
      .from('units')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', REAL_PROJECT_ID);

    if (unitError) {
      console.error('[Overview] Units error:', unitError);
    }
    
    console.log('[Overview] Units count:', unitCount);

    // Get projects count
    const { count: projectCount, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id', { count: 'exact', head: true });

    if (projectError) {
      console.error('[Overview] Projects error:', projectError);
    }

    // Get document count from Supabase document_sections (grouped by source)
    const { data: docSections, error: docError } = await supabaseAdmin
      .from('document_sections')
      .select('metadata')
      .eq('project_id', REAL_PROJECT_ID);

    if (docError) {
      console.error('[Overview] Documents error:', docError);
    }

    // Count unique documents by source/file_name
    const uniqueDocs = new Set();
    for (const section of docSections || []) {
      const source = section.metadata?.source || section.metadata?.file_name;
      if (source) uniqueDocs.add(source);
    }
    const docCount = uniqueDocs.size;

    console.log('[Overview] Documents count (from Supabase):', docCount);

    const [msgCount, activeUsers, homeownerCount, developerCount] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)::int` }).from(messages).then(r => r[0]?.count || 0),
      // Use user_id which contains unit UUID for purchaser portal chats (house_id is null)
      db.execute(sql`
        SELECT COUNT(DISTINCT user_id)::int as count
        FROM messages
        WHERE created_at >= ${sevenDaysAgo} AND user_id IS NOT NULL
      `).then(r => (r.rows[0] as any)?.count || 0),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(homeowners).then(r => r[0]?.count || 0),
      db.select({ count: sql<number>`COUNT(DISTINCT tenant_id)::int` }).from(admins).then(r => r[0]?.count || 0),
    ]);

    return NextResponse.json({
      total_developers: developerCount,
      total_developments: projectCount || 1,
      total_units: unitCount || 0,
      total_homeowners: homeownerCount,
      total_messages: msgCount,
      total_documents: docCount,
      active_homeowners_7d: activeUsers,
    });
  } catch (error) {
    console.error('[Overview] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch overview' }, { status: 500 });
  }
}
