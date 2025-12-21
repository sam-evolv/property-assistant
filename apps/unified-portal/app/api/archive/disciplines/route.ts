export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { fetchArchiveDisciplines } from '@/lib/archive';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const developmentId = searchParams.get('developmentId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const disciplines = await fetchArchiveDisciplines({
      tenantId,
      developmentId,
    });

    return NextResponse.json({ disciplines });
  } catch (error) {
    console.error('[API] Error fetching archive disciplines:', error);
    return NextResponse.json(
      { error: 'Failed to fetch disciplines' },
      { status: 500 }
    );
  }
}
