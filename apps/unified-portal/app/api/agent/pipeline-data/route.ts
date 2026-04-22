import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/pipeline-data
 *
 * Returns full pipeline data for the authenticated agent.
 * Uses service role + embedded Supabase joins to guarantee development names.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Resolve the authenticated user
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();

    let agentProfile: any = null;

    if (user) {
      const { data } = await supabase
        .from('agent_profiles')
        .select('id, display_name, agency_name, phone, email, tenant_id, agent_type, bio, location, specialisations')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      agentProfile = data;
    }

    if (!agentProfile) {
      const { data: fallback } = await supabase
        .from('agent_profiles')
        .select('id, display_name, agency_name, phone, email, tenant_id, agent_type, bio, location, specialisations')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (!fallback) {
        return NextResponse.json({ error: 'No agent profile found' }, { status: 404 });
      }
      agentProfile = fallback;
    }

    return buildPipelineResponse(supabase, agentProfile);
  } catch (error: any) {
    console.error('[agent/pipeline-data] Error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch pipeline data' }, { status: 500 });
  }
}

async function buildPipelineResponse(supabase: any, agentProfile: any) {
  const tenantId = agentProfile.tenant_id;
  const agentId = agentProfile.id;

  // Get assigned development IDs
  const { data: assignments } = await supabase
    .from('agent_scheme_assignments')
    .select('development_id')
    .eq('agent_id', agentId)
    .eq('is_active', true);

  const devIds: string[] = (assignments || []).map((a: any) => String(a.development_id));

  if (devIds.length === 0 && (agentProfile.agent_type || 'scheme') === 'scheme') {
    return NextResponse.json({
      agent: formatAgent(agentProfile),
      developments: [],
      pipeline: [],
      alerts: [],
    });
  }

  // Fetch developments directly — service role bypasses RLS
  const { data: developments } = await supabase
    .from('developments')
    .select('id, name, code, address, county')
    .in('id', devIds);

  // Build name map — UUID strings only
  const devNameMap: Record<string, string> = {};
  for (const d of developments || []) {
    devNameMap[String(d.id)] = d.name;
  }

  // Get tenant name
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single();
  const developerName: string | null = tenant?.name || null;

  // Fetch pipeline WITH embedded unit + development join
  // Use Supabase PostgREST embedded select to get dev name in one query
  const { data: pipelineRows } = await supabase
    .from('unit_sales_pipeline')
    .select(`
      id, unit_id, development_id, status, purchaser_name, purchaser_email, purchaser_phone,
      sale_price, release_date, sale_agreed_date, deposit_date, contracts_issued_date,
      signed_contracts_date, counter_signed_date, kitchen_date, kitchen_selected,
      snag_date, drawdown_date, estimated_close_date, handover_date, mortgage_expiry_date, comments,
      units!unit_id (
        id, unit_number, address, bedrooms, development_id
      ),
      developments!development_id (
        id, name
      )
    `)
    .eq('tenant_id', tenantId)
    .in('development_id', devIds);

  // Fetch units without pipeline records
  const { data: allUnits } = await supabase
    .from('units')
    .select('id, unit_number, address, bedrooms, development_id')
    .eq('tenant_id', tenantId)
    .in('development_id', devIds);

  const pipelineUnitIds = new Set((pipelineRows || []).map((p: any) => String(p.unit_id)));

  const pipeline: any[] = [];

  // Units WITH pipeline records — name comes from embedded join OR devNameMap
  for (const p of pipelineRows || []) {
    const unit = p.units as any;
    const dev = p.developments as any;
    const devId = String(p.development_id || unit?.development_id || '');
    // Primary: embedded join name. Fallback: devNameMap. Last resort: devId
    const developmentName = dev?.name || devNameMap[devId] || '';

    pipeline.push({
      id: p.id,
      unitId: p.unit_id,
      unitNumber: unit?.unit_number || 'Unknown',
      unitAddress: unit?.address || '',
      developmentId: devId,
      developmentName,
      bedrooms: unit?.bedrooms || null,
      unitTypeName: null,
      status: normalizeStatus(p.status || 'for_sale', p),
      pipelineStatusRaw: p.status || 'for_sale',
      purchaserName: p.purchaser_name,
      purchaserEmail: p.purchaser_email,
      purchaserPhone: p.purchaser_phone,
      salePrice: p.sale_price ? Number(p.sale_price) : null,
      releaseDate: p.release_date,
      saleAgreedDate: p.sale_agreed_date,
      depositDate: p.deposit_date,
      contractsIssuedDate: p.contracts_issued_date,
      signedContractsDate: p.signed_contracts_date,
      counterSignedDate: p.counter_signed_date,
      kitchenDate: p.kitchen_date,
      kitchenSelected: p.kitchen_selected,
      snagDate: p.snag_date,
      drawdownDate: p.drawdown_date,
      estimatedCloseDate: p.estimated_close_date,
      handoverDate: p.handover_date,
      mortgageExpiryDate: p.mortgage_expiry_date,
      comments: p.comments,
    });
  }

  // Units WITHOUT pipeline records (available/for_sale)
  for (const u of allUnits || []) {
    if (!pipelineUnitIds.has(String(u.id))) {
      const devId = String(u.development_id);
      pipeline.push({
        id: `virtual_${u.id}`,
        unitId: u.id,
        unitNumber: u.unit_number || 'Unknown',
        unitAddress: u.address || '',
        developmentId: devId,
        developmentName: devNameMap[devId] || '',
        bedrooms: u.bedrooms || null,
        unitTypeName: null,
        status: 'for_sale',
        pipelineStatusRaw: 'for_sale',
        purchaserName: null,
        purchaserEmail: null,
        purchaserPhone: null,
        salePrice: null,
        releaseDate: null,
        saleAgreedDate: null,
        depositDate: null,
        contractsIssuedDate: null,
        signedContractsDate: null,
        counterSignedDate: null,
        kitchenDate: null,
        kitchenSelected: null,
        snagDate: null,
        drawdownDate: null,
        estimatedCloseDate: null,
        handoverDate: null,
        mortgageExpiryDate: null,
        comments: null,
      });
    }
  }

  // Sort by unit number
  pipeline.sort((a: any, b: any) => {
    const aNum = parseInt(a.unitNumber) || 0;
    const bNum = parseInt(b.unitNumber) || 0;
    if (aNum !== bNum) return aNum - bNum;
    return (a.unitNumber || '').localeCompare(b.unitNumber || '');
  });

  // Compute alerts
  const now = new Date();
  const alerts: any[] = [];

  for (const p of pipeline) {
    if (p.contractsIssuedDate && !p.signedContractsDate && p.status !== 'sold') {
      const issued = new Date(p.contractsIssuedDate);
      const daysSince = Math.floor((now.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince > 60) {
        alerts.push({
          type: 'overdue_contracts',
          pipelineId: p.id,
          unitId: p.unitId,
          unitNumber: p.unitNumber,
          purchaserName: p.purchaserName || 'Unknown',
          developmentName: p.developmentName,
          daysOverdue: daysSince,
          message: `${daysSince} days overdue: solicitor follow-up needed`,
        });
      }
    }

    if (p.mortgageExpiryDate && p.status !== 'sold') {
      const expiry = new Date(p.mortgageExpiryDate);
      const daysUntil = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 45 && daysUntil > 0) {
        alerts.push({
          type: 'mortgage_expiry',
          pipelineId: p.id,
          unitId: p.unitId,
          unitNumber: p.unitNumber,
          purchaserName: p.purchaserName || 'Unknown',
          developmentName: p.developmentName,
          daysUntilExpiry: daysUntil,
          message: `Mortgage approval expiring in ${daysUntil} days`,
        });
      }
    }
  }

  alerts.sort((a: any, b: any) => {
    if (a.type === 'overdue_contracts' && b.type === 'mortgage_expiry') return -1;
    if (a.type === 'mortgage_expiry' && b.type === 'overdue_contracts') return 1;
    if (a.type === 'overdue_contracts') return (b.daysOverdue || 0) - (a.daysOverdue || 0);
    return (a.daysUntilExpiry || 0) - (b.daysUntilExpiry || 0);
  });

  return NextResponse.json({
    agent: formatAgent(agentProfile),
    developments: (developments || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      address: d.address,
      county: d.county || null,
      developerName,
    })),
    pipeline,
    alerts,
  });
}

function formatAgent(profile: any) {
  return {
    id: profile.id,
    displayName: profile.display_name,
    agencyName: profile.agency_name,
    phone: profile.phone,
    email: profile.email,
    tenantId: profile.tenant_id,
    agentType: profile.agent_type || 'scheme',
    bio: profile.bio || null,
    location: profile.location || null,
    specialisations: profile.specialisations || null,
  };
}

/**
 * Normalise the raw pipeline_status value into the 5-bucket enum the UI
 * understands. Production data contains `for_sale | agreed | sale_agreed |
 * in_progress | signed | handed_over`; the UI thinks in `for_sale |
 * sale_agreed | contracts_issued | signed | sold`. Some raw statuses map
 * cleanly; `in_progress` needs the row context to decide whether contracts
 * are out or fully signed.
 */
function normalizeStatus(status: string, row?: any): string {
  if (status === 'handed_over' || status === 'sold') return 'sold';
  if (status === 'agreed') return 'sale_agreed';
  if (status === 'signed') return 'signed';
  if (status === 'sale_agreed') return 'sale_agreed';
  if (status === 'for_sale') return 'for_sale';
  if (status === 'contracts_issued') return 'contracts_issued';
  if (status === 'in_progress') {
    // Row decides which milestone bucket to display.
    if (row?.handover_date) return 'sold';
    if (row?.signed_contracts_date || row?.counter_signed_date) return 'signed';
    if (row?.contracts_issued_date) return 'contracts_issued';
    if (row?.sale_agreed_date) return 'sale_agreed';
    return 'sale_agreed';
  }
  return 'for_sale';
}
