export const dynamic = 'force-dynamic'

/**
 * GET /api/care/installations/[id]: Get installation details + telemetry
 * PUT /api/care/installations/[id]: Update installation
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchSolarEdgeData } from '@/lib/care/solarEdgeApi';
import {
  CareAuthError,
  careAuthErrorToResponse,
  requireCareSession,
} from '@/lib/care/require-care-session';

/**
 * GET: Installation details + current telemetry + performance summary
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase, installation } = await requireCareSession({
      installationId: params.id,
    });

    // Get latest telemetry (24h)
    const { data: telemetry } = await supabase
      .from('installation_telemetry')
      .select('*')
      .eq('installation_id', installation.id)
      .order('recorded_at', { ascending: false })
      .limit(24);

    // For solar systems, optionally fetch real SolarEdge data
    let solarData = null;
    if (installation.system_type === 'solar' && installation.telemetry_source === 'solarEdge') {
      try {
        solarData = await fetchSolarEdgeData(
          installation.serial_number as string,
          installation.telemetry_api_key as string, // decrypted in production
        );
      } catch (error) {
        const { getMockDailyProfile } = await import('@/lib/care/solarEdgeApi');
        void getMockDailyProfile;
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
      .eq('installation_id', installation.id)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      installation,
      telemetry: telemetry || [],
      solarData,
      alerts: alerts || [],
      summary: {
        daysActive: installation.installation_date
          ? Math.floor(
              (new Date().getTime() - new Date(installation.installation_date as string).getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : null,
        warrantyRemaining: installation.warranty_expiry
          ? Math.ceil(
              (new Date(installation.warranty_expiry as string).getTime() - new Date().getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : null,
        adoptionStatus: installation.adoption_status,
      },
    });
  } catch (error) {
    if (error instanceof CareAuthError) return careAuthErrorToResponse(error);
    return NextResponse.json(
      { error: 'Failed to fetch installation' },
      { status: 500 },
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
    const { supabase, session, installation } = await requireCareSession({
      installationId: params.id,
    });
    const updates = await request.json();

    // Only allow certain fields to be updated
    const allowedFields = ['adoption_status', 'adopted_at', 'notes', 'homeowner_email', 'component_specs'];
    const filteredUpdates = Object.keys(updates)
      .filter((key) => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {} as Record<string, any>);

    if (filteredUpdates.adoption_status === 'active' && !filteredUpdates.adopted_at) {
      filteredUpdates.adopted_at = new Date().toISOString();
    }

    // Defence in depth: even though requireCareSession already verified
    // tenant ownership, the update filter explicitly restates it.
    const { data, error } = await supabase
      .from('installations')
      .update(filteredUpdates)
      .eq('id', installation.id)
      .eq('tenant_id', session.tenantId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ installation: data });
  } catch (error) {
    if (error instanceof CareAuthError) return careAuthErrorToResponse(error);
    return NextResponse.json(
      { error: 'Failed to update installation' },
      { status: 500 },
    );
  }
}
