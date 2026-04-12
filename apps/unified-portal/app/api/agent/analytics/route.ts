import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Get agent profile
    const { data: profile } = await supabase
      .from('agent_profiles')
      .select('id, tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'No agent profile' }, { status: 403 });
    }

    // Get assigned developments
    const { data: assignments } = await supabase
      .from('agent_scheme_assignments')
      .select('development_id')
      .eq('agent_id', profile.id)
      .eq('is_active', true);

    const developmentIds = (assignments ?? []).map(a => a.development_id);

    if (developmentIds.length === 0) {
      return NextResponse.json({ pipeline: [], developments: [] });
    }

    // Get pipeline data
    const { data: pipelineData } = await supabase
      .from('unit_sales_pipeline')
      .select(`
        id, unit_id, development_id, status, sale_price,
        purchaser_name, purchaser_email, purchaser_phone,
        sale_agreed_date, deposit_date, contracts_issued_date,
        signed_contracts_date, counter_signed_date,
        drawdown_date, handover_date, estimated_close_date,
        units(unit_number, bedrooms, unit_type),
        developments(name)
      `)
      .in('development_id', developmentIds);

    // Get developments
    const { data: devs } = await supabase
      .from('developments')
      .select('id, name, address')
      .in('id', developmentIds);

    // Transform pipeline
    const pipeline = (pipelineData ?? []).map((p: any) => ({
      id: p.id,
      unitId: p.unit_id,
      unitNumber: p.units?.unit_number || '',
      developmentId: p.development_id,
      developmentName: p.developments?.name || '',
      bedrooms: p.units?.bedrooms || 0,
      status: p.status,
      purchaserName: p.purchaser_name || '',
      prices: { sale: p.sale_price ? Number(p.sale_price) : 0 },
      dates: {
        saleAgreed: p.sale_agreed_date,
        deposit: p.deposit_date,
        contractsIssued: p.contracts_issued_date,
        contractsSigned: p.signed_contracts_date,
        counterSigned: p.counter_signed_date,
        drawdown: p.drawdown_date,
        handover: p.handover_date,
        estimatedClose: p.estimated_close_date,
      },
    }));

    return NextResponse.json({
      pipeline,
      developments: devs ?? [],
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
