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

async function safeQuery<T>(queryFn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await queryFn();
  } catch (error: any) {
    if (error?.cause?.code === '42P01') {
      return fallback;
    }
    console.log('[HOMEOWNER DETAILS] Query failed (graceful fallback):', error?.message || error);
    return fallback;
  }
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
    
    // Fetch unit with all columns and join unit_types for house type name
    const { data: unitRow, error: unitError } = await supabase
      .from('units')
      .select(`
        *,
        unit_types (
          id,
          name
        )
      `)
      .eq('id', id)
      .single();

    if (unitError || !unitRow) {
      console.log('[HOMEOWNER DETAILS] Unit not found:', id, unitError);
      return NextResponse.json({ error: 'Homeowner not found' }, { status: 404 });
    }

    // Fetch project details separately
    let project = null;
    if (unitRow.project_id) {
      const { data: projectData } = await supabase
        .from('projects')
        .select('id, name, address, important_docs_version')
        .eq('id', unitRow.project_id)
        .single();
      project = projectData;
    }

    const hasAccess = await canAccessDevelopment(adminContext, unitRow.project_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch messaging stats from Drizzle (messages table)
    // NOTE: Messages table stores both user_message and ai_message in each row (conversation format)
    const emptyStats = { rows: [{ total_conversations: 0, first_message: null, last_message: null }] };
    const emptyMessages = { rows: [] };

    const [msgStatsResult, recentMsgsResult] = await Promise.all([
      safeQuery(
        () => db.execute(sql`
          SELECT 
            COUNT(*)::int as total_conversations,
            MIN(created_at) as first_message,
            MAX(created_at) as last_message
          FROM messages
          WHERE user_id = ${id}
        `),
        emptyStats
      ),
      safeQuery(
        () => db.execute(sql`
          SELECT id, user_message, ai_message, created_at
          FROM messages
          WHERE user_id = ${id}
          ORDER BY created_at DESC
          LIMIT 5
        `),
        emptyMessages
      ),
    ]);

    const statsRow = msgStatsResult.rows[0] as any;
    const totalConversations = statsRow?.total_conversations || 0;
    
    // Each conversation record contains 1 user question and 1 AI response
    const messageStats = {
      total_messages: totalConversations * 2, // user + AI per conversation
      user_messages: totalConversations, // one user question per conversation
      assistant_messages: totalConversations, // one AI response per conversation
      first_message: statsRow?.first_message || null,
      last_message: statsRow?.last_message || null,
    };

    const recentMessages = (recentMsgsResult.rows || []) as any[];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const lastMessageDate = messageStats.last_message ? new Date(messageStats.last_message) : null;
    const isActiveThisWeek = lastMessageDate && lastMessageDate >= sevenDaysAgo;

    let engagementLevel: 'high' | 'medium' | 'low' | 'none' = 'none';
    if (messageStats.user_messages >= 20) {
      engagementLevel = 'high';
    } else if (messageStats.user_messages >= 5) {
      engagementLevel = 'medium';
    } else if (messageStats.user_messages > 0) {
      engagementLevel = 'low';
    }

    // Build display name from available fields
    const residentName = unitRow.purchaser_name || unitRow.name || 'Unassigned';
    
    // Build address from the address field (units store address directly)
    const fullAddress = unitRow.address || '';

    // Get house type from the joined unit_types table
    const unitType = unitRow.unit_types as any;
    const houseType = unitType?.name || unitRow.house_type_code || unitRow.house_type || 'N/A';

    // Check acknowledgement status from unit record itself
    const agreedVersion = unitRow.important_docs_agreed_version || 0;
    const projectDocsVersion = project?.important_docs_version || 0;
    const hasAcknowledged = agreedVersion > 0 && agreedVersion >= projectDocsVersion;
    
    // Build acknowledgement object from unit data
    const acknowledgement = hasAcknowledged ? {
      agreed_at: unitRow.important_docs_agreed_at,
      purchaser_name: unitRow.purchaser_name || residentName,
      ip_address: null,
      user_agent: null,
      docs_version: agreedVersion,
      documents_acknowledged: [],
    } : null;

    // Check noticeboard terms from unit data
    const noticeboard_terms = unitRow.notices_terms_accepted_at ? {
      accepted_at: unitRow.notices_terms_accepted_at,
    } : null;

    // Format recent messages for display (expand conversation records into individual messages)
    const formattedMessages: any[] = [];
    for (const msg of recentMessages) {
      if (msg.user_message) {
        formattedMessages.push({
          id: `${msg.id}-user`,
          content: msg.user_message?.substring(0, 150) + (msg.user_message && msg.user_message.length > 150 ? '...' : ''),
          role: 'user',
          created_at: msg.created_at,
        });
      }
      if (msg.ai_message) {
        formattedMessages.push({
          id: `${msg.id}-assistant`,
          content: msg.ai_message?.substring(0, 150) + (msg.ai_message && msg.ai_message.length > 150 ? '...' : ''),
          role: 'assistant',
          created_at: msg.created_at,
        });
      }
    }

    return NextResponse.json({
      homeowner: {
        id: unitRow.id,
        name: residentName,
        email: unitRow.purchaser_email || unitRow.email,
        house_type: houseType,
        address: fullAddress || null,
        unique_qr_token: unitRow.id,
        development_id: unitRow.project_id,
        created_at: unitRow.created_at,
        important_docs_agreed_version: agreedVersion,
        important_docs_agreed_at: unitRow.important_docs_agreed_at,
        development: project ? {
          id: project.id,
          name: project.name,
          address: project.address,
          important_docs_version: projectDocsVersion,
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
        recent_messages: formattedMessages.slice(0, 10), // Show up to 10 individual messages
      },
      acknowledgement,
      noticeboard_terms,
    });
  } catch (error) {
    console.error('[HOMEOWNER DETAILS] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch homeowner details' }, { status: 500 });
  }
}
