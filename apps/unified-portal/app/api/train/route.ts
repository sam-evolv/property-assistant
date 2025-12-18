export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Training functionality is not available in the purchaser portal. Please use the developer portal for document training.' },
    { status: 404 }
  );
}
