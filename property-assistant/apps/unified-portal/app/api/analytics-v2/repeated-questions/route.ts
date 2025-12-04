import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const repeatedQuestions: any[] = [];

    return NextResponse.json({ repeatedQuestions });
  } catch (error) {
    console.error('[API] /api/analytics-v2/repeated-questions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repeated questions' },
      { status: 500 }
    );
  }
}
