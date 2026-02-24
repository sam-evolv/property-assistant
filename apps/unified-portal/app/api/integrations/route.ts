/**
 * Integrations Management API
 *
 * GET    /api/integrations — List all integrations for the tenant
 * POST   /api/integrations — Create a new integration
 * PATCH  /api/integrations?id=xxx — Update an integration
 * DELETE /api/integrations?id=xxx — Disconnect/remove an integration
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
    const developmentId = request.nextUrl.searchParams.get('development_id');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('integrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (developmentId) {
      query = query.eq('development_id', developmentId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Integrations] List error:', error);
      return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 });
    }

    // Also fetch pending conflicts count
    const integrationIds = (data || []).map(i => i.id);
    let conflictsCount = 0;

    if (integrationIds.length > 0) {
      const { count } = await supabase
        .from('integration_conflicts')
        .select('*', { count: 'exact', head: true })
        .in('integration_id', integrationIds)
        .eq('status', 'pending');

      conflictsCount = count || 0;
    }

    // Fetch recent audit logs
    const { data: auditLogs } = await supabase
      .from('integration_audit_log')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      integrations: data || [],
      pending_conflicts: conflictsCount,
      recent_audit_logs: auditLogs || [],
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[Integrations] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;
    const integrationId = request.nextUrl.searchParams.get('id');

    if (!tenantId || !integrationId) {
      return NextResponse.json({ error: 'Tenant context and integration ID required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Verify ownership
    const { data: existing } = await supabase
      .from('integrations')
      .select('id, name, type')
      .eq('id', integrationId)
      .eq('tenant_id', tenantId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    // Update status to disconnected (soft delete)
    await supabase
      .from('integrations')
      .update({
        status: 'disconnected',
        credentials: '{}',
        updated_at: new Date().toISOString(),
      })
      .eq('id', integrationId);

    await logAudit(tenantId, 'integration.disconnected', 'user', {
      actor_id: session.id,
      resource_type: 'integration',
      resource_id: integrationId,
      integration_name: existing.name,
      integration_type: existing.type,
    }, request);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[Integrations] Delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
