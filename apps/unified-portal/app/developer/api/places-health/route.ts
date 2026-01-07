import { NextRequest, NextResponse } from 'next/server';
import { testPlacesHealth } from '@/lib/places/poi';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const schemeId = searchParams.get('schemeId');

  if (!schemeId) {
    return NextResponse.json(
      { error: 'schemeId query parameter is required' },
      { status: 400 }
    );
  }

  try {
    const health = await testPlacesHealth(schemeId);

    return NextResponse.json({
      success: true,
      schemeId,
      health: {
        location: {
          present: health.hasLocation,
          lat: health.lat,
          lng: health.lng,
        },
        apiKey: {
          configured: health.apiKeyConfigured,
        },
        liveCall: {
          success: health.liveCallSuccess,
          status: health.liveCallStatus,
          error: health.liveCallError,
        },
        cache: {
          exists: health.cacheExists,
          categories: health.cacheCategories,
        },
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[PlacesHealth] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Health check failed',
      },
      { status: 500 }
    );
  }
}
