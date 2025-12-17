import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db';
import { messages, homeowners, admins } from '@openhouse/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      db: { schema: 'public' }
    }
  );
}

export async function GET(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    
    // DEBUG: Log project ID for Vercel troubleshooting
    console.log('[Overview API] Fetching for projectId:', projectId || 'ALL');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Use raw SQL via Supabase RPC to bypass RLS completely
    // This counts units regardless of user_id being NULL
    let unitCount = 0;
    try {
      if (projectId) {
        const { data, error } = await supabaseAdmin.rpc('count_units_by_project', {
          p_project_id: projectId
        });
        if (error) {
          // Fallback: direct query which should work with service role
          const { count, error: countError } = await supabaseAdmin
            .from('units')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId);
          if (!countError) unitCount = count || 0;
          console.log('[Overview] Units count (fallback query):', unitCount, countError);
        } else {
          unitCount = data || 0;
        }
      } else {
        const { count, error } = await supabaseAdmin
          .from('units')
          .select('*', { count: 'exact', head: true });
        if (!error) unitCount = count || 0;
      }
    } catch (unitError) {
      console.error('[Overview] Units error:', unitError);
    }
    
    console.log('[Overview] Units count:', unitCount, 'projectId:', projectId);

    // Get projects count from Supabase
    let projectCount = 0;
    try {
      const { count, error } = await supabaseAdmin
        .from('projects')
        .select('*', { count: 'exact', head: true });
      if (!error) projectCount = count || 0;
    } catch (projectError) {
      console.error('[Overview] Projects error:', projectError);
    }

    let docQuery = supabaseAdmin
      .from('document_sections')
      .select('metadata');
    
    if (projectId) {
      docQuery = docQuery.eq('project_id', projectId);
    }

    const { data: docSections, error: docError } = await docQuery;

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
