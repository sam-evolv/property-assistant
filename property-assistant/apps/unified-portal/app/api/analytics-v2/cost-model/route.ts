import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const days = parseInt(searchParams.get('days') || '30');

    const today = new Date();
    const costTrajectory = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - (days - i));
      costTrajectory.push({
        date: date.toISOString().split('T')[0],
        actualCost: 0.5 + (i * 0.02),
        projectedCost: 0.6 + (i * 0.025),
      });
    }

    const costModel = {
      totalActualCost: costTrajectory.reduce((sum, d) => sum + d.actualCost, 0),
      monthlyProjection: (costTrajectory.reduce((sum, d) => sum + d.projectedCost, 0) / days) * 30,
      costTrajectory,
    };

    return NextResponse.json(costModel);
  } catch (error) {
    console.error('[API] /api/analytics-v2/cost-model error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cost model' },
      { status: 500 }
    );
  }
}
