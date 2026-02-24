/**
 * Single Webhook Management API
 *
 * PATCH  /api/integrations/webhooks/:id — Update webhook (pause/resume, update URL/events)
 * DELETE /api/integrations/webhooks/:id — Soft-delete webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { logAudit } from '@/lib/integrations/security/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const supabase = getSupabaseAdmin();
    const webhookId = params.id;

    // Verify ownership
    const { data: existing } = await supabase
      .from('webhooks')
      .select('id, tenant_id')
      .eq('id', webhookId)
      .eq('tenant_id', session.tenantId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const body = await request.json();
    const allowedFields = ['url', 'events', 'development_ids', 'is_active'];
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // If re-enabling, reset failure counter
    if (body.is_active === true) {
      updateData.consecutive_failures = 0;
      updateData.last_failure_reason = null;
    }

    const { data, error } = await supabase
      .from('webhooks')
      .update(updateData)
      .eq('id', webhookId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logAudit(session.tenantId, 'webhook.updated', 'user', {
      actor_id: session.id,
      webhook_id: webhookId,
      fields: Object.keys(updateData),
    });

    return NextResponse.json({ webhook: data });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const supabase = getSupabaseAdmin();
    const webhookId = params.id;

    // Verify ownership
    const { data: existing } = await supabase
      .from('webhooks')
      .select('id, tenant_id')
      .eq('id', webhookId)
      .eq('tenant_id', session.tenantId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    // Soft-delete by deactivating
    await supabase
      .from('webhooks')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', webhookId);

    await logAudit(session.tenantId, 'webhook.deleted', 'user', {
      actor_id: session.id,
      webhook_id: webhookId,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
