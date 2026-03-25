/**
 * POST /api/care/seed — Seed SE Systems demo data
 * Only runs if no installations exist for the tenant.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// 12 installations — Cork area, realistic variety
function buildInstallations(tenantId: string) {
  const now = new Date();

  const records = [
    { ref: 'SES-2023-001', addr: '14 Elm Drive', city: 'Ballincollig', type: 'solar_pv', inverter: 'SolarEdge SE3680H', kwp: 3.6, date: '2023-01-15', status: 'active', portal: 'activated' },
    { ref: 'SES-2023-002', addr: '7 Orchard Close', city: 'Bishopstown', type: 'solar_pv', inverter: 'SolarEdge SE3680H', kwp: 4.2, date: '2023-03-22', status: 'active', portal: 'activated' },
    { ref: 'SES-2023-003', addr: '22 Maple Avenue', city: 'Douglas', type: 'solar_pv', inverter: 'Fronius Primo 5.0', kwp: 5.0, date: '2023-06-10', status: 'active', portal: 'activated' },
    { ref: 'SES-2023-004', addr: '3 Harbour View', city: 'Cobh', type: 'heat_pump', inverter: 'Daikin Altherma 3', kwp: 8.4, date: '2023-08-14', status: 'active', portal: 'activated' },
    { ref: 'SES-2024-005', addr: '18 Riverside Walk', city: 'Carrigaline', type: 'solar_pv', inverter: 'SolarEdge SE3680H', kwp: 3.8, date: '2024-01-09', status: 'active', portal: 'activated' },
    { ref: 'SES-2024-006', addr: '9 Oak Park', city: 'Midleton', type: 'solar_pv', inverter: 'Fronius Primo 5.0', kwp: 5.2, date: '2024-03-18', status: 'active', portal: 'pending' },
    { ref: 'SES-2024-007', addr: '31 Lakeview Crescent', city: 'Togher', type: 'solar_pv', inverter: 'Huawei SUN2000-5KTL', kwp: 5.0, date: '2024-05-25', status: 'active', portal: 'activated' },
    { ref: 'SES-2024-008', addr: '5 Willowbrook', city: 'Wilton', type: 'heat_pump', inverter: 'Grant Aerona3 R32', kwp: 6.5, date: '2024-07-03', status: 'active', portal: 'pending' },
    { ref: 'SES-2024-009', addr: '12 Cherry Blossom Lane', city: 'Ballincollig', type: 'solar_pv', inverter: 'SolarEdge SE3680H', kwp: 4.0, date: '2024-09-12', status: 'active', portal: 'activated' },
    { ref: 'SES-2024-010', addr: '27 The Green', city: 'Douglas', type: 'solar_pv', inverter: 'Fronius Primo 5.0', kwp: 6.0, date: '2024-11-05', status: 'flagged', portal: 'activated' },
    { ref: 'SES-2025-011', addr: '8 Ashwood Gardens', city: 'Midleton', type: 'solar_pv', inverter: 'Huawei SUN2000-5KTL', kwp: 3.5, date: '2025-01-20', status: 'active', portal: 'pending' },
    { ref: 'SES-2025-012', addr: '15 Beechwood Rise', city: 'Carrigaline', type: 'mvhr', inverter: 'Lossnay LGH-25RVX-E', kwp: 0, date: '2025-02-14', status: 'pending', portal: 'pending' },
  ];

  return records.map((r) => {
    const installDate = new Date(r.date);
    const warrantyExpiry = new Date(installDate);
    warrantyExpiry.setFullYear(warrantyExpiry.getFullYear() + 10);

    // Energy: ~900 kWh/kWp/year, prorated by months since install
    const monthsSinceInstall = Math.max(0, (now.getTime() - installDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
    const annualGeneration = r.kwp * 900;
    const totalGenerated = r.type === 'mvhr' ? 0 : Math.round(annualGeneration * (monthsSinceInstall / 12));
    const savings = Math.round(totalGenerated * 0.27);

    return {
      id: randomUUID(),
      tenant_id: tenantId,
      job_reference: r.ref,
      customer_name: `Customer ${String.fromCharCode(65 + records.indexOf(r))}`,
      address_line_1: r.addr,
      city: r.city,
      county: 'Cork',
      system_type: r.type,
      system_size_kwp: r.kwp || null,
      inverter_model: r.inverter,
      install_date: r.date,
      warranty_expiry: warrantyExpiry.toISOString().split('T')[0],
      health_status: r.status === 'flagged' ? 'warning' : 'healthy',
      portal_status: r.portal,
      energy_generated_kwh: totalGenerated,
      savings_eur: savings,
      created_at: installDate.toISOString(),
      updated_at: now.toISOString(),
    };
  });
}

export async function POST() {
  const supabase = getSupabaseAdmin();

  // Find SE Systems tenant
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name')
    .or('name.ilike.%SE Systems%,name.ilike.%se systems%')
    .limit(1);

  let tenantId: string;

  if (tenants && tenants.length > 0) {
    tenantId = tenants[0].id;
  } else {
    // Fallback: get the first tenant
    const { data: fallback } = await supabase
      .from('tenants')
      .select('id')
      .limit(1)
      .single();

    if (!fallback) {
      return NextResponse.json({ error: 'No tenants found' }, { status: 404 });
    }
    tenantId = fallback.id;
  }

  // Check if data already exists
  const { count } = await supabase
    .from('installations')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .not('job_reference', 'is', null);

  if (count && count >= 12) {
    return NextResponse.json({ message: 'Demo data already seeded', tenantId, count });
  }

  // Seed installations
  const installations = buildInstallations(tenantId);
  const { error: instError } = await supabase.from('installations').upsert(installations, { onConflict: 'job_reference' });

  if (instError) {
    console.error('[Seed] Installation insert error:', instError);
    return NextResponse.json({ error: instError.message }, { status: 500 });
  }

  // Seed support_queries table (create if needed)
  const supportQueries = [
    {
      id: randomUUID(),
      tenant_id: tenantId,
      installation_id: installations[9].id, // SES-2024-010 (flagged)
      customer_ref: 'Customer J',
      address: '27 The Green, Douglas',
      query_type: 'Inverter Error Code',
      query_status: 'open',
      description: 'Fronius Primo showing error code 567 intermittently since last Thursday.',
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: randomUUID(),
      tenant_id: tenantId,
      installation_id: installations[5].id, // SES-2024-006 (pending portal)
      customer_ref: 'Customer F',
      address: '9 Oak Park, Midleton',
      query_type: 'Portal Access',
      query_status: 'open',
      description: 'Customer unable to log in to their homeowner portal. Says activation link has expired.',
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: randomUUID(),
      tenant_id: tenantId,
      installation_id: installations[3].id, // SES-2023-004 (heat pump)
      customer_ref: 'Customer D',
      address: '3 Harbour View, Cobh',
      query_type: 'Warranty Query',
      query_status: 'in_progress',
      description: 'Asking about warranty coverage for compressor replacement. Daikin unit installed Aug 2023.',
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: randomUUID(),
      tenant_id: tenantId,
      installation_id: installations[6].id, // SES-2024-007
      customer_ref: 'Customer G',
      address: '31 Lakeview Crescent, Togher',
      query_type: 'App Not Loading',
      query_status: 'resolved',
      description: 'Homeowner app was showing blank screen. Resolved — they needed to update the app.',
      created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const { error: sqError } = await supabase.from('support_queries').insert(supportQueries);
  if (sqError) {
    console.error('[Seed] Support queries insert error:', sqError);
    // Non-fatal: table might not exist yet
  }

  // Seed diagnostic_flows table
  const diagnosticFlows = [
    {
      id: randomUUID(),
      tenant_id: tenantId,
      flow_name: 'Inverter Red Light / Error Code',
      system_type: 'solar_pv',
      step_count: 6,
      times_triggered: 14,
      created_at: new Date('2024-06-01').toISOString(),
      updated_at: new Date('2025-03-10').toISOString(),
    },
    {
      id: randomUUID(),
      tenant_id: tenantId,
      flow_name: 'No Hot Water',
      system_type: 'heat_pump',
      step_count: 5,
      times_triggered: 7,
      created_at: new Date('2024-08-15').toISOString(),
      updated_at: new Date('2025-02-22').toISOString(),
    },
    {
      id: randomUUID(),
      tenant_id: tenantId,
      flow_name: 'Battery Not Charging',
      system_type: 'solar_pv',
      step_count: 4,
      times_triggered: 9,
      created_at: new Date('2024-11-01').toISOString(),
      updated_at: new Date('2025-03-18').toISOString(),
    },
  ];

  const { error: dfError } = await supabase.from('diagnostic_flows').insert(diagnosticFlows);
  if (dfError) {
    console.error('[Seed] Diagnostic flows insert error:', dfError);
  }

  return NextResponse.json({
    message: 'Demo data seeded successfully',
    tenantId,
    installations: installations.length,
    supportQueries: supportQueries.length,
    diagnosticFlows: diagnosticFlows.length,
  });
}
