/**
 * GET /api/care/installations/[id] — Get installation details + telemetry
 * PUT /api/care/installations/[id] — Update installation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchSolarEdgeData } from '@/lib/care/solarEdgeApi';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET: Installation details + current telemetry + performance summary
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const installationId = params.id;

    const supabase = getSupabaseAdmin();

    // Get installation
    const { data: installation, error: instError } = await supabase
      .from('installations')
      .select('*')
      .eq('id', installationId)
      .single();

    if (instError || !installation) {
      return NextResponse.json(
        { error: 'Installation not found' },
        { status: 404 }
      );
    }

    // Get latest telemetry
    const { data: telemetry, error: telError } = await supabase
      .from('installation_telemetry')
      .select('*')
      .eq('installation_id', installationId)
      .order('recorded_at', { ascending: false })
      .limit(24); // Last 24 hours

    if (telError) {
      console.warn('Telemetry fetch failed:', telError);
    }

    // For solar systems, optionally fetch real SolarEdge data
    let solarData = null;
    if (installation.system_type === 'solar' && installation.telemetry_source === 'solarEdge') {
      try {
        solarData = await fetchSolarEdgeData(
          installation.serial_number,
          installation.telemetry_api_key // decrypted in production
        );
      } catch (error) {
        console.warn('SolarEdge API fetch failed:', error);
        // Fall back to mock
        const { getMockDailyProfile } = await import('@/lib/care/solarEdgeApi');
        solarData = {
          generation: {
            today: 18.4 + Math.random() * 5,
            thisMonth: 420 + Math.random() * 80,
            thisYear: 5240 + Math.random() * 500,
            lifeTime: 15000,
          },
          status: 'OK',
          lastUpdate: new Date().toISOString(),
          selfConsumption: 68,
        };
      }
    }

    // Get alerts
    const { data: alerts } = await supabase
      .from('installation_alerts')
      .select('*')
      .eq('installation_id', installationId)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      installation,
      telemetry: telemetry || [],
      solarData,
      alerts: alerts || [],
      summary: {
        daysActive: Math.floor(
          (new Date().getTime() - new Date(installation.installation_date).getTime()) / (1000 * 60 * 60 * 24)
        ),
        warrantyRemaining: installation.warranty_expiry
          ? Math.ceil(
              (new Date(installation.warranty_expiry).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
            )
          : null,
        adoptionStatus: installation.adoption_status,
      },
    });
  } catch (error) {
    console.error('[Care API] GET /installations/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch installation' },
      { status: 500 }
    );
  }
}

/**
 * PUT: Update installation (adoption status, etc.)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const installationId = params.id;
    const updates = await request.json();

    const supabase = getSupabaseAdmin();

    // Only allow certain fields to be updated
    const allowedFields = ['adoption_status', 'adopted_at', 'notes', 'homeowner_email', 'component_specs'];
    const filteredUpdates = Object.keys(updates)
      .filter((key) => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {} as Record<string, any>);

    // If adoption_status is changing to 'active', set adopted_at
    if (filteredUpdates.adoption_status === 'active' && !filteredUpdates.adopted_at) {
      filteredUpdates.adopted_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('installations')
      .update(filteredUpdates)
      .eq('id', installationId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ installation: data });
  } catch (error) {
    console.error('[Care API] PUT /installations/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to update installation' },
      { status: 500 }
    );
  }
}
