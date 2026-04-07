import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface PipelineRow {
  id: string;
  unit_id: string;
  development_id: string | null;
  purchaser_name: string | null;
  purchaser_phone: string | null;
  purchaser_email: string | null;
  sale_price: string | number | null;
  handover_date: string | null;
  counter_signed_date: string | null;
  signed_contracts_date: string | null;
  contracts_issued_date: string | null;
  deposit_date: string | null;
  sale_agreed_date: string | null;
  estimated_close_date: string | null;
  snag_date: string | null;
  drawdown_date: string | null;
  mortgage_expiry_date: string | null;
  kitchen_selected: boolean | null;
  kitchen_date: string | null;
  comments: string | null;
}

interface UnitRow {
  id: string;
  unit_number: string | null;
  unit_uid: string | null;
  house_type_code: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  eircode: string | null;
  development_id: string | null;
  purchaser_name: string | null;
  address_line_1: string | null;
  city: string | null;
  metadata: Record<string, unknown> | null;
}

interface DevRow {
  id: string;
  name: string;
  code: string;
  address: string | null;
  is_active: boolean;
}

interface CommRow {
  unit_id: string;
  created_at: string;
  type: string;
  direction: string;
  summary: string | null;
  actor_name: string | null;
}

interface Buyer {
  id: string;
  unitId: string;
  name: string;
  initials: string;
  unit: string;
  scheme: string;
  schemeId: string;
  type: string;
  beds: number;
  bathrooms: number;
  eircode: string | null;
  price: number;
  status: string;
  daysOverdue: number;
  isUrgent: boolean;
  phone: string;
  email: string;
  address: string;
  saleAgreedDate: string | null;
  depositDate: string | null;
  contractsIssuedDate: string | null;
  contractsSignedDate: string | null;
  snagDate: string | null;
  estimatedCloseDate: string | null;
  handoverDate: string | null;
  kitchenSelected: boolean;
  kitchenDate: string | null;
  drawdownDate: string | null;
  mortgageExpiry: string | null;
  comments: string | null;
  recentComms: { date: string; type: string; direction: string; summary: string | null; actor: string | null }[];
}

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

    let comms: CommRow[] = [];
    if (unitIds.length > 0) {
      const { data: commsData } = await supabase
        .from('communication_events')
        .select('unit_id, created_at, type, direction, summary, actor_name')
        .eq('tenant_id', tenantId)
        .in('unit_id', unitIds)
        .gte('created_at', ninetyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(200);
      comms = (commsData || []) as CommRow[];
    }

    // Group comms by unit_id
    const commsByUnit = new Map<string, CommRow[]>();
    for (const c of comms) {
      if (!commsByUnit.has(c.unit_id)) commsByUnit.set(c.unit_id, []);
      commsByUnit.get(c.unit_id)!.push(c);
    }

    // 5. Build buyer profiles from pipeline data
    const now = new Date();
    const buyers: Buyer[] = (pipeline || []).map((p: PipelineRow) => {
      const unit = unitMap.get(p.unit_id) as UnitRow | undefined;
      const dev = devMap.get(p.development_id || unit?.development_id || '') as DevRow | undefined;

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
        recentComms: unitComms.slice(0, 5).map((c) => ({
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
      const devBuyers = buyers.filter((b) => b.schemeId === dev.id);
      const devUnits = (units || []).filter((u) => u.development_id === dev.id);
      const totalUnits = devUnits.length;

      const sold = devBuyers.filter((b) => b.status === 'sold').length;
      const contractsSigned = devBuyers.filter((b) => b.status === 'contracts_signed').length;
      const contractsOut = devBuyers.filter((b) => b.status === 'contracts_out').length;
      const reserved = devBuyers.filter((b) => b.status === 'reserved' || b.status === 'sale_agreed').length;
      const assigned = devBuyers.length;
      const available = Math.max(0, totalUnits - assigned);

      const percentSold = totalUnits > 0 ? Math.round((sold / totalUnits) * 100) : 0;
      const urgentCount = devBuyers.filter((b) => b.isUrgent).length;
      const revenue = devBuyers.reduce((sum, b) => sum + b.price, 0);

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
        activeBuyers: devBuyers.filter((b) => b.status !== 'sold' && b.status !== 'available').length,
        urgentCount,
        revenue,
      };
    });

    return NextResponse.json({ schemes, buyers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[agent/pipeline] Error', error);
    return NextResponse.json(
      { error: 'Failed to fetch pipeline data', detail: message },
      { status: 500 }
    );
  }
}
