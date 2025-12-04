import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  // Session is loaded client-side via AuthContext
  // This endpoint intentionally returns empty to avoid server-side dependencies
  return NextResponse.json(null, { status: 200 });
}
