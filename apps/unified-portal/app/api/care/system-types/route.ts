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

    const { data } = await supabase
      .from('installations')
      .select('system_type')
      .eq('tenant_id', session.tenantId)
      .eq('is_active', true);

    const unique = [...new Set((data || []).map((r: any) => r.system_type).filter(Boolean))];
    const systemTypes = unique.map((t: string) => ({
      id: t,
      name: t.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    }));

    const base = [
      { id: 'solar_pv', name: 'Solar PV' },
      { id: 'heat_pump', name: 'Heat Pump' },
      { id: 'ev_charger', name: 'EV Charger' },
      { id: 'battery_storage', name: 'Battery Storage' },
    ];
    const merged = [...base, ...systemTypes.filter(t => !base.find(b => b.id === t.id))];

    return NextResponse.json({ systemTypes: merged });
  } catch (error) {
    if (error instanceof CareAuthError) return careAuthErrorToResponse(error);
    return NextResponse.json({ error: 'Failed to fetch system types' }, { status: 500 });
  }
}
