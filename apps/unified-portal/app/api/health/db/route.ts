export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { healthCheck, getPoolStats } from '@openhouse/db/client';

export async function GET() {
  try {
    const health = await healthCheck();
    
    if (!health.healthy) {
      return NextResponse.json(
        { 
          status: 'unhealthy',
          error: health.error,
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'healthy',
      latencyMs: health.latencyMs,
      poolStats: health.poolStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
