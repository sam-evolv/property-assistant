import { SupabaseClient } from '@supabase/supabase-js';
import { ToolResult, AgentContext } from '../types';
import { resolveSchemeName } from '../scheme-resolver';
import { resolveUnitIdentifier } from '../unit-resolver';

/**
 * Session 14 — strict scheme resolution shared by every read-side skill.
 *
 * Replaces the pre-14 pattern of running `.ilike('name', '%X%').limit(1)`
 * and either picking the first row or returning null. That pattern matched
 * fadá / phonetic typos inconsistently and, worse, matched neighbouring
 * schemes ("Ard" matches "Árdan View", "Ardawn View", or anything starting
 * with "Ard") before falling through to an arbitrary row.
 *
 * Returns `{ ok: true, developmentIds: [...] }` for the caller to run the
 * actual query against, or `{ ok: false, summary: '<honest reason>' }`
 * which is passed straight back to the model as `{ data: null, summary }`.
 *
 * Shape note: the caller doesn't need the `top_candidate` field from the
 * resolver — that's only surfaced by skills the chat route turns into a
 * yes/no prompt, and read skills don't have an "I'll try again" path.
 * We still include it on `meta` so the chat route can pick it up when
 * reading skill envelopes (currently only draft envelopes, but the field
 * is cheap).
 */
async function resolveReadScope(
  supabase: SupabaseClient,
  agentContext: AgentContext,
  schemeName: string | undefined,
): Promise<
  | { ok: true; developmentIds: string[]; schemeNames: string[] }
  | { ok: false; summary: string; error: 'not_found' | 'not_assigned' | 'ambiguous'; top_candidate?: { name: string; developmentId: string } }
> {
  if (!schemeName) {
    // Caller didn't specify a scheme — scope to every assigned development.
    if (!agentContext.assignedDevelopmentIds.length) {
      return { ok: false, summary: 'No schemes assigned to this agent yet.', error: 'not_found' };
    }
    return {
      ok: true,
      developmentIds: agentContext.assignedDevelopmentIds.slice(),
      schemeNames: agentContext.assignedDevelopmentNames.slice(),
    };
  }

  const resolution = await resolveSchemeName(supabase, schemeName, agentContext);
  if (resolution.ok) {
    return {
      ok: true,
      developmentIds: [resolution.developmentId],
      schemeNames: [resolution.canonicalName],
    };
  }

  const assignedList = agentContext.assignedDevelopmentNames.join(', ') || '(none)';
  let summary: string;
  if (resolution.reason === 'not_found') {
    summary = `I couldn't find a scheme matching "${schemeName}". Your assigned schemes are: ${assignedList}.`;
  } else if (resolution.reason === 'ambiguous') {
    summary = `"${schemeName}" matches multiple schemes (${resolution.candidates.join(', ')}). Please be specific.`;
  } else {
    summary = `"${schemeName}" is not in your assigned schemes. Assigned: ${assignedList}.`;
  }
  return {
    ok: false,
    summary,
    error: resolution.reason,
    ...(resolution.reason === 'not_found' && resolution.top_candidate
      ? { top_candidate: { name: resolution.top_candidate.name, developmentId: resolution.top_candidate.developmentId } }
      : {}),
  };
}

export async function getUnitStatus(
  supabase: SupabaseClient,
  tenantId: string,
  agentContext: AgentContext,
  params: { scheme_name: string; unit_identifier: string }
): Promise<ToolResult> {
  // Session 14 — strict scheme + unit resolution.
  //
  // The pre-14 version used `.ilike('name', '%X%').limit(1)` for the scheme
  // and `.or('unit_number.ilike.%X%,unit_uid.ilike.%X%')` for the unit, then
  // took `units[0]`. On "Unit 3 in Árdan View" the unit clause matched AV-3,
  // AV-13, AV-23, AV-30, AV-31 — and units[0] returned Unit 10. The model
  // relayed that as "Unit 3 is actually Unit 10", a grammatically-nonsense
  // statement presented as authoritative fact.
  //
  // Now: exact-match resolvers that refuse to silently substitute. If the
  // scheme doesn't resolve we return null with an honest reason. If the
  // unit doesn't exist we return null — NEVER a different unit's row.
  const scope = await resolveReadScope(supabase, agentContext, params.scheme_name);
  if (!scope.ok) return { data: null, summary: scope.summary, coverage: 'tool_not_applicable' };

  const devId = scope.developmentIds[0];
  const devName = scope.schemeNames[0];

  const unitRes = await resolveUnitIdentifier(supabase, params.unit_identifier, {
    developmentIds: scope.developmentIds,
    preferredDevelopmentId: devId,
  });
  if (unitRes.status === 'not_found') {
    return {
      data: null,
      summary: `Unit ${params.unit_identifier} doesn't exist in ${devName}.`,
      coverage: 'tool_not_applicable',
    };
  }
  if (unitRes.status === 'ambiguous') {
    const list = unitRes.candidates
      .map((c) => `Unit ${c.unit_number ?? '?'}${c.scheme_name ? ` (${c.scheme_name})` : ''}`)
      .join(', ');
    return {
      data: null,
      summary: `"${params.unit_identifier}" matches multiple units: ${list}. Please be specific.`,
      coverage: 'tool_not_applicable',
    };
  }

  // Pull the fuller row shape getUnitStatus needs — resolveUnitIdentifier
  // returns the minimum columns required for disambiguation, not the full
  // surface this skill surfaces to the model.
  const { data: fullUnit } = await supabase
    .from('units')
    .select('id, unit_uid, unit_number, house_type_code, bedrooms, bathrooms, eircode, development_id, purchaser_name')
    .eq('id', unitRes.unit.id)
    .maybeSingle();

  if (!fullUnit) {
    // Shouldn't happen — resolveUnitIdentifier returned a row seconds ago
    // — but handle defensively rather than crash.
    return { data: null, summary: `Unit ${params.unit_identifier} couldn't be loaded.`, coverage: 'tool_not_applicable' };
  }

  const unit = fullUnit;
  const dev = { id: devId, name: devName };

  // Get pipeline data
  const { data: pipeline } = await supabase
    .from('unit_sales_pipeline')
    .select('status, purchaser_name, purchaser_email, purchaser_phone, sale_price, sale_agreed_date, deposit_date, contracts_issued_date, signed_contracts_date, counter_signed_date, drawdown_date, handover_date, release_date, mortgage_expiry_date, kitchen_selected, estimated_close_date, comments')
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

  // Determine status — use the status column first, fall back to date-based derivation
  let status = 'for_sale';
  if (pipeline) {
    const dbStatus = pipeline.status;
    if (dbStatus === 'sold' || (pipeline.handover_date && new Date(pipeline.handover_date) <= new Date())) status = 'sold';
    else if (dbStatus === 'signed' || pipeline.counter_signed_date || pipeline.signed_contracts_date) status = 'contracts_signed';
    else if (dbStatus === 'contracts_issued' || pipeline.contracts_issued_date) status = 'contracts_issued';
    else if (dbStatus === 'closing' || pipeline.drawdown_date) status = 'closing';
    else if (dbStatus === 'sale_agreed' || pipeline.sale_agreed_date) status = 'sale_agreed';
    else if (dbStatus === 'reserved' || pipeline.deposit_date) status = 'reserved';
    else status = 'for_sale';
  }

  const result = {
    unit_number: unit.unit_number || unit.unit_uid,
    house_type: unit.house_type_code || null,
    bedrooms: unit.bedrooms || null,
    bathrooms: unit.bathrooms || null,
    eircode: unit.eircode || null,
    scheme_name: dev.name,
    status,
    buyer: {
      name: unit.purchaser_name || pipeline?.purchaser_name || null,
      email: pipeline?.purchaser_email || null,
      phone: pipeline?.purchaser_phone || null,
    },
    mortgage_expiry_date: pipeline?.mortgage_expiry_date || null,
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
    estimated_close_date: pipeline?.estimated_close_date || null,
    comments: pipeline?.comments || null,
    recent_communications: comms || [],
  };

  const buyerName = result.buyer.name || null;
  const statusLabel = status.replace(/_/g, ' ');
  const summary = buyerName
    ? `Unit ${result.unit_number}, ${dev.name} — ${buyerName} (${statusLabel})`
    : `Unit ${result.unit_number}, ${dev.name} — ${statusLabel}`;

  return { data: result, summary, coverage: 'ok' };
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
    .select('unit_id, status, purchaser_name, purchaser_email, purchaser_phone, sale_price, sale_agreed_date, contracts_issued_date, signed_contracts_date, counter_signed_date, handover_date')
    .eq('tenant_id', tenantId)
    .ilike('purchaser_name', `%${params.buyer_name}%`);

  if (!matches?.length) {
    // Also try units table
    const { data: unitMatches } = await supabase
      .from('units')
      .select('id, unit_uid, unit_number, purchaser_name, development_id')
      .eq('tenant_id', tenantId)
      .ilike('purchaser_name', `%${params.buyer_name}%`);

    if (!unitMatches?.length) {
      return {
        data: null,
        summary: `No buyer found matching "${params.buyer_name}".`,
        coverage: 'tool_returned_zero',
      };
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
      unit_number: u.unit_number || u.unit_uid,
      scheme_name: devMap.get(u.development_id) || 'Unknown',
    }));

    const nameList = results.map((r: any) => `${r.name} — Unit ${r.unit_number}, ${r.scheme_name}`).join('; ');
    return {
      data: { matches: results },
      summary: `Found ${results.length} buyer(s): ${nameList}`,
      coverage: 'ok',
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
    const dbStatus = m.status;
    if (dbStatus === 'sold' || (m.handover_date && new Date(m.handover_date) <= new Date())) status = 'sold';
    else if (dbStatus === 'signed' || m.counter_signed_date || m.signed_contracts_date) status = 'contracts_signed';
    else if (dbStatus === 'contracts_issued' || m.contracts_issued_date) status = 'contracts_issued';
    else if (dbStatus === 'sale_agreed' || m.sale_agreed_date) status = 'sale_agreed';

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

  const nameList = results.map((r: any) => `${r.name} — Unit ${r.unit_number}, ${r.scheme_name}`).join('; ');
  return {
    data: { matches: results },
    summary: `Found ${results.length} buyer(s): ${nameList}`,
    coverage: 'ok',
  };
}

export async function getSchemeOverview(
  supabase: SupabaseClient,
  tenantId: string,
  agentContext: AgentContext,
  params: { scheme_name?: string }
): Promise<ToolResult> {
  // Session 14 — strict scheme resolution. Pre-14 used `matchAssignedScheme`
  // (substring) then fell back to `.ilike('name', '%X%')` against the
  // developments table, which would return the first scheme whose name
  // contained the input — so "Ard" matched any scheme starting with "Ard".
  let dev: { id: string; name: string } | null = null;

  if (params.scheme_name) {
    const resolution = await resolveSchemeName(supabase, params.scheme_name, agentContext);
    if (resolution.ok) {
      dev = { id: resolution.developmentId, name: resolution.canonicalName };
    } else {
      const list = agentContext.assignedDevelopmentNames.join(', ') || '(none)';
      const reason =
        resolution.reason === 'not_found'
          ? `I couldn't find a scheme matching "${params.scheme_name}". Your assigned schemes are: ${list}.`
          : resolution.reason === 'ambiguous'
            ? `"${params.scheme_name}" matches multiple schemes (${resolution.candidates.join(', ')}). Please be specific.`
            : `"${params.scheme_name}" is not in your assigned schemes. Assigned: ${list}.`;
      return { data: null, summary: reason, coverage: 'tool_not_applicable' };
    }
  } else if (agentContext.assignedDevelopmentIds.length === 1) {
    dev = {
      id: agentContext.assignedDevelopmentIds[0],
      name: agentContext.assignedDevelopmentNames[0],
    };
  } else if (agentContext.assignedDevelopmentIds.length > 1) {
    const names = agentContext.assignedDevelopmentNames.join(', ');
    return {
      data: null,
      summary: `You have multiple assigned schemes (${names}). Which one should I summarise?`,
      coverage: 'tool_not_applicable',
    };
  }

  if (!dev) {
    return {
      data: null,
      summary: 'No schemes assigned to this agent yet.',
      coverage: 'tool_not_applicable',
    };
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
    .select('unit_id, status, sale_price, handover_date, counter_signed_date, signed_contracts_date, contracts_issued_date, sale_agreed_date, deposit_date')
    .eq('tenant_id', tenantId)
    .eq('development_id', dev.id);

  // Count by status — use status column as primary source, fall back to dates
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

    const dbStatus = p.status;
    if (dbStatus === 'sold' || (p.handover_date && new Date(p.handover_date) <= now)) breakdown.sold++;
    else if (dbStatus === 'signed' || p.counter_signed_date || p.signed_contracts_date) breakdown.contracts_signed++;
    else if (dbStatus === 'contracts_issued' || p.contracts_issued_date) breakdown.contracts_issued++;
    else if (dbStatus === 'sale_agreed' || p.sale_agreed_date) breakdown.sale_agreed++;
    else if (dbStatus === 'reserved' || p.deposit_date) breakdown.reserved++;
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

  const summary = `${dev.name} — ${totalUnits} units, ${breakdown.sold} sold, ${breakdown.for_sale} available`;

  return {
    data: result,
    summary,
    coverage: totalUnits === 0 && (pipeline?.length ?? 0) === 0 ? 'tool_returned_zero' : 'ok',
  };
}

export async function getOutstandingItems(
  supabase: SupabaseClient,
  tenantId: string,
  agentContext: AgentContext,
  params: { scheme_name?: string; category?: string; days_ahead?: number }
): Promise<ToolResult> {
  const daysAhead = params.days_ahead || 14;
  const futureDate = new Date(Date.now() + daysAhead * 86400000).toISOString();

  // Session 14 — strict scheme scope. Refuse to proceed on a bad scheme
  // name; do NOT silently fall back to "all schemes" when the user named
  // a scheme we couldn't find.
  let developmentId: string | undefined;
  let agentDevIds: string[] = [];

  if (params.scheme_name) {
    const scope = await resolveReadScope(supabase, agentContext, params.scheme_name);
    if (!scope.ok) return { data: null, summary: scope.summary, coverage: 'tool_not_applicable' };
    developmentId = scope.developmentIds[0];
  } else {
    // Scope to agent's assigned developments
    agentDevIds = agentContext.assignedSchemes.map(s => s.developmentId);
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
    .select('unit_id, development_id, status, purchaser_name, sale_agreed_date, contracts_issued_date, signed_contracts_date, counter_signed_date, kitchen_selected')
    .eq('tenant_id', tenantId);

  if (developmentId) {
    pipelineQuery = pipelineQuery.eq('development_id', developmentId);
  } else if (agentDevIds.length > 0) {
    pipelineQuery = pipelineQuery.in('development_id', agentDevIds);
  }

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

    // Unsigned contracts (contracts issued but not signed) — skip if status already shows signed/sold
    const alreadySigned = p.status === 'signed' || p.status === 'sold' || p.signed_contracts_date || p.counter_signed_date;
    if (p.contracts_issued_date && !alreadySigned) {
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
    .select('title, description, due_date, priority, status, related_buyer_name')
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

  if (items.length === 0) {
    return {
      data: null,
      summary: "No outstanding items found across the schemes you're assigned to.",
      coverage: 'tool_returned_zero',
    };
  }

  const highPriority = items.filter(i => i.priority === 'critical' || i.priority === 'high').length;
  return {
    data: { items, total: items.length },
    summary: highPriority > 0
      ? `${items.length} outstanding items, ${highPriority} high priority`
      : `${items.length} outstanding items`,
    coverage: 'ok',
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

  // Session 14 — strict scheme + unit resolution. Refuse to fall back to
  // "no unit filter" when the caller asked for a specific unit that
  // doesn't resolve — better to say "couldn't find that unit" than to
  // return every comm row in the scheme.
  if (params.unit_identifier && params.scheme_name) {
    const scope = await resolveReadScope(supabase, agentContext, params.scheme_name);
    if (!scope.ok) return { data: null, summary: scope.summary, coverage: 'tool_not_applicable' };

    const unitRes = await resolveUnitIdentifier(supabase, params.unit_identifier, {
      developmentIds: scope.developmentIds,
      preferredDevelopmentId: scope.developmentIds[0],
    });
    if (unitRes.status === 'not_found') {
      return {
        data: null,
        summary: `Unit ${params.unit_identifier} doesn't exist in ${scope.schemeNames[0]}.`,
        coverage: 'tool_not_applicable',
      };
    }
    if (unitRes.status === 'ambiguous') {
      const list = unitRes.candidates
        .map((c) => `Unit ${c.unit_number ?? '?'}${c.scheme_name ? ` (${c.scheme_name})` : ''}`)
        .join(', ');
      return {
        data: null,
        summary: `"${params.unit_identifier}" matches multiple units: ${list}. Please be specific.`,
        coverage: 'tool_not_applicable',
      };
    }
    unitId = unitRes.unit.id;
  }

  let query = supabase
    .from('communication_events')
    .select('created_at, type, direction, actor_name, counterparty_name, summary, outcome, follow_up_required, follow_up_date')
    .eq('tenant_id', tenantId)
    .neq('visibility', 'private')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unitId) query = query.eq('unit_id', unitId);
  if (params.buyer_name) query = query.ilike('counterparty_name', `%${params.buyer_name}%`);

  const { data: comms } = await query;

  if (!comms?.length) {
    return {
      data: null,
      summary: 'No contact logged in the system for that buyer or unit.',
      coverage: 'tool_returned_zero',
    };
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

  const mostRecent = comms[0];
  const recentDate = new Date(mostRecent.created_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
  return {
    data: { communications },
    summary: `${communications.length} contact(s) — last: ${mostRecent.type} on ${recentDate}`,
    coverage: 'ok',
  };
}

export async function getViewings(
  supabase: SupabaseClient,
  tenantId: string,
  agentContext: AgentContext,
  params: { scheme_name?: string; buyer_name?: string; from_date?: string; to_date?: string; status?: string }
): Promise<ToolResult> {
  // Agent identity is threaded from the chat route — no re-resolve.
  if (!agentContext.agentProfileId) {
    return { data: null, summary: 'No agent profile found.', coverage: 'tool_not_applicable' };
  }

  let query = supabase
    .from('agent_viewings')
    .select('id, buyer_name, buyer_phone, buyer_email, scheme_name, unit_ref, viewing_date, viewing_time, status, notes, source')
    .eq('agent_id', agentContext.agentProfileId)
    .order('viewing_date', { ascending: true })
    .order('viewing_time', { ascending: true });

  if (params.scheme_name) query = query.ilike('scheme_name', `%${params.scheme_name}%`);
  if (params.buyer_name) query = query.ilike('buyer_name', `%${params.buyer_name}%`);
  if (params.status) query = query.eq('status', params.status);

  // Default: from today onwards if no date range specified
  const fromDate = params.from_date || new Date().toISOString().split('T')[0];
  query = query.gte('viewing_date', fromDate);
  if (params.to_date) query = query.lte('viewing_date', params.to_date);

  const { data: viewings, error } = await query.limit(20);

  if (error || !viewings?.length) {
    return {
      data: null,
      summary: 'No viewings scheduled in that window.',
      coverage: 'tool_returned_zero',
    };
  }

  const formatted = viewings.map((v: any) => ({
    id: v.id,
    buyer_name: v.buyer_name,
    buyer_phone: v.buyer_phone,
    buyer_email: v.buyer_email,
    scheme: v.scheme_name,
    unit: v.unit_ref,
    date: v.viewing_date,
    time: v.viewing_time,
    status: v.status,
    notes: v.notes,
    source: v.source,
  }));

  const today = new Date().toISOString().split('T')[0];
  const todayCount = formatted.filter((v: any) => v.date === today).length;
  const summary = todayCount > 0
    ? `${formatted.length} viewing(s) found, ${todayCount} today`
    : `${formatted.length} upcoming viewing(s)`;

  return { data: { viewings: formatted }, summary, coverage: 'ok' };
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
    return {
      data: null,
      summary: 'No matching documents found in the knowledge base.',
      coverage: 'tool_returned_zero',
    };
  }

  const results = chunks.map((c: any) => ({
    content: c.content,
    source: c.metadata?.title || c.metadata?.file_name || 'Unknown',
    relevance_score: c.similarity,
  }));

  return {
    data: { results },
    summary: `${results.length} results from ${results[0].source}`,
    coverage: 'ok',
  };
}

/**
 * Scheme summary — the "give me a scheme summary" prompt's landing spot.
 *
 * Scope is derived from `agentContext.assignedDevelopmentIds` via the
 * `resolveAgentContext` threading, never from `auth.uid()`. When the user
 * names a specific scheme, the name is matched against the agent's assigned
 * list first to confirm it is in scope.
 */
export async function getSchemeSummary(
  supabase: SupabaseClient,
  tenantId: string,
  agentContext: AgentContext,
  params: { scheme_name?: string }
): Promise<ToolResult> {
  // Session 14 — strict scheme resolution. Pre-14 this used the substring
  // `matchAssignedScheme` helper; a user typing "Ard" would bind to
  // "Árdan View" silently without going through the alias table, which
  // skipped the phonetic signal that Session 13 put in place.
  const scope = await resolveReadScope(supabase, agentContext, params.scheme_name);
  if (!scope.ok) return { data: null, summary: scope.summary, coverage: 'tool_not_applicable' };
  const developmentIds = scope.developmentIds;
  const schemeNames = scope.schemeNames;

  const [unitsResult, pipelineResult] = await Promise.all([
    supabase
      .from('units')
      .select('id, development_id')
      .in('development_id', developmentIds),
    supabase
      .from('unit_sales_pipeline')
      .select('unit_id, development_id, status, purchaser_name, sale_price, sale_agreed_date, deposit_date, contracts_issued_date, signed_contracts_date, counter_signed_date, handover_date')
      .in('development_id', developmentIds),
  ]);

  const units = unitsResult.data ?? [];
  const pipeline = pipelineResult.data ?? [];

  const totalUnits = units.length;

  // Empty-pipeline guard: when units exist but no pipeline rows back them, the
  // pre-coverage code returned a fully-populated all-zeros breakdown that read
  // like a real answer. Refuse cleanly instead so the model can quote the
  // summary verbatim.
  if (pipeline.length === 0) {
    const label = schemeNames.length === 1 ? schemeNames[0] : schemeNames.join(', ');
    const summary = totalUnits > 0
      ? `${label} has ${totalUnits} units but no active sales pipeline data. I can't break down stage counts.`
      : `${label} has no units or sales pipeline data on file.`;
    return { data: null, summary, coverage: 'tool_returned_zero' };
  }
  const breakdown = {
    for_sale: 0,
    reserved: 0,
    sale_agreed: 0,
    in_progress: 0, // contracts issued, not yet signed
    signed: 0,
    handed_over: 0,
  };

  let totalRevenueCommitted = 0;
  let pricedCount = 0;
  let priceSum = 0;
  const now = Date.now();
  const twentyEightDaysAgo = now - 28 * 86400000;
  let overdueContracts = 0;

  const pipelineUnitIds = new Set<string>();

  for (const p of pipeline) {
    if (p.unit_id) pipelineUnitIds.add(p.unit_id);

    const dbStatus = (p.status || '').toLowerCase();
    const handoverPast = p.handover_date && new Date(p.handover_date).getTime() <= now;
    const isSigned = dbStatus === 'signed' || !!p.counter_signed_date || !!p.signed_contracts_date;
    const isContractsIssued = !isSigned && !!p.contracts_issued_date;
    const isSaleAgreed = !isSigned && !isContractsIssued && (dbStatus === 'sale_agreed' || dbStatus === 'agreed' || !!p.sale_agreed_date);
    const isReserved = !isSigned && !isContractsIssued && !isSaleAgreed && (dbStatus === 'reserved' || !!p.deposit_date);

    if (dbStatus === 'sold' || dbStatus === 'complete' || handoverPast) {
      breakdown.handed_over++;
    } else if (isSigned) {
      breakdown.signed++;
    } else if (isContractsIssued) {
      breakdown.in_progress++;
    } else if (isSaleAgreed) {
      breakdown.sale_agreed++;
    } else if (isReserved) {
      breakdown.reserved++;
    } else {
      breakdown.for_sale++;
    }

    const price = Number(p.sale_price) || 0;
    if (price > 0 && (isSaleAgreed || isSigned || isContractsIssued || dbStatus === 'sold' || handoverPast)) {
      totalRevenueCommitted += price;
    }
    if (price > 0) {
      priceSum += price;
      pricedCount++;
    }

    if (
      p.contracts_issued_date &&
      !p.signed_contracts_date &&
      new Date(p.contracts_issued_date).getTime() < twentyEightDaysAgo
    ) {
      overdueContracts++;
    }
  }

  const unitsWithoutPipeline = units.filter((u: any) => !pipelineUnitIds.has(u.id)).length;
  breakdown.for_sale += unitsWithoutPipeline;

  const averagePrice = pricedCount > 0 ? Math.round(priceSum / pricedCount) : null;

  const nextActions = buildNextActions({
    overdueContracts,
    saleAgreed: breakdown.sale_agreed,
    contractsIssued: breakdown.in_progress,
    forSale: breakdown.for_sale,
    signed: breakdown.signed,
  });

  const summary = schemeNames.length === 1
    ? `${schemeNames[0]} — ${totalUnits} units: ${breakdown.handed_over} handed over, ${breakdown.signed} signed, ${breakdown.in_progress} in progress, ${breakdown.sale_agreed} sale agreed, ${breakdown.for_sale} for sale. ${overdueContracts} overdue contracts.`
    : `${schemeNames.join(', ')} — ${totalUnits} units total. ${overdueContracts} overdue contracts.`;

  return {
    data: {
      schemes: schemeNames,
      total_units: totalUnits,
      status_breakdown: breakdown,
      total_revenue_committed: totalRevenueCommitted,
      average_price: averagePrice,
      overdue_contracts: overdueContracts,
      next_actions: nextActions,
    },
    summary,
    coverage: 'ok',
  };
}

function buildNextActions(counts: {
  overdueContracts: number;
  saleAgreed: number;
  contractsIssued: number;
  forSale: number;
  signed: number;
}): string[] {
  const actions: Array<{ weight: number; text: string }> = [];
  if (counts.overdueContracts > 0) {
    actions.push({
      weight: 100 + counts.overdueContracts,
      text: `Chase ${counts.overdueContracts} overdue contract${counts.overdueContracts === 1 ? '' : 's'} (issued >28 days, unsigned).`,
    });
  }
  if (counts.contractsIssued > 0) {
    actions.push({
      weight: 60 + counts.contractsIssued,
      text: `Follow up on ${counts.contractsIssued} contract${counts.contractsIssued === 1 ? '' : 's'} in progress with buyer solicitors.`,
    });
  }
  if (counts.saleAgreed > 0) {
    actions.push({
      weight: 40 + counts.saleAgreed,
      text: `Confirm next step for ${counts.saleAgreed} sale-agreed unit${counts.saleAgreed === 1 ? '' : 's'} (deposit, selections, contracts).`,
    });
  }
  if (counts.forSale > 0) {
    actions.push({
      weight: 10 + Math.min(counts.forSale, 5),
      text: `Review viewings and enquiry pipeline for ${counts.forSale} available unit${counts.forSale === 1 ? '' : 's'}.`,
    });
  }
  if (counts.signed > 0) {
    actions.push({
      weight: 5,
      text: `Check handover readiness for ${counts.signed} signed unit${counts.signed === 1 ? '' : 's'}.`,
    });
  }

  return actions
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((a) => a.text);
}
