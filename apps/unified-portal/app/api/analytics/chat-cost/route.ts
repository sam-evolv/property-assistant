// TEMPORARILY DISABLED: analytics-engine module not found
// import { NextRequest, NextResponse } from 'next/server';
// import { getChatCostEstimate } from 'analytics-engine';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: 'Analytics endpoint temporarily unavailable - analytics-engine module not found' },
    { status: 501 }
  );
}
