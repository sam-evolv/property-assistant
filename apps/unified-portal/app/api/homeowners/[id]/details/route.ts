import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, canAccessDevelopment } from '@openhouse/api/session';
import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

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

    const unitResult = await db.execute(sql`
      SELECT 
        u.id, u.unit_number, u.purchaser_name, u.purchaser_email,
        u.address_line_1, u.address_line_2, u.city, u.eircode,
        u.development_id, u.created_at, u.important_docs_agreed_version,
        u.important_docs_agreed_at, u.house_type_code,
        d.id as dev_id, d.name as dev_name, d.address as dev_address,
        d.important_docs_version as dev_docs_version
      FROM units u
      LEFT JOIN developments d ON u.development_id = d.id
      WHERE u.id = ${id}
      LIMIT 1
    `);

    const unitRow = unitResult.rows[0] as any;

    if (!unitRow) {
      return NextResponse.json({ error: 'Homeowner not found' }, { status: 404 });
    }

    const hasAccess = await canAccessDevelopment(adminContext, unitRow.development_id);
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

    return NextResponse.json({
      homeowner: {
        id: unitRow.id,
        name: residentName,
        house_type: unitRow.house_type_code || unitRow.unit_number,
        address: fullAddress || null,
        unique_qr_token: unitRow.id,
        development_id: unitRow.development_id,
        created_at: unitRow.created_at,
        important_docs_agreed_version: unitRow.important_docs_agreed_version,
        important_docs_agreed_at: unitRow.important_docs_agreed_at,
        development: {
          id: unitRow.dev_id,
          name: unitRow.dev_name,
          address: unitRow.dev_address,
          important_docs_version: unitRow.dev_docs_version,
        },
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
