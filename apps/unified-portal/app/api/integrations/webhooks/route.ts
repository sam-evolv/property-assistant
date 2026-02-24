/**
 * Webhook Management API
 *
 * GET  /api/integrations/webhooks     — List webhooks for current tenant
 * POST /api/integrations/webhooks     — Create a new webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { requireRole } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { logAudit } from '@/lib/integrations/security/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('webhooks')
      .select('id, url, events, development_ids, is_active, consecutive_failures, max_failures, last_triggered_at, last_failure_reason, created_at')
      .eq('tenant_id', session.tenantId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ webhooks: data || [] });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const body = await request.json();
    const { url, events, development_ids } = body;

    if (!url || !events?.length) {
      return NextResponse.json({ error: 'url and events are required' }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid webhook URL' }, { status: 400 });
    }

    const secret = randomBytes(32).toString('hex');
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('webhooks')
      .insert({
        tenant_id: session.tenantId,
        url,
        secret,
        events,
        development_ids: development_ids || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logAudit(session.tenantId, 'webhook.created', 'user', {
      actor_id: session.id,
      webhook_id: data.id,
      url,
      events,
    });

    return NextResponse.json({
      webhook: { ...data, secret },
      message: 'Save the webhook secret securely — it will not be shown again.',
    }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
