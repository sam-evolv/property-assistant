import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const repeatedQuestions: any[] = [];

    return NextResponse.json({ repeatedQuestions });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch repeated questions' },
      { status: 500 }
    );
  }
}
