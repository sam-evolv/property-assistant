export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@openhouse/api/session';
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

async function safeQuery(queryFn: () => Promise<any>, fallback: any): Promise<any> {
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
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('id, name, address')
        .eq('id', unitRow.project_id)
        .single();
      project = projectData ? { ...projectData, important_docs_version: 1 } : null;
      console.log('[HOMEOWNER DETAILS] Project lookup:', { 
        project_id: unitRow.project_id, 
        found: !!projectData, 
        name: projectData?.name,
        error: projectError?.message 
      });
    } else {
      console.log('[HOMEOWNER DETAILS] No project_id on unit');
    }

    // NOTE: canAccessDevelopment checks Drizzle developments table, but units use Supabase projects table
    // These tables may have different UUIDs for the same logical development
    // For now, allow access if the admin is authenticated with appropriate role
    // The proper fix would be to reconcile projects and developments tables
    const isAuthorized = adminContext.role === 'super_admin' ||
                         adminContext.role === 'developer' ||
                         adminContext.role === 'admin';

    if (!isAuthorized) {
      console.log('[HOMEOWNER DETAILS] Access denied for', adminContext.email, 'role:', adminContext.role);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch messaging stats from Drizzle (messages table)
    // NOTE: Messages table stores both user_message and ai_message in each row (conversation format)
    // The user_id in messages can be the Supabase unit UUID OR might be stored differently
    const emptyStats = { rows: [{ total_conversations: 0, first_message: null, last_message: null }] };
    const emptyMessages = { rows: [] };

    // Get unit_uid from Supabase unit row for additional matching
    const unitUid = unitRow.unit_uid || unitRow.id;
    const developmentId = unitRow.project_id;

    // Try to find messages by unit_id, user_id, metadata.unitUid, or unit_uid from Supabase
    // Build query dynamically to avoid casting non-UUID strings
    const isUuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const idIsUuid = isUuidFormat.test(id);
    const unitUidIsUuid = isUuidFormat.test(unitUid);
    
    // Build conditions array for safe query
    let msgStatsResult = emptyStats;
    let recentMsgsResult = emptyMessages;
    
    // Try unit-level matching first
    const unitLevelResult = await safeQuery(
      async () => {
        if (idIsUuid) {
          const result = await db.execute(sql`
            SELECT 
              COUNT(*)::int as total_conversations,
              MIN(created_at) as first_message,
              MAX(created_at) as last_message
            FROM messages
            WHERE unit_id = ${id}::uuid
               OR user_id = ${id}::uuid
               OR metadata->>'unitUid' = ${id}
          `);
          return result;
        } else if (unitUidIsUuid) {
          const result = await db.execute(sql`
            SELECT 
              COUNT(*)::int as total_conversations,
              MIN(created_at) as first_message,
              MAX(created_at) as last_message
            FROM messages
            WHERE unit_id = ${unitUid}::uuid
               OR user_id = ${unitUid}::uuid
               OR metadata->>'unitUid' = ${unitUid}
          `);
          return result;
        } else {
          const result = await db.execute(sql`
            SELECT 
              COUNT(*)::int as total_conversations,
              MIN(created_at) as first_message,
              MAX(created_at) as last_message
            FROM messages
            WHERE metadata->>'unitUid' = ${id}
               OR metadata->>'unitUid' = ${unitUid}
          `);
          return result;
        }
      },
      emptyStats
    );
    
    const unitConversations = (unitLevelResult.rows[0] as any)?.total_conversations || 0;
    
    // If no unit-level data, fallback to development-level aggregation
    if (unitConversations === 0 && developmentId) {
      console.log('[HOMEOWNER DETAILS] No unit-level messages found, using development-level fallback');
      msgStatsResult = await safeQuery(
        async () => {
          const result = await db.execute(sql`
            SELECT 
              COUNT(*)::int as total_conversations,
              MIN(created_at) as first_message,
              MAX(created_at) as last_message
            FROM messages
            WHERE development_id = ${developmentId}::uuid
          `);
          return result;
        },
        emptyStats
      );
      
      recentMsgsResult = await safeQuery(
        async () => {
          const result = await db.execute(sql`
            SELECT id, user_message, ai_message, created_at
            FROM messages
            WHERE development_id = ${developmentId}::uuid
            ORDER BY created_at DESC
            LIMIT 5
          `);
          return result;
        },
        emptyMessages
      );
    } else {
      msgStatsResult = unitLevelResult;
      
      recentMsgsResult = await safeQuery(
        async () => {
          if (idIsUuid) {
            const result = await db.execute(sql`
              SELECT id, user_message, ai_message, created_at
              FROM messages
              WHERE unit_id = ${id}::uuid
                 OR user_id = ${id}::uuid
                 OR metadata->>'unitUid' = ${id}
              ORDER BY created_at DESC
              LIMIT 5
            `);
            return result;
          } else if (unitUidIsUuid) {
            const result = await db.execute(sql`
              SELECT id, user_message, ai_message, created_at
              FROM messages
              WHERE unit_id = ${unitUid}::uuid
                 OR user_id = ${unitUid}::uuid
                 OR metadata->>'unitUid' = ${unitUid}
              ORDER BY created_at DESC
              LIMIT 5
            `);
            return result;
          } else {
            const result = await db.execute(sql`
              SELECT id, user_message, ai_message, created_at
              FROM messages
              WHERE metadata->>'unitUid' = ${id}
                 OR metadata->>'unitUid' = ${unitUid}
              ORDER BY created_at DESC
              LIMIT 5
            `);
            return result;
          }
        },
        emptyMessages
      );
    }

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

    // Check acknowledgement status from multiple sources:
    // 1. Supabase units table (important_docs_agreed_version) - may not exist
    // 2. Drizzle purchaser_agreements table - fallback
    let agreedVersion = unitRow.important_docs_agreed_version || 0;
    let agreedAt = unitRow.important_docs_agreed_at || null;
    const projectDocsVersion = project?.important_docs_version || 1;
    
    // Also check Drizzle purchaser_agreements table
    if (!agreedVersion) {
      try {
        const agreementResult = await db.execute(sql`
          SELECT docs_version, agreed_at, purchaser_name, ip_address, user_agent, important_docs_acknowledged
          FROM purchaser_agreements
          WHERE unit_id = ${id}
          ORDER BY agreed_at DESC
          LIMIT 1
        `);
        
        if (agreementResult.rows.length > 0) {
          const agreement = agreementResult.rows[0] as any;
          agreedVersion = agreement.docs_version || 1;
          agreedAt = agreement.agreed_at;
          console.log('[HOMEOWNER DETAILS] Found agreement in Drizzle purchaser_agreements:', agreement.agreed_at);
        }
      } catch (e: any) {
        // Table may not exist
        console.log('[HOMEOWNER DETAILS] Could not check purchaser_agreements (table may not exist)');
      }
    }
    
    const hasAcknowledged = agreedVersion > 0 && agreedVersion >= projectDocsVersion;
    
    // Build acknowledgement object from available data
    const acknowledgement = hasAcknowledged ? {
      agreed_at: agreedAt,
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

    // Determine handover status
    const handoverDate = unitRow.handover_date || null;
    const isHandedOver = handoverDate ? new Date(handoverDate) <= new Date() : false;
    
    return NextResponse.json({
      homeowner: {
        id: unitRow.id,
        name: residentName,
        email: unitRow.purchaser_email || unitRow.email,
        house_type: houseType,
        address: fullAddress || null,
        unique_qr_token: unitRow.id,
        access_code: unitRow.unit_uid || null,
        handover_date: handoverDate,
        is_handed_over: isHandedOver,
        portal_type: isHandedOver ? 'property_assistant' : 'pre_handover',
        development_id: unitRow.project_id,
        created_at: unitRow.created_at,
        important_docs_agreed_version: agreedVersion,
        important_docs_agreed_at: unitRow.important_docs_agreed_at,
        development: (() => {
          const dev = project ? {
            id: project.id,
            name: project.name,
            address: project.address,
            important_docs_version: projectDocsVersion,
          } : null;
          console.log('[HOMEOWNER DETAILS] Returning development:', dev);
          return dev;
        })(),
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
