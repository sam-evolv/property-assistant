import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('installations')
    .select('system_type')
    .eq('is_active', true);

  const unique = [...new Set((data || []).map((r: any) => r.system_type).filter(Boolean))];
  const systemTypes = unique.map((t: string) => ({
    id: t,
    name: t.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  }));

  // Always include core types
  const base = [
    { id: 'solar_pv', name: 'Solar PV' },
    { id: 'heat_pump', name: 'Heat Pump' },
    { id: 'ev_charger', name: 'EV Charger' },
    { id: 'battery_storage', name: 'Battery Storage' },
  ];
  const merged = [...base, ...systemTypes.filter(t => !base.find(b => b.id === t.id))];

  return NextResponse.json({ systemTypes: merged });
}
