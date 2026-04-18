import { SupabaseClient } from '@supabase/supabase-js';
import { AgentContext } from './types';
import { isInRPZ } from './rpz-zones';

export interface AgentProfileExtras {
  agencyName: string | null;
  agentEmail: string | null;
}

export interface AgedContract {
  unitId: string | null;
  unitNumber: string;
  schemeName: string;
  purchaserName: string;
  daysAged: number;
  contractsIssuedDate: string;
}

export interface SalesPipelineSummary {
  perScheme: Array<{
    schemeName: string;
    counts: Record<string, number>;
    total: number;
  }>;
  totalUnits: number;
  totalSold: number;
  totalContractsIssued: number;
  totalSaleAgreed: number;
  totalAvailable: number;
}

export interface LettingsSummary {
  total: number;
  let: number;
  vacant: number;
  activeTenancies: number;
  monthlyRentRoll: number;
  properties: Array<{
    id: string;
    address: string;
    city: string | null;
    status: string;
    rent: number | null;
  }>;
}

export interface RenewalWindowTenancy {
  tenancyId: string;
  tenantName: string;
  propertyAddress: string;
  propertyCity: string | null;
  leaseEnd: string;
  daysOut: number;
  currentRent: number | null;
  isRpz: boolean;
  status: string;
}

export interface RentArrearsRecord {
  tenancyId: string;
  tenantName: string;
  propertyAddress: string;
  note: string;
}

export interface ViewingRow {
  id: string;
  buyerName: string;
  schemeName: string;
  unitRef: string | null;
  viewingDate: string;
  viewingTime: string | null;
  status: string;
  buyerEmail: string | null;
  buyerPhone: string | null;
}

/**
 * Load the agent profile and assigned schemes for the authenticated user.
 */
export async function loadAgentContext(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<AgentContext | null> {
  // Get agent profile
  const { data: profile } = await supabase
    .from('agent_profiles')
    .select('id, display_name')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  // Get assigned schemes with unit counts
  const { data: assignments } = await supabase
    .from('agent_scheme_assignments')
    .select('development_id')
    .eq('agent_id', profile.id)
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  const developmentIds = (assignments || []).map((a: any) => a.development_id);

  let assignedSchemes: AgentContext['assignedSchemes'] = [];

  if (developmentIds.length > 0) {
    const { data: devs } = await supabase
      .from('developments')
      .select('id, name, county')
      .in('id', developmentIds);

    // Get developer (tenant) name
    let developerName: string | null = null;
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .maybeSingle();
    if (tenant) developerName = tenant.name;

    // Get unit counts per development
    const schemesWithCounts = await Promise.all(
      (devs || []).map(async (dev: any) => {
        const { count } = await supabase
          .from('units')
          .select('id', { count: 'exact', head: true })
          .eq('development_id', dev.id)
          .eq('tenant_id', tenantId);

        return {
          developmentId: dev.id,
          schemeName: dev.name,
          unitCount: count || 0,
          location: dev.county || null,
          developerName: developerName || null,
        };
      })
    );

    assignedSchemes = schemesWithCounts;
  }

  return {
    agentId: profile.id,
    userId,
    tenantId,
    displayName: profile.display_name,
    assignedSchemes,
  };
}

/**
 * Build a summary of recent activity across assigned schemes (last 7 days).
 */
export async function getRecentActivitySummary(
  supabase: SupabaseClient,
  tenantId: string,
  agentContext: AgentContext
): Promise<string> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const devIds = agentContext.assignedSchemes.map(s => s.developmentId);

  if (!devIds.length) return 'No schemes assigned.';

  // Get pipeline activity counts
  const { data: pipeline } = await supabase
    .from('unit_sales_pipeline')
    .select('sale_agreed_date, contracts_issued_date, signed_contracts_date, counter_signed_date, handover_date')
    .eq('tenant_id', tenantId)
    .in('development_id', devIds);

  let newSaleAgreed = 0;
  let contractsIssued = 0;
  let contractsReturned = 0;
  let unitsClosed = 0;

  for (const p of pipeline || []) {
    if (p.sale_agreed_date && p.sale_agreed_date >= sevenDaysAgo) newSaleAgreed++;
    if (p.contracts_issued_date && p.contracts_issued_date >= sevenDaysAgo) contractsIssued++;
    if ((p.signed_contracts_date && p.signed_contracts_date >= sevenDaysAgo) ||
        (p.counter_signed_date && p.counter_signed_date >= sevenDaysAgo)) contractsReturned++;
    if (p.handover_date && p.handover_date >= sevenDaysAgo) unitsClosed++;
  }

  // Get communication event count
  const { count: commsCount } = await supabase
    .from('communication_events')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .in('development_id', devIds)
    .gte('created_at', sevenDaysAgo);

  // Get overdue tasks
  const { count: overdueTasks } = await supabase
    .from('agent_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', agentContext.agentId)
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'in_progress'])
    .lt('due_date', new Date().toISOString());

  const lines = [
    `${newSaleAgreed} units gone sale agreed`,
    `${contractsIssued} contracts issued`,
    `${contractsReturned} contracts returned/signed`,
    `${unitsClosed} units closed/handed over`,
    `${commsCount || 0} communications logged`,
    `${overdueTasks || 0} overdue tasks`,
  ];

  return lines.map(l => `- ${l}`).join('\n');
}

/**
 * Get upcoming deadlines across assigned schemes (next 14 days).
 */
export async function getUpcomingDeadlines(
  supabase: SupabaseClient,
  tenantId: string,
  agentContext: AgentContext
): Promise<string> {
  const devIds = agentContext.assignedSchemes.map(s => s.developmentId);
  if (!devIds.length) return 'No schemes assigned.';

  const fourteenDaysFromNow = new Date(Date.now() + 14 * 86400000).toISOString();

  // Get upcoming tasks
  const { data: tasks } = await supabase
    .from('agent_tasks')
    .select('title, due_date, priority')
    .eq('agent_id', agentContext.agentId)
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'in_progress'])
    .lte('due_date', fourteenDaysFromNow)
    .order('due_date', { ascending: true })
    .limit(10);

  // Get upcoming handovers
  const { data: handovers } = await supabase
    .from('unit_sales_pipeline')
    .select('purchaser_name, handover_date, unit_id')
    .eq('tenant_id', tenantId)
    .in('development_id', devIds)
    .gte('handover_date', new Date().toISOString())
    .lte('handover_date', fourteenDaysFromNow)
    .order('handover_date', { ascending: true })
    .limit(10);

  const lines: string[] = [];

  for (const t of tasks || []) {
    lines.push(`- [${t.priority?.toUpperCase() || 'MEDIUM'}] Task: ${t.title} — due ${new Date(t.due_date).toLocaleDateString('en-IE')}`);
  }

  for (const h of handovers || []) {
    lines.push(`- Handover: ${h.purchaser_name || 'Unknown buyer'} — ${new Date(h.handover_date).toLocaleDateString('en-IE')}`);
  }

  return lines.length ? lines.join('\n') : 'No deadlines in the next 14 days.';
}

/**
 * Get today's and tomorrow's viewings for the agent (injected into system prompt).
 */
export async function getViewingsSummary(
  supabase: SupabaseClient,
  agentContext: AgentContext
): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const { data: viewings } = await supabase
    .from('agent_viewings')
    .select('buyer_name, scheme_name, unit_ref, viewing_date, viewing_time, status, notes')
    .eq('agent_id', agentContext.agentId)
    .in('viewing_date', [today, tomorrow])
    .in('status', ['confirmed', 'pending'])
    .order('viewing_date', { ascending: true })
    .order('viewing_time', { ascending: true });

  if (!viewings?.length) return 'No viewings scheduled for today or tomorrow.';

  const todayViewings = viewings.filter((v: any) => v.viewing_date === today);
  const tomorrowViewings = viewings.filter((v: any) => v.viewing_date === tomorrow);

  const formatViewing = (v: any) => {
    const time = v.viewing_time ? ` at ${v.viewing_time}` : '';
    const unit = v.unit_ref ? `, Unit ${v.unit_ref}` : '';
    const status = v.status === 'pending' ? ' (PENDING CONFIRMATION)' : '';
    return `- ${v.buyer_name}${time} — ${v.scheme_name}${unit}${status}`;
  };

  const lines: string[] = [];
  if (todayViewings.length) {
    lines.push(`TODAY (${todayViewings.length}):`);
    lines.push(...todayViewings.map(formatViewing));
  }
  if (tomorrowViewings.length) {
    lines.push(`TOMORROW (${tomorrowViewings.length}):`);
    lines.push(...tomorrowViewings.map(formatViewing));
  }

  return lines.join('\n');
}

/**
 * Load cross-session entity memory for mentioned entities.
 */
export async function loadEntityMemory(
  supabase: SupabaseClient,
  agentId: string,
  message: string
): Promise<string> {
  // Extract potential entity references from the message
  // Only match on substantial terms (3+ chars) to avoid false positives on common words
  const words = message.toLowerCase().split(/\s+/).filter(w => w.length >= 3);

  // Skip entity memory for generic queries that don't reference specific entities
  const genericPatterns = ['overview', 'outstanding', 'update', 'report', 'what\'s', 'whats', 'summary', 'briefing', 'this week', 'today'];
  const isGenericQuery = genericPatterns.some(p => message.toLowerCase().includes(p)) &&
    !words.some(w => /\d+/.test(w)); // Allow if there's a unit number

  if (isGenericQuery) return '';

  // Look for recent conversations about any mentioned names or unit numbers
  const { data: recentConversations } = await supabase
    .from('intelligence_conversations')
    .select('content, created_at, entities_mentioned')
    .eq('agent_id', agentId)
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(20);

  if (!recentConversations?.length) return '';

  // Filter conversations that mention any of the same entities
  // Require at least a 4-character match to avoid false positives
  const relevant = recentConversations.filter((conv: any) => {
    if (!conv.entities_mentioned) return false;
    const entities = conv.entities_mentioned as any;
    const allEntityNames = [
      ...(entities.buyers || []),
      ...(entities.units || []),
      ...(entities.schemes || []),
    ].map((e: string) => e.toLowerCase());

    return words.some(w => w.length >= 4 && allEntityNames.some(e => e.includes(w) || w.includes(e)));
  });

  if (!relevant.length) return '';

  return relevant
    .slice(0, 5)
    .map((r: any) => `- On ${new Date(r.created_at).toLocaleDateString('en-IE')}: ${r.content.slice(0, 200)}`)
    .join('\n');
}

export async function getAgentProfileExtras(
  supabase: SupabaseClient,
  agentId: string
): Promise<AgentProfileExtras> {
  const { data } = await supabase
    .from('agent_profiles')
    .select('agency_name, email')
    .eq('id', agentId)
    .maybeSingle();

  return {
    agencyName: data?.agency_name ?? null,
    agentEmail: data?.email ?? null,
  };
}

export async function getAgedContracts(
  supabase: SupabaseClient,
  tenantId: string,
  agentContext: AgentContext,
  thresholdDays = 42
): Promise<AgedContract[]> {
  const devIds = agentContext.assignedSchemes.map(s => s.developmentId);
  if (!devIds.length) return [];

  const cutoff = new Date(Date.now() - thresholdDays * 86400000).toISOString();

  const { data } = await supabase
    .from('unit_sales_pipeline')
    .select('unit_id, development_id, purchaser_name, contracts_issued_date, signed_contracts_date, counter_signed_date')
    .eq('tenant_id', tenantId)
    .in('development_id', devIds)
    .not('contracts_issued_date', 'is', null)
    .is('signed_contracts_date', null)
    .lt('contracts_issued_date', cutoff);

  if (!data?.length) return [];

  const schemeNameById = new Map(agentContext.assignedSchemes.map(s => [s.developmentId, s.schemeName]));
  const unitIds = data.map((p: any) => p.unit_id).filter(Boolean);

  const { data: units } = await supabase
    .from('units')
    .select('id, unit_number, unit_uid')
    .in('id', unitIds);

  const unitById = new Map((units || []).map((u: any) => [u.id, u]));

  const now = Date.now();
  return data
    .filter((p: any) => !p.counter_signed_date)
    .map((p: any) => {
      const issued = new Date(p.contracts_issued_date);
      const unit = unitById.get(p.unit_id);
      return {
        unitId: p.unit_id,
        unitNumber: unit?.unit_number || unit?.unit_uid || 'unknown',
        schemeName: schemeNameById.get(p.development_id) || 'Unknown scheme',
        purchaserName: p.purchaser_name || 'Unknown purchaser',
        daysAged: Math.floor((now - issued.getTime()) / 86400000),
        contractsIssuedDate: p.contracts_issued_date,
      };
    })
    .sort((a, b) => b.daysAged - a.daysAged);
}

export async function getSalesPipelineSummary(
  supabase: SupabaseClient,
  tenantId: string,
  agentContext: AgentContext
): Promise<SalesPipelineSummary> {
  const devIds = agentContext.assignedSchemes.map(s => s.developmentId);
  if (!devIds.length) {
    return { perScheme: [], totalUnits: 0, totalSold: 0, totalContractsIssued: 0, totalSaleAgreed: 0, totalAvailable: 0 };
  }

  const { data: pipeline } = await supabase
    .from('unit_sales_pipeline')
    .select('development_id, status, sale_agreed_date, contracts_issued_date, signed_contracts_date, counter_signed_date, handover_date')
    .eq('tenant_id', tenantId)
    .in('development_id', devIds);

  const { data: units } = await supabase
    .from('units')
    .select('id, development_id')
    .eq('tenant_id', tenantId)
    .in('development_id', devIds);

  const unitsByDev: Record<string, number> = {};
  for (const u of units || []) {
    unitsByDev[u.development_id] = (unitsByDev[u.development_id] || 0) + 1;
  }

  const now = new Date();
  const perScheme = agentContext.assignedSchemes.map(s => {
    const rows = (pipeline || []).filter((p: any) => p.development_id === s.developmentId);
    const counts: Record<string, number> = { sold: 0, signed: 0, contracts_issued: 0, sale_agreed: 0, available: 0 };
    for (const p of rows) {
      const status = (p.status || '').toLowerCase();
      if (status === 'sold' || status === 'complete' || (p.handover_date && new Date(p.handover_date) <= now)) counts.sold++;
      else if (status === 'signed' || p.counter_signed_date || p.signed_contracts_date) counts.signed++;
      else if (status === 'contracts_issued' || p.contracts_issued_date) counts.contracts_issued++;
      else if (status === 'sale_agreed' || status === 'agreed' || p.sale_agreed_date) counts.sale_agreed++;
      else counts.available++;
    }
    const pipelineCount = rows.length;
    const totalUnits = unitsByDev[s.developmentId] ?? pipelineCount;
    if (totalUnits > pipelineCount) counts.available += totalUnits - pipelineCount;

    return { schemeName: s.schemeName, counts, total: totalUnits };
  });

  const totalUnits = perScheme.reduce((a, s) => a + s.total, 0);
  const totalSold = perScheme.reduce((a, s) => a + s.counts.sold, 0);
  const totalContractsIssued = perScheme.reduce((a, s) => a + s.counts.contracts_issued, 0);
  const totalSaleAgreed = perScheme.reduce((a, s) => a + s.counts.sale_agreed, 0);
  const totalAvailable = perScheme.reduce((a, s) => a + s.counts.available, 0);

  return { perScheme, totalUnits, totalSold, totalContractsIssued, totalSaleAgreed, totalAvailable };
}

export async function getLettingsSummary(
  supabase: SupabaseClient,
  agentId: string
): Promise<LettingsSummary> {
  const empty: LettingsSummary = {
    total: 0, let: 0, vacant: 0, activeTenancies: 0, monthlyRentRoll: 0, properties: [],
  };

  const { data: properties, error } = await supabase
    .from('agent_letting_properties')
    .select('id, agent_id, address, city, status, rent_pcm')
    .eq('agent_id', agentId);

  if (error || !properties) return empty;

  const total = properties.length;
  const let_ = properties.filter((p: any) => ['let', 'occupied', 'tenanted'].includes((p.status || '').toLowerCase())).length;
  const vacant = properties.filter((p: any) => ['vacant', 'available', 'empty'].includes((p.status || '').toLowerCase())).length;

  const { data: tenancies } = await supabase
    .from('agent_tenancies')
    .select('id, agent_id, letting_property_id, status, rent_pcm')
    .eq('agent_id', agentId)
    .eq('status', 'active');

  const activeTenancies = tenancies?.length ?? 0;
  const monthlyRentRoll = (tenancies || []).reduce((sum: number, t: any) => {
    const rent = Number(t.rent_pcm ?? 0);
    return sum + (Number.isFinite(rent) ? rent : 0);
  }, 0);

  return {
    total,
    let: let_,
    vacant,
    activeTenancies,
    monthlyRentRoll,
    properties: properties.map((p: any) => ({
      id: p.id,
      address: p.address,
      city: p.city ?? null,
      status: p.status ?? 'unknown',
      rent: Number(p.rent_pcm ?? 0) || null,
    })),
  };
}

export async function getRenewalWindow(
  supabase: SupabaseClient,
  agentId: string
): Promise<RenewalWindowTenancy[]> {
  const today = new Date();
  const todayIso = today.toISOString().split('T')[0];
  const ninetyIso = new Date(today.getTime() + 90 * 86400000).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('agent_tenancies')
    .select('id, agent_id, letting_property_id, tenant_name, tenant_email, lease_end, status, rent_pcm, notes')
    .eq('agent_id', agentId)
    .eq('status', 'active')
    .gte('lease_end', todayIso)
    .lte('lease_end', ninetyIso);

  if (error || !data?.length) return [];

  const propertyIds = Array.from(new Set(data.map((t: any) => t.letting_property_id).filter(Boolean)));
  const propertyById = new Map<string, { address: string; city: string | null }>();
  if (propertyIds.length) {
    const { data: props } = await supabase
      .from('agent_letting_properties')
      .select('id, address, city')
      .in('id', propertyIds);
    for (const p of props || []) propertyById.set(p.id, { address: p.address, city: p.city ?? null });
  }

  return data
    .map((t: any) => {
      const leaseEnd = new Date(t.lease_end);
      const daysOut = Math.ceil((leaseEnd.getTime() - today.getTime()) / 86400000);
      const prop = propertyById.get(t.letting_property_id);
      return {
        tenancyId: t.id,
        tenantName: t.tenant_name || 'Unknown tenant',
        propertyAddress: prop?.address || 'Unknown property',
        propertyCity: prop?.city ?? null,
        leaseEnd: t.lease_end,
        daysOut,
        currentRent: Number(t.rent_pcm ?? 0) || null,
        isRpz: isInRPZ(prop?.city),
        status: t.status,
      };
    })
    .sort((a, b) => a.daysOut - b.daysOut);
}

// Demo-only rent arrears scan: we look for tenancies whose notes contain
// the word "overdue". A proper `rent_payments` ledger should replace this in
// a future session so we can compute days-overdue and amounts precisely.
export async function getRentArrears(
  supabase: SupabaseClient,
  agentId: string
): Promise<RentArrearsRecord[]> {
  const { data, error } = await supabase
    .from('agent_tenancies')
    .select('id, agent_id, letting_property_id, tenant_name, notes, status')
    .eq('agent_id', agentId)
    .eq('status', 'active')
    .ilike('notes', '%overdue%');

  if (error || !data?.length) return [];

  const propertyIds = Array.from(new Set(data.map((t: any) => t.letting_property_id).filter(Boolean)));
  const addressById = new Map<string, string>();
  if (propertyIds.length) {
    const { data: props } = await supabase
      .from('agent_letting_properties')
      .select('id, address')
      .in('id', propertyIds);
    for (const p of props || []) addressById.set(p.id, p.address);
  }

  return data.map((t: any) => ({
    tenancyId: t.id,
    tenantName: t.tenant_name || 'Unknown tenant',
    propertyAddress: addressById.get(t.letting_property_id) || 'Unknown property',
    note: t.notes || '',
  }));
}

export async function getTodaysViewings(
  supabase: SupabaseClient,
  agentId: string
): Promise<ViewingRow[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('agent_viewings')
    .select('id, buyer_name, scheme_name, unit_ref, viewing_date, viewing_time, status, buyer_email, buyer_phone')
    .eq('agent_id', agentId)
    .eq('viewing_date', today)
    .order('viewing_time', { ascending: true });

  return (data || []).map((v: any) => ({
    id: v.id,
    buyerName: v.buyer_name,
    schemeName: v.scheme_name,
    unitRef: v.unit_ref ?? null,
    viewingDate: v.viewing_date,
    viewingTime: v.viewing_time ?? null,
    status: v.status,
    buyerEmail: v.buyer_email ?? null,
    buyerPhone: v.buyer_phone ?? null,
  }));
}

export async function getUpcomingWeekViewings(
  supabase: SupabaseClient,
  agentId: string
): Promise<ViewingRow[]> {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
  const weekOut = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];

  const { data } = await supabase
    .from('agent_viewings')
    .select('id, buyer_name, scheme_name, unit_ref, viewing_date, viewing_time, status, buyer_email, buyer_phone')
    .eq('agent_id', agentId)
    .gte('viewing_date', tomorrow)
    .lte('viewing_date', weekOut)
    .order('viewing_date', { ascending: true })
    .order('viewing_time', { ascending: true });

  return (data || []).map((v: any) => ({
    id: v.id,
    buyerName: v.buyer_name,
    schemeName: v.scheme_name,
    unitRef: v.unit_ref ?? null,
    viewingDate: v.viewing_date,
    viewingTime: v.viewing_time ?? null,
    status: v.status,
    buyerEmail: v.buyer_email ?? null,
    buyerPhone: v.buyer_phone ?? null,
  }));
}
