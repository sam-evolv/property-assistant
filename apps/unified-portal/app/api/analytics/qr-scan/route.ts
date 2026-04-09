export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { logAnalyticsEvent } from '@openhouse/api/analytics-logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { unit_id, development_id, tenant_id } = body;

    if (!unit_id || !tenant_id) {
      return NextResponse.json(
        { error: 'unit_id and tenant_id are required' },
        { status: 400 }
      );
    }

    const result = await logAnalyticsEvent({
      tenantId: tenant_id,
      developmentId: development_id || null,
      eventType: 'qr_scan',
      eventCategory: 'access',
      eventData: {
        unit_id,
        source: 'qr',
        timestamp: new Date().toISOString(),
      },
    });

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to log analytics event', details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, eventId: result.eventId });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
