import { NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await db.execute('SELECT 1');
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'developer-portal',
      version: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'developer-portal',
        error: 'Database connection failed',
      },
      { status: 503 }
    );
  }
}
