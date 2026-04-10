import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/pipeline-data
 *
 * Returns full pipeline data for the authenticated agent, including
 * development names, unit statuses, and alerts.
 * Uses service role to bypass RLS on developments table.
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate via Supabase session
    const supabaseAuth = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Use service role client for data fetching (bypasses RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. Get agent profile
    const { data: agentProfile } = await supabase
      .from('agent_profiles')
      .select('id, display_name, agency_name, phone, email, tenant_id, agent_type, bio, location, specialisations')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!agentProfile) {
      // Fallback: try first profile (for demo/preview)
      const { data: fallback } = await supabase
        .from('agent_profiles')
        .select('id, display_name, agency_name, phone, email, tenant_id, agent_type, bio, location, specialisations')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (!fallback) {
        return NextResponse.json({ error: 'No agent profile found' }, { status: 404 });
      }

      return buildPipelineResponse(supabase, fallback);
    }

    return buildPipelineResponse(supabase, agentProfile);
  } catch (error: any) {
    console.error('[agent/pipeline-data] Error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch pipeline data' }, { status: 500 });
  }
}

async function buildPipelineResponse(supabase: any, agentProfile: any) {
  const tenantId = agentProfile.tenant_id;

  // 4. Get assigned developments
  const { data: assignments } = await supabase
    .from('agent_scheme_assignments')
    .select('development_id')
    .eq('agent_id', agentProfile.id)
    .eq('is_active', true);

  const devIds = (assignments || []).map((a: any) => a.development_id);

  if (devIds.length === 0 && (agentProfile.agent_type || 'scheme') === 'scheme') {
    return NextResponse.json({
      agent: formatAgent(agentProfile),
      developments: [],
      pipeline: [],
      alerts: [],
    });
  }

  // 5. Get development names (service role - no RLS issues)
  const { data: developments } = await supabase
    .from('developments')
    .select('id, name, code, address')
    .in('id', devIds);

  const devNameMap = new Map((developments || []).map((d: any) => [d.id, d.name]));

  // 6. Get all units for these developments
  const { data: allUnits } = await supabase
    .from('units')
    .select('id, unit_number, address, bedrooms, unit_type_id, development_id')
    .eq('tenant_id', tenantId)
    .in('development_id', devIds);

  const unitMap = new Map((allUnits || []).map((u: any) => [u.id, u]));

  // 7. Get pipeline data
  const { data: pipelineData } = await supabase
    .from('unit_sales_pipeline')
    .select(`
      id, unit_id, development_id, status, purchaser_name, purchaser_email, purchaser_phone,
      sale_price, sale_agreed_date, deposit_date, contracts_issued_date,
      signed_contracts_date, counter_signed_date, kitchen_date, kitchen_selected,
      snag_date, estimated_close_date, handover_date, mortgage_expiry_date, comments
    `)
    .eq('tenant_id', tenantId)
    .in('development_id', devIds);

  // 8. Build pipeline units
  const pipelineUnitIds = new Set((pipelineData || []).map((p: any) => p.unit_id));
  const pipeline: any[] = [];

  // Units WITH pipeline records
  for (const p of pipelineData || []) {
    const unit = unitMap.get(p.unit_id);
    const devId = p.development_id || unit?.development_id;
    pipeline.push({
      id: p.id,
      unitId: p.unit_id,
      unitNumber: unit?.unit_number || 'Unknown',
      unitAddress: unit?.address || '',
      developmentId: devId,
      developmentName: devNameMap.get(devId) || '',
      bedrooms: unit?.bedrooms || null,
      unitTypeName: null,
      status: normalizeStatus(p.status || 'for_sale'),
      purchaserName: p.purchaser_name,
      purchaserEmail: p.purchaser_email,
      purchaserPhone: p.purchaser_phone,
      salePrice: p.sale_price ? Number(p.sale_price) : null,
      saleAgreedDate: p.sale_agreed_date,
      depositDate: p.deposit_date,
      contractsIssuedDate: p.contracts_issued_date,
      signedContractsDate: p.signed_contracts_date,
      counterSignedDate: p.counter_signed_date,
      kitchenDate: p.kitchen_date,
      kitchenSelected: p.kitchen_selected,
      snagDate: p.snag_date,
      estimatedCloseDate: p.estimated_close_date,
      handoverDate: p.handover_date,
      mortgageExpiryDate: p.mortgage_expiry_date,
      comments: p.comments,
    });
  }

  // Units WITHOUT pipeline records (available/for_sale)
  for (const u of allUnits || []) {
    if (!pipelineUnitIds.has(u.id)) {
      pipeline.push({
        id: `virtual_${u.id}`,
        unitId: u.id,
        unitNumber: u.unit_number || 'Unknown',
        unitAddress: u.address || '',
        developmentId: u.development_id,
        developmentName: devNameMap.get(u.development_id) || '',
        bedrooms: u.bedrooms || null,
        unitTypeName: null,
        status: 'for_sale',
        purchaserName: null,
        purchaserEmail: null,
        purchaserPhone: null,
        salePrice: null,
        saleAgreedDate: null,
        depositDate: null,
        contractsIssuedDate: null,
        signedContractsDate: null,
        counterSignedDate: null,
        kitchenDate: null,
        kitchenSelected: null,
        snagDate: null,
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

  // 9. Compute alerts
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

function normalizeStatus(status: string): string {
  if (status === 'agreed') return 'sale_agreed';
  if (['for_sale', 'sale_agreed', 'contracts_issued', 'signed', 'sold'].includes(status)) {
    return status;
  }
  return 'for_sale';
}
