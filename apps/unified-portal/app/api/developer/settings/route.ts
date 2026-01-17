export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';
import { getAdminSession } from '@openhouse/api/session';

export const runtime = 'nodejs';

/**
 * Developer Settings API
 * Stores key-value settings per tenant for feature configuration
 */

// GET: Retrieve a setting by key
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
    }

    // Try to get the setting from the database
    const result = await db.execute(sql`
      SELECT value FROM developer_settings
      WHERE tenant_id = ${session.tenantId}::uuid AND key = ${key}
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      return NextResponse.json({
        key,
        value: result.rows[0].value,
        exists: true
      });
    }

    // Return default values for known settings
    const defaults: Record<string, any> = {
      room_dimensions: {
        enabled: true,
        show_disclaimer: true,
        attach_floorplans: true,
        disclaimer_text: "Please note: These dimensions are provided as a guide only. For exact measurements, please refer to the official floor plans and architectural drawings. We recommend verifying dimensions independently before making any purchasing decisions based on room sizes."
      }
    };

    return NextResponse.json({
      key,
      value: defaults[key] || null,
      exists: false
    });
  } catch (error) {
    console.error('[API] GET /api/developer/settings error:', error);
    return NextResponse.json({ error: 'Failed to fetch setting' }, { status: 500 });
  }
}

// POST: Save a setting
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
    }

    // Upsert the setting
    await db.execute(sql`
      INSERT INTO developer_settings (tenant_id, key, value, updated_at)
      VALUES (${session.tenantId}::uuid, ${key}, ${JSON.stringify(value)}::jsonb, NOW())
      ON CONFLICT (tenant_id, key)
      DO UPDATE SET value = ${JSON.stringify(value)}::jsonb, updated_at = NOW()
    `);

    console.log(`[SETTINGS] Saved ${key} for tenant ${session.tenantId}`);

    return NextResponse.json({ success: true, key, value });
  } catch (error) {
    console.error('[API] POST /api/developer/settings error:', error);
    return NextResponse.json({ error: 'Failed to save setting' }, { status: 500 });
  }
}
