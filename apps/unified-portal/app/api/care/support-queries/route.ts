import { NextResponse } from 'next/server';
import {
  CareAuthError,
  careAuthErrorToResponse,
  requireCareTenantSession,
} from '@/lib/care/require-care-session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { supabase, session } = await requireCareTenantSession();

    // Fetch support queries joined with installation for address info,
    // scoped to caller's tenant via the installations relation.
    const { data, error } = await supabase
      .from('support_queries')
      .select(`
        id,
        installation_id,
        query_text,
        query_category,
        resolved,
        escalated,
        resolved_without_callout,
        response_source,
        created_at,
        installations!inner ( job_reference, address_line_1, city, customer_name, tenant_id )
      `)
      .eq('installations.tenant_id', session.tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const queries = (data || []).map((q: Record<string, unknown>) => {
      const inst = q.installations as Record<string, string> | null;
      let status = 'open';
      if (q.resolved) status = 'resolved';
      else if (q.response_source === 'in_progress') status = 'in_progress';

      return {
        id: q.id,
        installation_id: q.installation_id,
        customer_ref: inst?.customer_name || inst?.job_reference || 'Unknown',
        address: inst ? `${inst.address_line_1}, ${inst.city}` : '',
        query_type: q.query_category || 'General',
        query_status: status,
        description: q.query_text,
        resolved_without_callout: q.resolved_without_callout,
        created_at: q.created_at,
      };
    });

    return NextResponse.json({ queries });
  } catch (error) {
    if (error instanceof CareAuthError) return careAuthErrorToResponse(error);
    return NextResponse.json({ error: 'Failed to fetch support queries' }, { status: 500 });
  }
}
