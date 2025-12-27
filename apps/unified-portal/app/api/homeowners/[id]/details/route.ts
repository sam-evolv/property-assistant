export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, canAccessDevelopment } from '@openhouse/api/session';
import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminContext = await getAdminSession();
    
    if (!adminContext) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    
    const { data: unitRow, error: unitError } = await supabase
      .from('units')
      .select(`
        id, 
        unit_number, 
        purchaser_name, 
        purchaser_email,
        address_line_1, 
        address_line_2, 
        city, 
        eircode,
        project_id, 
        created_at, 
        house_type_code,
        projects (
          id,
          name,
          address
        )
      `)
      .eq('id', id)
      .single();

    if (unitError || !unitRow) {
      console.log('[HOMEOWNER DETAILS] Unit not found:', id, unitError);
      return NextResponse.json({ error: 'Homeowner not found' }, { status: 404 });
    }

    const hasAccess = await canAccessDevelopment(adminContext, unitRow.project_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const [msgStatsResult, recentMsgsResult, agreementsRes] = await Promise.all([
      db.execute(sql`
        SELECT 
          COUNT(*)::int as total_messages,
          COUNT(CASE WHEN sender = 'user' THEN 1 END)::int as user_messages,
          COUNT(CASE WHEN sender = 'assistant' THEN 1 END)::int as assistant_messages,
          MIN(created_at) as first_message,
          MAX(created_at) as last_message
        FROM messages
        WHERE user_id = ${id}
      `),
      db.execute(sql`
        SELECT id, content, sender, created_at
        FROM messages
        WHERE user_id = ${id}
        ORDER BY created_at DESC
        LIMIT 5
      `),
      db.execute(sql`
        SELECT 
          id, unit_id, purchaser_name, agreed_at, ip_address, user_agent, 
          important_docs_acknowledged, docs_version
        FROM purchaser_agreements
        WHERE unit_id = ${id}
        ORDER BY agreed_at DESC
        LIMIT 1
      `),
    ]);

    const statsRow = msgStatsResult.rows[0] as any;
    const messageStats = {
      total_messages: statsRow?.total_messages || 0,
      user_messages: statsRow?.user_messages || 0,
      assistant_messages: statsRow?.assistant_messages || 0,
      first_message: statsRow?.first_message || null,
      last_message: statsRow?.last_message || null,
    };

    const recentMessages = (recentMsgsResult.rows || []) as any[];
    const latestAgreement = agreementsRes.rows[0] as any || null;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const lastMessageDate = messageStats.last_message ? new Date(messageStats.last_message) : null;
    const isActiveThisWeek = lastMessageDate && lastMessageDate >= sevenDaysAgo;

    let engagementLevel: 'high' | 'medium' | 'low' | 'none' = 'none';
    if (messageStats.total_messages >= 20) {
      engagementLevel = 'high';
    } else if (messageStats.total_messages >= 5) {
      engagementLevel = 'medium';
    } else if (messageStats.total_messages > 0) {
      engagementLevel = 'low';
    }

    const residentName = unitRow.purchaser_name || 'Unassigned';
    const fullAddress = [unitRow.address_line_1, unitRow.address_line_2, unitRow.city, unitRow.eircode]
      .filter(Boolean)
      .join(', ');

    const project = unitRow.projects as any;

    return NextResponse.json({
      homeowner: {
        id: unitRow.id,
        name: residentName,
        email: unitRow.purchaser_email,
        house_type: unitRow.house_type_code || unitRow.unit_number,
        address: fullAddress || null,
        unique_qr_token: unitRow.id,
        development_id: unitRow.project_id,
        created_at: unitRow.created_at,
        development: project ? {
          id: project.id,
          name: project.name,
          address: project.address,
        } : null,
      },
      activity: {
        total_messages: messageStats.total_messages,
        user_messages: messageStats.user_messages,
        assistant_messages: messageStats.assistant_messages,
        first_message: messageStats.first_message,
        last_message: messageStats.last_message,
        is_active_this_week: isActiveThisWeek,
        engagement_level: engagementLevel,
        recent_messages: recentMessages.map((m: any) => ({
          id: m.id,
          content: m.content?.substring(0, 150) + (m.content && m.content.length > 150 ? '...' : ''),
          role: m.sender,
          created_at: m.created_at,
        })),
      },
      acknowledgement: latestAgreement ? {
        agreed_at: latestAgreement.agreed_at,
        purchaser_name: latestAgreement.purchaser_name,
        ip_address: latestAgreement.ip_address,
        user_agent: latestAgreement.user_agent,
        docs_version: latestAgreement.docs_version,
        documents_acknowledged: latestAgreement.important_docs_acknowledged || [],
      } : null,
    });
  } catch (error) {
    console.error('[HOMEOWNER DETAILS] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch homeowner details' }, { status: 500 });
  }
}
