import { SupabaseClient } from '@supabase/supabase-js';
import { ToolResult, AgentContext } from '../types';

export async function getUnitStatus(
  supabase: SupabaseClient,
  tenantId: string,
  agentContext: AgentContext,
  params: { scheme_name: string; unit_identifier: string }
): Promise<ToolResult> {
  // Resolve scheme by name
  const { data: dev } = await supabase
    .from('developments')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .ilike('name', `%${params.scheme_name}%`)
    .limit(1)
    .maybeSingle();

  if (!dev) {
    return { data: null, summary: `No scheme found matching "${params.scheme_name}".` };
  }

  // Find unit by number/identifier
  const { data: units } = await supabase
    .from('units')
    .select('id, unit_uid, unit_number, unit_type, bedroom_count, floor_area_m2, development_id, purchaser_name, purchaser_email, purchaser_phone')
    .eq('tenant_id', tenantId)
    .eq('development_id', dev.id)
    .or(`unit_number.ilike.%${params.unit_identifier}%,unit_uid.ilike.%${params.unit_identifier}%`);

  if (!units?.length) {
    return { data: null, summary: `No unit found matching "${params.unit_identifier}" in ${dev.name}.` };
  }

  const unit = units[0];

  // Get pipeline data
  const { data: pipeline } = await supabase
    .from('unit_sales_pipeline')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('unit_id', unit.id)
    .maybeSingle();

  // Get communication history
  const { data: comms } = await supabase
    .from('communication_events')
    .select('created_at, type, direction, summary, counterparty_name')
    .eq('tenant_id', tenantId)
    .eq('unit_id', unit.id)
    .neq('visibility', 'private')
    .order('created_at', { ascending: false })
    .limit(5);

  // Determine status from pipeline dates
  let status = 'for_sale';
  if (pipeline) {
    if (pipeline.handover_date && new Date(pipeline.handover_date) <= new Date()) status = 'sold';
    else if (pipeline.drawdown_date) status = 'closing';
    else if (pipeline.counter_signed_date) status = 'contracts_signed';
    else if (pipeline.signed_contracts_date) status = 'contracts_signed';
    else if (pipeline.contracts_issued_date) status = 'contracts_issued';
    else if (pipeline.deposit_date) status = 'reserved';
    else if (pipeline.sale_agreed_date) status = 'sale_agreed';
    else if (pipeline.release_date) status = 'for_sale';
  }

  const result = {
    unit_number: unit.unit_number || unit.unit_uid,
    unit_type: unit.unit_type,
    bed_count: unit.bedroom_count,
    floor_area: unit.floor_area_m2,
    scheme_name: dev.name,
    status,
    buyer: {
      name: unit.purchaser_name || pipeline?.purchaser_name || null,
      email: unit.purchaser_email || pipeline?.purchaser_email || null,
      phone: unit.purchaser_phone || pipeline?.purchaser_phone || null,
    },
    dates: pipeline ? {
      sale_agreed_date: pipeline.sale_agreed_date,
      deposit_date: pipeline.deposit_date,
      contracts_issued_date: pipeline.contracts_issued_date,
      signed_contracts_date: pipeline.signed_contracts_date,
      counter_signed_date: pipeline.counter_signed_date,
      drawdown_date: pipeline.drawdown_date,
      handover_date: pipeline.handover_date,
    } : null,
    sale_price: pipeline?.sale_price || null,
    kitchen_selected: pipeline?.kitchen_selected || false,
    recent_communications: comms || [],
  };

  const buyerName = result.buyer.name || 'no buyer assigned';
  const summary = `Unit ${result.unit_number} in ${dev.name} — ${status.replace(/_/g, ' ')}. Buyer: ${buyerName}.`;

  return { data: result, summary };
}

export async function getBuyerDetails(
  supabase: SupabaseClient,
  tenantId: string,
  agentContext: AgentContext,
  params: { buyer_name: string }
): Promise<ToolResult> {
  // Search across unit_sales_pipeline for buyer name
  const { data: matches } = await supabase
    .from('unit_sales_pipeline')
    .select('*, unit_id')
    .eq('tenant_id', tenantId)
    .ilike('purchaser_name', `%${params.buyer_name}%`);

  if (!matches?.length) {
    // Also try units table
    const { data: unitMatches } = await supabase
      .from('units')
      .select('id, unit_uid, unit_number, purchaser_name, purchaser_email, purchaser_phone, development_id')
      .eq('tenant_id', tenantId)
      .ilike('purchaser_name', `%${params.buyer_name}%`);

    if (!unitMatches?.length) {
      return { data: { matches: [] }, summary: `No buyer found matching "${params.buyer_name}".` };
    }

    // Get development names
    const devIds = [...new Set(unitMatches.map((u: any) => u.development_id))];
    const { data: devs } = await supabase
      .from('developments')
      .select('id, name')
      .in('id', devIds);

    const devMap = new Map((devs || []).map((d: any) => [d.id, d.name]));

    const results = unitMatches.map((u: any) => ({
      name: u.purchaser_name,
      email: u.purchaser_email,
      phone: u.purchaser_phone,
      unit_number: u.unit_number || u.unit_uid,
      scheme_name: devMap.get(u.development_id) || 'Unknown',
    }));

    return {
      data: { matches: results },
      summary: `Found ${results.length} match(es) for "${params.buyer_name}": ${results.map((r: any) => `${r.name} (${r.unit_number}, ${r.scheme_name})`).join('; ')}.`,
    };
  }

  // Get unit details for pipeline matches
  const unitIds = matches.map((m: any) => m.unit_id).filter(Boolean);
  const { data: units } = await supabase
    .from('units')
    .select('id, unit_uid, unit_number, development_id')
    .in('id', unitIds);

  const unitMap = new Map((units || []).map((u: any) => [u.id, u]));

  const devIds = [...new Set((units || []).map((u: any) => u.development_id))];
  const { data: devs } = await supabase
    .from('developments')
    .select('id, name')
    .in('id', devIds);

  const devMap = new Map((devs || []).map((d: any) => [d.id, d.name]));

  // Get comms count for each match
  const results = await Promise.all(matches.map(async (m: any) => {
    const unit: any = unitMap.get(m.unit_id);
    const { count } = await supabase
      .from('communication_events')
      .select('id', { count: 'exact', head: true })
      .eq('unit_id', m.unit_id)
      .eq('tenant_id', tenantId);

    let status = 'for_sale';
    if (m.handover_date && new Date(m.handover_date) <= new Date()) status = 'sold';
    else if (m.counter_signed_date) status = 'contracts_signed';
    else if (m.contracts_issued_date) status = 'contracts_issued';
    else if (m.sale_agreed_date) status = 'sale_agreed';

    return {
      name: m.purchaser_name,
      email: m.purchaser_email,
      phone: m.purchaser_phone,
      unit_number: unit?.unit_number || unit?.unit_uid || 'Unknown',
      scheme_name: devMap.get(unit?.development_id || '') || 'Unknown',
      status,
      sale_price: m.sale_price,
      dates: {
        sale_agreed: m.sale_agreed_date,
        contracts_issued: m.contracts_issued_date,
        contracts_signed: m.signed_contracts_date || m.counter_signed_date,
        handover: m.handover_date,
      },
      communication_count: count || 0,
    };
  }));

  return {
    data: { matches: results },
    summary: `Found ${results.length} match(es) for "${params.buyer_name}": ${results.map((r: any) => `${r.name} — Unit ${r.unit_number} in ${r.scheme_name}, ${r.status.replace(/_/g, ' ')}`).join('; ')}.`,
  };
}

export async function getSchemeOverview(
  supabase: SupabaseClient,
  tenantId: string,
  agentContext: AgentContext,
  params: { scheme_name: string }
): Promise<ToolResult> {
  const { data: dev } = await supabase
    .from('developments')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .ilike('name', `%${params.scheme_name}%`)
    .limit(1)
    .maybeSingle();

  if (!dev) {
    return { data: null, summary: `No scheme found matching "${params.scheme_name}".` };
  }

  // Get all units
  const { data: units } = await supabase
    .from('units')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('development_id', dev.id);

  const totalUnits = units?.length || 0;

  // Get pipeline data
  const { data: pipeline } = await supabase
    .from('unit_sales_pipeline')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('development_id', dev.id);

  // Count by status
  const breakdown = {
    for_sale: 0,
    reserved: 0,
    sale_agreed: 0,
    contracts_issued: 0,
    contracts_signed: 0,
    sold: 0,
  };

  let totalExpectedRevenue = 0;
  const now = new Date();

  for (const p of pipeline || []) {
    totalExpectedRevenue += Number(p.sale_price) || 0;

    if (p.handover_date && new Date(p.handover_date) <= now) breakdown.sold++;
    else if (p.counter_signed_date || p.signed_contracts_date) breakdown.contracts_signed++;
    else if (p.contracts_issued_date) breakdown.contracts_issued++;
    else if (p.sale_agreed_date) breakdown.sale_agreed++;
    else if (p.deposit_date) breakdown.reserved++;
    else breakdown.for_sale++;
  }

  // Unsold/unassigned units
  const pipelineUnitIds = new Set((pipeline || []).map((p: any) => p.unit_id));
  const unassignedCount = (units || []).filter((u: any) => !pipelineUnitIds.has(u.id)).length;
  breakdown.for_sale += unassignedCount;

  // Recent activity from entity_timeline
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: recentEvents } = await supabase
    .from('entity_timeline')
    .select('event_type, event_summary, created_at')
    .eq('tenant_id', tenantId)
    .eq('entity_type', 'scheme')
    .eq('entity_id', dev.id)
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(10);

  const result = {
    scheme_name: dev.name,
    total_units: totalUnits,
    unit_breakdown: breakdown,
    total_expected_revenue: totalExpectedRevenue,
    recent_activity: recentEvents || [],
  };

  const summary = `${dev.name}: ${totalUnits} units total. Sold: ${breakdown.sold}, Contracts Signed: ${breakdown.contracts_signed}, Contracts Issued: ${breakdown.contracts_issued}, Sale Agreed: ${breakdown.sale_agreed}, Available: ${breakdown.for_sale}. Expected revenue: €${(totalExpectedRevenue / 1000).toFixed(0)}k.`;

  return { data: result, summary };
}

export async function getOutstandingItems(
  supabase: SupabaseClient,
  tenantId: string,
  agentContext: AgentContext,
  params: { scheme_name?: string; category?: string; days_ahead?: number }
): Promise<ToolResult> {
  const daysAhead = params.days_ahead || 14;
  const futureDate = new Date(Date.now() + daysAhead * 86400000).toISOString();

  // Get development if specified
  let developmentId: string | undefined;
  if (params.scheme_name) {
    const { data: dev } = await supabase
      .from('developments')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('name', `%${params.scheme_name}%`)
      .limit(1)
      .maybeSingle();
    developmentId = dev?.id;
  }

  const items: Array<{
    priority: string;
    category: string;
    unit_number: string;
    scheme_name: string;
    buyer_name: string;
    description: string;
    due_date: string | null;
    days_overdue_or_until_due: number | null;
    suggested_action: string;
  }> = [];

  // Get pipeline data for unsigned contracts, overdue selections
  let pipelineQuery = supabase
    .from('unit_sales_pipeline')
    .select('*, unit_id')
    .eq('tenant_id', tenantId);

  if (developmentId) pipelineQuery = pipelineQuery.eq('development_id', developmentId);

  const { data: pipeline } = await pipelineQuery;

  // Get unit details
  const unitIds = (pipeline || []).map((p: any) => p.unit_id).filter(Boolean);
  const { data: units } = unitIds.length
    ? await supabase.from('units').select('id, unit_number, unit_uid, development_id').in('id', unitIds)
    : { data: [] };

  const unitMap = new Map((units || []).map((u: any) => [u.id, u]));

  // Get all dev names
  const devIds = [...new Set((units || []).map((u: any) => u.development_id))];
  const { data: devs } = devIds.length
    ? await supabase.from('developments').select('id, name').in('id', devIds)
    : { data: [] };
  const devMap = new Map((devs || []).map((d: any) => [d.id, d.name]));

  const now = new Date();

  for (const p of pipeline || []) {
    const unit: any = unitMap.get(p.unit_id);
    const unitNum: string = unit?.unit_number || unit?.unit_uid || 'Unknown';
    const schemeName: string = (devMap.get(unit?.development_id || '') as string) || 'Unknown';

    // Unsigned contracts (contracts issued but not signed)
    if (p.contracts_issued_date && !p.signed_contracts_date && !p.counter_signed_date) {
      const issuedDate = new Date(p.contracts_issued_date);
      const daysSinceIssued = Math.floor((now.getTime() - issuedDate.getTime()) / 86400000);
      const priority = daysSinceIssued > 14 ? 'high' : daysSinceIssued > 7 ? 'medium' : 'low';

      if (!params.category || params.category === 'contracts' || params.category === 'all') {
        items.push({
          priority,
          category: 'contracts',
          unit_number: unitNum,
          scheme_name: schemeName,
          buyer_name: p.purchaser_name || 'Unknown',
          description: `Contracts issued ${daysSinceIssued} days ago, not yet returned`,
          due_date: null,
          days_overdue_or_until_due: daysSinceIssued,
          suggested_action: daysSinceIssued > 14
            ? 'Contact buyer solicitor for update. Consider escalating to developer.'
            : 'Follow up with buyer or solicitor for timeline.',
        });
      }
    }

    // Kitchen selections not made
    if (!p.kitchen_selected && p.sale_agreed_date) {
      if (!params.category || params.category === 'selections' || params.category === 'all') {
        items.push({
          priority: 'medium',
          category: 'selections',
          unit_number: unitNum,
          scheme_name: schemeName,
          buyer_name: p.purchaser_name || 'Unknown',
          description: 'Kitchen selection not yet made',
          due_date: null,
          days_overdue_or_until_due: null,
          suggested_action: 'Contact buyer to arrange selection appointment.',
        });
      }
    }
  }

  // Get overdue agent tasks
  const { data: tasks } = await supabase
    .from('agent_tasks')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'in_progress'])
    .lte('due_date', futureDate);

  for (const t of tasks || []) {
    const dueDate = t.due_date ? new Date(t.due_date) : null;
    const daysUntilDue = dueDate ? Math.floor((dueDate.getTime() - now.getTime()) / 86400000) : null;

    items.push({
      priority: t.priority || 'medium',
      category: 'task',
      unit_number: '',
      scheme_name: '',
      buyer_name: t.related_buyer_name || '',
      description: t.title,
      due_date: t.due_date,
      days_overdue_or_until_due: daysUntilDue,
      suggested_action: t.description || 'Complete this task.',
    });
  }

  // Sort by priority
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  items.sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3));

  return {
    data: { items, total: items.length },
    summary: `${items.length} outstanding items. ${items.filter(i => i.priority === 'critical' || i.priority === 'high').length} are high priority.`,
  };
}

export async function getCommunicationHistory(
  supabase: SupabaseClient,
  tenantId: string,
  agentContext: AgentContext,
  params: { unit_identifier?: string; buyer_name?: string; scheme_name?: string; limit?: number }
): Promise<ToolResult> {
  const limit = params.limit || 10;

  let unitId: string | undefined;

  // Resolve unit if specified
  if (params.unit_identifier && params.scheme_name) {
    const { data: dev } = await supabase
      .from('developments')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('name', `%${params.scheme_name}%`)
      .limit(1)
      .maybeSingle();

    if (dev) {
      const { data: units } = await supabase
        .from('units')
        .select('id')
        .eq('development_id', dev.id)
        .or(`unit_number.ilike.%${params.unit_identifier}%,unit_uid.ilike.%${params.unit_identifier}%`)
        .limit(1);

      unitId = units?.[0]?.id;
    }
  }

  let query = supabase
    .from('communication_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .neq('visibility', 'private')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unitId) query = query.eq('unit_id', unitId);
  if (params.buyer_name) query = query.ilike('counterparty_name', `%${params.buyer_name}%`);

  const { data: comms } = await query;

  if (!comms?.length) {
    return { data: { communications: [] }, summary: 'No communication history found.' };
  }

  const communications = comms.map((c: any) => ({
    date: c.created_at,
    type: c.type,
    direction: c.direction,
    actor: c.actor_name,
    counterparty: c.counterparty_name,
    summary: c.summary,
    outcome: c.outcome,
    follow_up_required: c.follow_up_required,
    follow_up_date: c.follow_up_date,
  }));

  return {
    data: { communications },
    summary: `${communications.length} communication event(s) found. Most recent: ${comms[0].type} on ${new Date(comms[0].created_at).toLocaleDateString('en-IE')} — ${comms[0].summary}.`,
  };
}

export async function searchKnowledgeBase(
  supabase: SupabaseClient,
  tenantId: string,
  agentContext: AgentContext,
  params: { query: string; scope?: string }
): Promise<ToolResult> {
  // This uses the existing RAG pipeline via OpenAI embeddings
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: params.query,
  });
  const queryEmbedding = embeddingResponse.data[0].embedding;

  // Determine search scope
  const matchProjectId = params.scope === 'regulatory'
    ? '00000000-0000-0000-0000-000000000001'
    : tenantId;

  const { data: chunks, error } = await supabase.rpc('match_document_sections', {
    query_embedding: queryEmbedding,
    match_project_id: matchProjectId,
    match_count: 6,
  });

  if (error || !chunks?.length) {
    return { data: { results: [] }, summary: 'No matching documents found.' };
  }

  const results = chunks.map((c: any) => ({
    content: c.content,
    source: c.metadata?.title || c.metadata?.file_name || 'Unknown',
    relevance_score: c.similarity,
  }));

  return {
    data: { results },
    summary: `Found ${results.length} relevant document sections. Top result from "${results[0].source}".`,
  };
}
