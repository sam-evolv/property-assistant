import { NextResponse } from 'next/server';
import {
  CareAuthError,
  careAuthErrorToResponse,
  requireCareTenantSession,
} from '@/lib/care/require-care-session';

export const dynamic = 'force-dynamic';

// Mirrors migration 041: normalise legacy demo data at the API boundary so the
// UI stays consistent even if the migration has not been run yet.
function normaliseInstallation(row: Record<string, unknown>) {
  const out = { ...row };
  if (out.job_reference === 'SE-2024-DEMO-001') {
    out.job_reference = 'SE-2024-0847';
    out.address_line_1 = '23 Millbrook Gardens';
    out.city = 'Douglas';
    out.county = 'Cork';
    out.system_type = 'heat_pump';
    out.system_size_kwp = null;
    out.inverter_model = 'Mitsubishi Ecodan 8 kW';
  }
  if (out.health_status === 'activated') {
    out.health_status = 'active';
  }
  return out;
}

export async function GET() {
  try {
    const { supabase, session } = await requireCareTenantSession();

    const { data, error } = await supabase
      .from('installations')
      .select('*')
      .eq('tenant_id', session.tenantId)
      .order('install_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const installations = (data || []).map(normaliseInstallation);
    return NextResponse.json({ installations });
  } catch (error) {
    if (error instanceof CareAuthError) return careAuthErrorToResponse(error);
    return NextResponse.json({ error: 'Failed to fetch installations' }, { status: 500 });
  }
}
