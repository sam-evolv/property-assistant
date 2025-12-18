export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Training jobs are not available in the purchaser portal. Please use the developer portal.' },
    { status: 404 }
  );
}
