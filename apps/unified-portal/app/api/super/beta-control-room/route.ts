export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { 
  getBetaKPIs, 
  getLiveActivity, 
  getTopQuestions,
  getTrainingOpportunities,
  getUnactivatedSignups,
  getUnansweredQuestions,
  getDocumentUsage,
  getConversationStats
} from '@openhouse/api/analytics-logger';
import { requireRole } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin']);
  } catch (authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get('developmentId') || undefined;
    const eventType = searchParams.get('eventType') || undefined;
    const hours = parseInt(searchParams.get('hours') || '24');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const [
      kpis, 
      liveActivity, 
      topQuestions24h, 
      topQuestions7d, 
      trainingOpportunities, 
      unactivatedSignups,
      unansweredQuestions,
      documentUsage,
      conversationStats
    ] = await Promise.all([
      getBetaKPIs(developmentId),
      getLiveActivity({ developmentId, eventType, hours, limit, offset }),
      getTopQuestions({ developmentId, hours: 24, limit: 15 }),
      getTopQuestions({ developmentId, hours: 168, limit: 15 }),
      getTrainingOpportunities({ developmentId, hours: 168, limit: 15 }),
      getUnactivatedSignups({ developmentId, windowHours: 6, limit: 30 }),
      getUnansweredQuestions({ developmentId, hours: 168, limit: 20 }),
      getDocumentUsage({ developmentId, hours: 168, limit: 15 }),
      getConversationStats({ developmentId, hours: 168 })
    ]);

    return NextResponse.json({
      kpis,
      liveActivity,
      topQuestions: {
        last24h: topQuestions24h,
        last7d: topQuestions7d
      },
      trainingOpportunities,
      unactivatedSignups,
      unansweredQuestions,
      documentUsage,
      conversationStats
    });
  } catch (error) {
    console.error('[Beta Control Room API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}
