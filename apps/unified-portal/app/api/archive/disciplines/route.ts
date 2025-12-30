export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { fetchArchiveDisciplines } from '@/lib/archive';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const mode = searchParams.get('mode');
    const schemeId = searchParams.get('schemeId');
    const legacyDevelopmentId = searchParams.get('developmentId');

    console.log('[API /archive/disciplines] Request received:', { tenantId, mode, schemeId, legacyDevelopmentId });

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    if (!mode) {
      return NextResponse.json(
        { error: 'mode is required. Must be "ALL_SCHEMES" or "SCHEME"' },
        { status: 400 }
      );
    }

    if (mode && mode !== 'ALL_SCHEMES' && mode !== 'SCHEME') {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "ALL_SCHEMES" or "SCHEME"' },
        { status: 400 }
      );
    }

    if (mode === 'SCHEME' && !schemeId) {
      return NextResponse.json(
        { error: 'schemeId is required when mode is SCHEME' },
        { status: 400 }
      );
    }

    const developmentId = mode === 'SCHEME' ? schemeId : (legacyDevelopmentId || null);

    console.log('[API /archive/disciplines] Fetching with:', { mode: mode || 'LEGACY', developmentId });

    const disciplines = await fetchArchiveDisciplines({
      tenantId,
      developmentId,
    });

    console.log('[API /archive/disciplines] Response status: 200, disciplines count:', disciplines.length);

    return NextResponse.json({ disciplines });
  } catch (error) {
    console.error('[API /archive/disciplines] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch disciplines' },
      { status: 500 }
    );
  }
}
