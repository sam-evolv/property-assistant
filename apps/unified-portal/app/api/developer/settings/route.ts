export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@openhouse/api/session';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      db: { schema: 'public' }
    }
  );
}

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

    // Return default values for known settings - Supabase table may not exist
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

    const supabase = getSupabaseAdmin();

    // Upsert the setting
    const { error } = await supabase
      .from('developer_settings')
      .upsert({
        tenant_id: session.tenantId,
        key: key,
        value: value,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id,key'
      });

    if (error) {
      console.error('[API] POST /api/developer/settings error:', error);
      return NextResponse.json({ error: 'Failed to save setting' }, { status: 500 });
    }

    console.log(`[SETTINGS] Saved ${key} for tenant ${session.tenantId}`);

    return NextResponse.json({ success: true, key, value });
  } catch (error) {
    console.error('[API] POST /api/developer/settings error:', error);
    return NextResponse.json({ error: 'Failed to save setting' }, { status: 500 });
  }
}
