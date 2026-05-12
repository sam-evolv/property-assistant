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
      .from('installations')
      .select('*')
      .eq('tenant_id', session.tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ installations: data || [] });
  } catch (error) {
    if (error instanceof CareAuthError) return careAuthErrorToResponse(error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
