export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchSolarEdgeData, getMockDailyProfile } from '@/lib/care/solarEdgeApi';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ installationId: string }> }
) {
  const { installationId } = await params;
  const supabase = getSupabaseAdmin();

  const { data: installation, error } = await supabase
    .from('installations')
    .select('id, system_type, system_size_kwp, telemetry_source, serial_number, telemetry_api_key, install_date, health_status')
    .eq('id', installationId)
    .single();

  if (error || !installation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const isHeatPump = installation.system_type?.toLowerCase().includes('heat_pump');

  // Try real SolarEdge API if credentials present
  let solarData = null;
  if (!isHeatPump && installation.telemetry_source === 'solarEdge' && installation.serial_number && installation.telemetry_api_key) {
    try {
      solarData = await fetchSolarEdgeData(installation.serial_number, installation.telemetry_api_key);
    } catch {
      // fall through to mock
    }
  }

  // Fall back to realistic mock
  if (!solarData) {
    solarData = await fetchSolarEdgeData(installation.id); // no api key = mock
  }

  const hourlyProfile = getMockDailyProfile();

  // Get unresolved alerts
  const { data: alerts } = await supabase
    .from('installation_alerts')
    .select('id, alert_type, code, message, created_at')
    .eq('installation_id', installationId)
    .eq('resolved', false)
    .order('created_at', { ascending: false })
    .limit(5);

  return NextResponse.json({
    generation: solarData.generation,
    status: solarData.status,
    lastUpdate: solarData.lastUpdate,
    selfConsumption: solarData.selfConsumption,
    hourlyProfile,
    alerts: alerts || [],
    source: installation.telemetry_source || 'estimated',
  });
}
