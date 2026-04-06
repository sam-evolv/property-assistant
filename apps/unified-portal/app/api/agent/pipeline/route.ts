import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/agent/pipeline
 *
 * Returns all schemes (developments) with their units and pipeline data.
 * Query params:
 *   - tenant_id (required): the tenant to scope to
 *   - scheme_id (optional): filter to a single development
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id');
    const schemeId = searchParams.get('scheme_id');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 1. Get developments (schemes)
    let devQuery = supabase
      .from('developments')
      .select('id, name, code, address, is_active')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name');

    if (schemeId) {
      devQuery = devQuery.eq('id', schemeId);
    }

    const { data: developments, error: devError } = await devQuery;
    if (devError) throw devError;
    if (!developments?.length) {
      return NextResponse.json({ schemes: [], buyers: [] });
    }

    const devIds = developments.map((d) => d.id);
    const devMap = new Map(developments.map((d) => [d.id, d]));

    // 2. Get all units for these developments
    const { data: units, error: unitError } = await supabase
      .from('units')
      .select('id, unit_number, unit_uid, house_type_code, bedrooms, bathrooms, eircode, development_id, purchaser_name, address_line_1, city, metadata')
      .eq('tenant_id', tenantId)
      .in('development_id', devIds);

    if (unitError) throw unitError;

    const unitMap = new Map((units || []).map((u) => [u.id, u]));

    // 3. Get pipeline data
    const { data: pipeline, error: pipeError } = await supabase
      .from('unit_sales_pipeline')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('development_id', devIds);

    if (pipeError) throw pipeError;

    // 4. Get communication events for context (last 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
    const unitIds = (units || []).map((u) => u.id);

    let comms: any[] = [];
    if (unitIds.length > 0) {
      const { data: commsData } = await supabase
        .from('communication_events')
        .select('unit_id, created_at, type, direction, summary, actor_name')
        .eq('tenant_id', tenantId)
        .in('unit_id', unitIds)
        .gte('created_at', ninetyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(200);
      comms = commsData || [];
    }

    // Group comms by unit_id
    const commsByUnit = new Map<string, any[]>();
    for (const c of comms) {
      if (!commsByUnit.has(c.unit_id)) commsByUnit.set(c.unit_id, []);
      commsByUnit.get(c.unit_id)!.push(c);
    }

    // 5. Build buyer profiles from pipeline data
    const now = new Date();
    const buyers = (pipeline || []).map((p: any) => {
      const unit: any = unitMap.get(p.unit_id);
      const dev: any = devMap.get(p.development_id || unit?.development_id);

      // Determine status
      let status = 'available';
      let daysOverdue = 0;
      let isUrgent = false;

      if (p.handover_date && new Date(p.handover_date) <= now) {
        status = 'sold';
      } else if (p.counter_signed_date || p.signed_contracts_date) {
        status = 'contracts_signed';
      } else if (p.contracts_issued_date) {
        status = 'contracts_out';
        daysOverdue = Math.floor((now.getTime() - new Date(p.contracts_issued_date).getTime()) / 86400000);
        isUrgent = daysOverdue > 30;
      } else if (p.deposit_date) {
        status = 'reserved';
      } else if (p.sale_agreed_date) {
        status = 'sale_agreed';
      }

      // Build initials
      const name = p.purchaser_name || unit?.purchaser_name || '';
      const parts = name.split(/[\s&]+/).filter(Boolean);
      const initials = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : (parts[0]?.[0] || '?').toUpperCase();

      const unitComms = commsByUnit.get(p.unit_id) || [];

      return {
        id: p.id,
        unitId: p.unit_id,
        name: name,
        initials,
        unit: unit?.unit_number ? `Unit ${unit.unit_number}` : unit?.unit_uid || 'Unknown',
        scheme: dev?.name || 'Unknown',
        schemeId: dev?.id || p.development_id,
        type: unit?.house_type_code || '',
        beds: unit?.bedrooms || 0,
        bathrooms: unit?.bathrooms || 0,
        eircode: unit?.eircode || null,
        price: Number(p.sale_price) || 0,
        status,
        daysOverdue,
        isUrgent,

        // Contact
        phone: p.purchaser_phone || '',
        email: p.purchaser_email || '',
        address: unit?.address_line_1 ? `${unit.address_line_1}${unit.city ? ', ' + unit.city : ''}` : '',

        // Dates
        saleAgreedDate: p.sale_agreed_date || null,
        depositDate: p.deposit_date || null,
        contractsIssuedDate: p.contracts_issued_date || null,
        contractsSignedDate: p.signed_contracts_date || p.counter_signed_date || null,
        snagDate: p.snag_date || null,
        estimatedCloseDate: p.estimated_close_date || null,
        handoverDate: p.handover_date || null,
        kitchenSelected: p.kitchen_selected || false,
        kitchenDate: p.kitchen_date || null,
        drawdownDate: p.drawdown_date || null,

        // Mortgage
        mortgageExpiry: p.mortgage_expiry_date || null,

        // Comments
        comments: p.comments || null,

        // Communication history (intelligence context)
        recentComms: unitComms.slice(0, 5).map((c: any) => ({
          date: c.created_at,
          type: c.type,
          direction: c.direction,
          summary: c.summary,
          actor: c.actor_name,
        })),
      };
    });

    // 6. Build scheme summaries
    const schemes = developments.map((dev) => {
      const devBuyers = buyers.filter((b: any) => b.schemeId === dev.id);
      const devUnits = (units || []).filter((u) => u.development_id === dev.id);
      const totalUnits = devUnits.length;

      const sold = devBuyers.filter((b: any) => b.status === 'sold').length;
      const contractsSigned = devBuyers.filter((b: any) => b.status === 'contracts_signed').length;
      const contractsOut = devBuyers.filter((b: any) => b.status === 'contracts_out').length;
      const reserved = devBuyers.filter((b: any) => b.status === 'reserved' || b.status === 'sale_agreed').length;
      const assigned = devBuyers.length;
      const available = Math.max(0, totalUnits - assigned);

      const percentSold = totalUnits > 0 ? Math.round((sold / totalUnits) * 100) : 0;
      const urgentCount = devBuyers.filter((b: any) => b.isUrgent).length;
      const revenue = devBuyers.reduce((sum: number, b: any) => sum + b.price, 0);

      return {
        id: dev.id,
        name: dev.name,
        code: dev.code,
        address: dev.address,
        totalUnits,
        sold,
        contractsSigned,
        contractsOut,
        reserved,
        available,
        percentSold,
        activeBuyers: devBuyers.filter((b: any) => b.status !== 'sold' && b.status !== 'available').length,
        urgentCount,
        revenue,
      };
    });

    return NextResponse.json({ schemes, buyers });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch pipeline data', detail: error.message },
      { status: 500 }
    );
  }
}
