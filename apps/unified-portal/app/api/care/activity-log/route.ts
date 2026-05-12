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

    const { data, error } = await supabase
      .from('activity_log')
      .select('id, tenant_id, installation_id, activity_type, description, created_at')
      .eq('tenant_id', session.tenantId)
      .order('created_at', { ascending: false })
      .limit(8);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ activities: data || [] });
  } catch (error) {
    if (error instanceof CareAuthError) return careAuthErrorToResponse(error);
    return NextResponse.json({ error: 'Failed to fetch activity log' }, { status: 500 });
  }
}
