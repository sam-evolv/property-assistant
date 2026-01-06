import { NextRequest, NextResponse } from 'next/server';
import { getGapLogsByScheme, getGapSummary } from '@/lib/assistant/gap-logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schemeId = searchParams.get('schemeId');
    const action = searchParams.get('action') || 'list';
    
    if (!schemeId) {
      return NextResponse.json({ error: 'schemeId is required' }, { status: 400 });
    }
    
    if (action === 'summary') {
      const summary = await getGapSummary(schemeId);
      return NextResponse.json({ summary });
    }
    
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const gapReason = searchParams.get('gapReason') || undefined;
    
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    
    const { logs, totalCount } = await getGapLogsByScheme(schemeId, {
      limit,
      offset,
      gapReason: gapReason as any,
      startDate: startDateStr ? new Date(startDateStr) : undefined,
      endDate: endDateStr ? new Date(endDateStr) : undefined,
    });
    
    return NextResponse.json({
      logs,
      totalCount,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    console.error('[API] Error fetching gap logs:', error);
    return NextResponse.json({ error: 'Failed to fetch gap logs' }, { status: 500 });
  }
}
