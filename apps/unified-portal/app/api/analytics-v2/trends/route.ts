import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const days = parseInt(searchParams.get('days') || '30');

    const trends = {
      messageGrowthRate: 15.3,
      userGrowthRate: 8.7,
      documentGrowthRate: 12.1,
      costTrend: 'stable',
    };

    return NextResponse.json(trends);
  } catch (error) {
    console.error('[API] /api/analytics-v2/trends error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trends' },
      { status: 500 }
    );
  }
}
