/**
 * Integration Conflicts API
 *
 * GET   /api/integrations/conflicts — List pending conflicts
 * PATCH /api/integrations/conflicts — Resolve a conflict
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { logAudit } from '@/lib/integrations/security/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Get all pending conflicts for this tenant's integrations
    const { data: integrations } = await supabase
      .from('integrations')
      .select('id')
      .eq('tenant_id', tenantId);

    if (!integrations?.length) {
      return NextResponse.json({ conflicts: [] });
    }

    const integrationIds = integrations.map(i => i.id);

    const { data: conflicts, error } = await supabase
      .from('integration_conflicts')
      .select('*, integrations(name, type)')
      .in('integration_id', integrationIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch conflicts' }, { status: 500 });
    }

    return NextResponse.json({ conflicts: conflicts || [] });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const { conflict_id, resolution } = await request.json();

    if (!conflict_id || !['resolved_local', 'resolved_remote', 'ignored'].includes(resolution)) {
      return NextResponse.json({ error: 'conflict_id and valid resolution required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch the conflict and verify ownership
    const { data: conflict } = await supabase
      .from('integration_conflicts')
      .select('*, integrations(tenant_id)')
      .eq('id', conflict_id)
      .single();

    if (!conflict || conflict.integrations?.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Conflict not found' }, { status: 404 });
    }

    // Apply the resolution
    if (resolution === 'resolved_remote') {
      // Apply the remote value to the local database
      await supabase
        .from(conflict.oh_table)
        .update({ [conflict.oh_field]: conflict.remote_value })
        .eq('id', conflict.oh_record_id);
    }
    // resolved_local: keep local value (no action needed)
    // ignored: skip (no action needed)

    // Update conflict status
    await supabase
      .from('integration_conflicts')
      .update({
        status: resolution,
        resolved_by: session.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', conflict_id);

    await logAudit(tenantId, 'conflict.resolved', 'user', {
      actor_id: session.id,
      resource_type: 'conflict',
      resource_id: conflict_id,
      resolution,
      oh_table: conflict.oh_table,
      oh_field: conflict.oh_field,
    }, request);

    return NextResponse.json({ success: true, resolution });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
