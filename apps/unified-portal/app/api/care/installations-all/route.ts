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
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('installations')
    .select('*')
    .order('install_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const installations = (data || []).map(normaliseInstallation);
  return NextResponse.json({ installations });
}
