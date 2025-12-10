import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, canAccessDevelopment } from '@openhouse/api/session';
import { db } from '@openhouse/db/client';
import { homeowners, messages, purchaserAgreements } from '@openhouse/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export const runtime = 'nodejs';

function extractSupabaseUnitId(email: string | null): string | null {
  if (!email) return null;
  const match = email.match(/unit-([a-f0-9-]+)@/i);
  return match ? match[1] : null;
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

    const homeowner = await db.query.homeowners.findFirst({
      where: eq(homeowners.id, id),
      with: {
        development: {
          columns: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    });

    if (!homeowner) {
      return NextResponse.json({ error: 'Homeowner not found' }, { status: 404 });
    }

    const hasAccess = await canAccessDevelopment(adminContext, homeowner.development_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const supabaseUnitId = extractSupabaseUnitId(homeowner.email);

    let messageStats = {
      total_messages: 0,
      user_messages: 0,
      assistant_messages: 0,
      first_message: null as string | null,
      last_message: null as string | null,
    };
    let recentMessagesResult: any[] = [];
    let agreementsResult: any[] = [];

    if (supabaseUnitId) {
      const [msgStatsResult, recentMsgsResult, agreementsRes] = await Promise.all([
        db.execute(sql`
          SELECT 
            COUNT(*)::int as total_messages,
            COUNT(CASE WHEN role = 'user' THEN 1 END)::int as user_messages,
            COUNT(CASE WHEN role = 'assistant' THEN 1 END)::int as assistant_messages,
            MIN(created_at) as first_message,
            MAX(created_at) as last_message
          FROM messages
          WHERE user_id = ${supabaseUnitId}
        `),
        db.select({
          id: messages.id,
          content: messages.content,
          role: messages.role,
          created_at: messages.created_at,
        })
        .from(messages)
        .where(eq(messages.user_id, supabaseUnitId))
        .orderBy(desc(messages.created_at))
        .limit(5),
        db.select()
          .from(purchaserAgreements)
          .where(eq(purchaserAgreements.unit_id, supabaseUnitId))
          .orderBy(desc(purchaserAgreements.agreed_at))
          .limit(1),
      ]);

      const statsRow = msgStatsResult.rows[0] as any;
      if (statsRow) {
        messageStats = {
          total_messages: statsRow.total_messages || 0,
          user_messages: statsRow.user_messages || 0,
          assistant_messages: statsRow.assistant_messages || 0,
          first_message: statsRow.first_message,
          last_message: statsRow.last_message,
        };
      }
      recentMessagesResult = recentMsgsResult;
      agreementsResult = agreementsRes;
    }

    const latestAgreement = agreementsResult[0] || null;

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

    return NextResponse.json({
      homeowner: {
        id: homeowner.id,
        name: homeowner.name,
        house_type: homeowner.house_type,
        address: homeowner.address,
        unique_qr_token: homeowner.unique_qr_token,
        development_id: homeowner.development_id,
        created_at: homeowner.created_at,
        development: homeowner.development,
        supabase_unit_id: supabaseUnitId,
      },
      activity: {
        total_messages: messageStats.total_messages,
        user_messages: messageStats.user_messages,
        assistant_messages: messageStats.assistant_messages,
        first_message: messageStats.first_message,
        last_message: messageStats.last_message,
        is_active_this_week: isActiveThisWeek,
        engagement_level: engagementLevel,
        recent_messages: recentMessagesResult.map(m => ({
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
