import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/lettings/home-dashboard — single-shot payload for the lettings
 * home page: greeting, stat tiles, upcoming-event counts. The "coming up"
 * feed itself lands in Session 11b.
 */

const TENANTED_STATUSES = new Set(['let', 'occupied', 'tenanted']);
const VACANT_STATUSES = new Set(['vacant', 'available', 'empty']);

const ZERO_PAYLOAD = {
  agent: { firstName: 'Agent', displayName: 'Agent' },
  stats: {
    totalProperties: 0,
    tenantedCount: 0,
    vacantCount: 0,
    monthlyRentRoll: 0,
    avgCompleteness: 0,
  },
  upcomingCounts: {
    leaseRenewalsNext30Days: 0,
    leaseRenewalsNext90Days: 0,
    berExpiriesNext90Days: 0,
  },
  comingUp: [] as ComingUpEvent[],
};

type ComingUpEvent = {
  id: string;
  type: 'lease_renewal' | 'ber_expiry';
  propertyId: string;
  propertyAddress: string;
  eventDate: string;
  daysUntil: number;
  label: string;
  contextLine: string;
  urgency: 'urgent' | 'soon' | 'upcoming';
};

function urgencyFromDays(days: number): ComingUpEvent['urgency'] {
  if (days < 30) return 'urgent';
  if (days < 60) return 'soon';
  return 'upcoming';
}

function diffDays(target: Date, today: Date): number {
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export async function GET() {
  const started = Date.now();
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookies() });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getSupabaseAdmin();
    const { data: agentProfile } = await admin
      .from('agent_profiles')
      .select('id, display_name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!agentProfile) return NextResponse.json(ZERO_PAYLOAD);

    const displayName = agentProfile.display_name || 'Agent';
    const firstName = displayName.split(' ')[0] || displayName;

    const { data: workspace } = await admin
      .from('agent_workspaces')
      .select('id')
      .eq('agent_id', agentProfile.id)
      .eq('mode', 'lettings')
      .limit(1)
      .maybeSingle();
    if (!workspace) {
      return NextResponse.json({ ...ZERO_PAYLOAD, agent: { firstName, displayName } });
    }

    console.log(`[lettings-home] fetch_start agent=${agentProfile.id}`);

    const { data: properties, error: propsErr } = await admin
      .from('agent_letting_properties')
      .select('id, address, address_line_1, status, completeness_score, ber_rating, ber_expiry_date')
      .eq('agent_id', agentProfile.id)
      .eq('workspace_id', workspace.id);
    if (propsErr) {
      console.error(`[lettings-home] properties_query_failed reason=${propsErr.message}`);
      return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 });
    }

    const propertyRows = properties ?? [];
    const totalProperties = propertyRows.length;

    let tenantedCount = 0;
    let vacantCount = 0;
    let completenessSum = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day30 = new Date(today);
    day30.setDate(day30.getDate() + 30);
    const day90 = new Date(today);
    day90.setDate(day90.getDate() + 90);
    let berExpiriesNext90Days = 0;
    const comingUp: ComingUpEvent[] = [];
    const propertyById = new Map<string, { address: string; berRating: string | null }>();

    for (const p of propertyRows) {
      const s = (p.status ?? '').toLowerCase();
      if (TENANTED_STATUSES.has(s)) tenantedCount += 1;
      else if (VACANT_STATUSES.has(s)) vacantCount += 1;
      completenessSum += p.completeness_score ?? 0;
      const propertyAddress = p.address ?? p.address_line_1 ?? 'Untitled property';
      propertyById.set(p.id, { address: propertyAddress, berRating: p.ber_rating ?? null });
      if (p.ber_expiry_date) {
        const d = new Date(p.ber_expiry_date);
        if (d >= today && d <= day90) {
          berExpiriesNext90Days += 1;
          const days = diffDays(d, today);
          comingUp.push({
            id: `ber_expiry-${p.id}`,
            type: 'ber_expiry',
            propertyId: p.id,
            propertyAddress,
            eventDate: p.ber_expiry_date,
            daysUntil: days,
            label: 'BER cert expiring',
            contextLine: p.ber_rating ? `BER ${String(p.ber_rating).toUpperCase()} cert` : 'BER cert',
            urgency: urgencyFromDays(days),
          });
        }
      }
    }

    let monthlyRentRoll = 0;
    let leaseRenewalsNext30Days = 0;
    let leaseRenewalsNext90Days = 0;
    if (totalProperties > 0) {
      const ids = propertyRows.map((p) => p.id);
      const { data: tenancies } = await admin
        .from('agent_tenancies')
        .select('id, letting_property_id, tenant_name, rent_pcm, lease_end')
        .eq('status', 'active')
        .in('letting_property_id', ids);
      for (const t of tenancies ?? []) {
        if (t.rent_pcm != null) monthlyRentRoll += Number(t.rent_pcm);
        if (t.lease_end) {
          const d = new Date(t.lease_end);
          if (d >= today && d <= day90) {
            leaseRenewalsNext90Days += 1;
            if (d <= day30) leaseRenewalsNext30Days += 1;
            const days = diffDays(d, today);
            const prop = propertyById.get(t.letting_property_id);
            const ctxParts: string[] = [];
            if (t.tenant_name) ctxParts.push(t.tenant_name);
            if (t.rent_pcm != null) ctxParts.push(`€${Number(t.rent_pcm).toLocaleString()}/m`);
            comingUp.push({
              id: `lease_renewal-${t.id}`,
              type: 'lease_renewal',
              propertyId: t.letting_property_id,
              propertyAddress: prop?.address ?? 'Untitled property',
              eventDate: t.lease_end,
              daysUntil: days,
              label: 'Lease ending',
              contextLine: ctxParts.length > 0 ? ctxParts.join(' · ') : 'Active tenancy',
              urgency: urgencyFromDays(days),
            });
          }
        }
      }
    }

    comingUp.sort((a, b) => a.daysUntil - b.daysUntil);
    const cappedComingUp = comingUp.slice(0, 10);

    const avgCompleteness =
      totalProperties > 0 ? Math.round(completenessSum / totalProperties) : 0;

    console.log(
      `[lettings-home] fetch_ok total=${totalProperties} tenanted=${tenantedCount} duration_ms=${Date.now() - started}`,
    );
    return NextResponse.json({
      agent: { firstName, displayName },
      stats: {
        totalProperties,
        tenantedCount,
        vacantCount,
        monthlyRentRoll,
        avgCompleteness,
      },
      upcomingCounts: {
        leaseRenewalsNext30Days,
        leaseRenewalsNext90Days,
        berExpiriesNext90Days,
      },
      comingUp: cappedComingUp,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(
      `[lettings-home] error duration_ms=${Date.now() - started} reason=${message}`,
    );
    return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 });
  }
}
