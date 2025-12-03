import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const gaps: any[] = [];

    return NextResponse.json({ gaps });
  } catch (error) {
    console.error('[API] /api/analytics-v2/gaps error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch knowledge gaps' },
      { status: 500 }
    );
  }
}
