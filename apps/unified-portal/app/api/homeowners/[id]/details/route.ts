import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, canAccessDevelopment } from '@openhouse/api/session';
import { db } from '@openhouse/db/client';
import { units, messages, purchaserAgreements, developments } from '@openhouse/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

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

    const unit = await db.query.units.findFirst({
      where: eq(units.id, id),
      with: {
        development: {
          columns: {
            id: true,
            name: true,
            address: true,
            important_docs_version: true,
          },
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: 'Homeowner not found' }, { status: 404 });
    }

    const hasAccess = await canAccessDevelopment(adminContext, unit.development_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const [msgStatsResult, recentMsgsResult, agreementsRes] = await Promise.all([
      db.execute(sql`
        SELECT 
          COUNT(*)::int as total_messages,
          COUNT(CASE WHEN role = 'user' THEN 1 END)::int as user_messages,
          COUNT(CASE WHEN role = 'assistant' THEN 1 END)::int as assistant_messages,
          MIN(created_at) as first_message,
          MAX(created_at) as last_message
        FROM messages
        WHERE user_id = ${id}
      `),
      db.select({
        id: messages.id,
        content: messages.content,
        role: messages.role,
        created_at: messages.created_at,
      })
      .from(messages)
      .where(eq(messages.user_id, id))
      .orderBy(desc(messages.created_at))
      .limit(5),
      db.select()
        .from(purchaserAgreements)
        .where(eq(purchaserAgreements.unit_id, id))
        .orderBy(desc(purchaserAgreements.agreed_at))
        .limit(1),
    ]);

    const statsRow = msgStatsResult.rows[0] as any;
    const messageStats = {
      total_messages: statsRow?.total_messages || 0,
      user_messages: statsRow?.user_messages || 0,
      assistant_messages: statsRow?.assistant_messages || 0,
      first_message: statsRow?.first_message || null,
      last_message: statsRow?.last_message || null,
    };

    const latestAgreement = agreementsRes[0] || null;

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

    const residentName = unit.purchaser_name || unit.resident_name || 'Unassigned';

    return NextResponse.json({
      homeowner: {
        id: unit.id,
        name: residentName,
        house_type: unit.unit_number,
        address: unit.address,
        unique_qr_token: unit.id,
        development_id: unit.development_id,
        created_at: unit.created_at,
        important_docs_agreed_version: unit.important_docs_agreed_version,
        important_docs_agreed_at: unit.important_docs_agreed_at,
        development: unit.development,
      },
      activity: {
        total_messages: messageStats.total_messages,
        user_messages: messageStats.user_messages,
        assistant_messages: messageStats.assistant_messages,
        first_message: messageStats.first_message,
        last_message: messageStats.last_message,
        is_active_this_week: isActiveThisWeek,
        engagement_level: engagementLevel,
        recent_messages: recentMsgsResult.map(m => ({
          id: m.id,
          content: m.content?.substring(0, 150) + (m.content && m.content.length > 150 ? '...' : ''),
          role: m.role,
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
