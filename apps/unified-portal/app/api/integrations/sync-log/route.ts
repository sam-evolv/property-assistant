/**
 * Sync Log API
 *
 * GET /api/integrations/sync-log?integration_id=xxx — List sync history
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const supabase = getSupabaseAdmin();
    const integrationId = request.nextUrl.searchParams.get('integration_id');

    if (!integrationId) {
      return NextResponse.json({ error: 'integration_id is required' }, { status: 400 });
    }

    // Verify ownership
    const { data: integration } = await supabase
      .from('integrations')
      .select('id, tenant_id')
      .eq('id', integrationId)
      .eq('tenant_id', session.tenantId)
      .single();

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10');

    const { data, error } = await supabase
      .from('integration_sync_log')
      .select('*')
      .eq('integration_id', integrationId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ sync_logs: data || [] });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
