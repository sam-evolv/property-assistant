import { SupabaseClient } from '@supabase/supabase-js';
import { ToolResult, AgentContext } from '../types';

export async function createTask(
  supabase: SupabaseClient,
  tenantId: string,
  agentContext: AgentContext,
  params: {
    title: string;
    description?: string;
    due_date?: string;
    priority?: string;
    related_unit_id?: string;
    related_buyer_id?: string;
    related_scheme_id?: string;
  }
): Promise<ToolResult> {
  const { data: task, error } = await supabase
    .from('agent_tasks')
    .insert({
      agent_id: agentContext.agentId,
      tenant_id: tenantId,
      title: params.title,
      description: params.description || null,
      due_date: params.due_date || null,
      priority: params.priority || 'medium',
      related_unit_id: params.related_unit_id || null,
      related_development_id: params.related_scheme_id || null,
      related_buyer_name: params.related_buyer_id || null,
      source: 'intelligence',
    })
    .select('id')
    .single();

  if (error) {
    return { data: { created: false }, summary: `Failed to create task: ${error.message}` };
  }

  return {
    data: { task_id: task.id, created: true },
    summary: `Task created: "${params.title}"${params.due_date ? ` due ${new Date(params.due_date).toLocaleDateString('en-IE')}` : ''}.`,
  };
}

export async function logCommunication(
  supabase: SupabaseClient,
  tenantId: string,
  agentContext: AgentContext,
  params: {
    unit_identifier: string;
    scheme_name: string;
    type: string;
    direction: string;
    summary: string;
    outcome?: string;
    follow_up_required?: boolean;
    follow_up_date?: string;
  }
): Promise<ToolResult> {
  // Resolve scheme
  const { data: dev } = await supabase
    .from('developments')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .ilike('name', `%${params.scheme_name}%`)
    .limit(1)
    .maybeSingle();

  if (!dev) {
    return { data: { logged: false }, summary: `No scheme found matching "${params.scheme_name}".` };
  }

  // Resolve unit
  const { data: units } = await supabase
    .from('units')
    .select('id, unit_number, unit_uid, purchaser_name')
    .eq('development_id', dev.id)
    .or(`unit_number.ilike.%${params.unit_identifier}%,unit_uid.ilike.%${params.unit_identifier}%,purchaser_name.ilike.%${params.unit_identifier}%`)
    .limit(1);

  const unit = units?.[0];

  // Log the communication event
  const { data: event, error } = await supabase
    .from('communication_events')
    .insert({
      tenant_id: tenantId,
      development_id: dev.id,
      unit_id: unit?.id || null,
      actor_id: agentContext.userId,
      actor_role: 'agent',
      actor_name: agentContext.displayName,
      type: params.type,
      direction: params.direction,
      counterparty_name: unit?.purchaser_name || params.unit_identifier,
      counterparty_role: 'buyer',
      summary: params.summary,
      outcome: params.outcome || null,
      follow_up_required: params.follow_up_required || false,
      follow_up_date: params.follow_up_date || null,
      visibility: 'shared',
    })
    .select('id')
    .single();

  if (error) {
    return { data: { logged: false }, summary: `Failed to log communication: ${error.message}` };
  }

  // Also create an entity_timeline entry for cross-stakeholder visibility
  if (unit?.id) {
    await supabase.from('entity_timeline').insert({
      tenant_id: tenantId,
      entity_type: 'unit',
      entity_id: unit.id,
      event_type: 'communication',
      event_data: {
        type: params.type,
        direction: params.direction,
        summary: params.summary,
        outcome: params.outcome,
      },
      event_summary: `${agentContext.displayName} — ${params.direction} ${params.type}: ${params.summary}`,
      actor_id: agentContext.userId,
      actor_role: 'agent',
      actor_name: agentContext.displayName,
      visibility: 'shared',
    });
  }

  return {
    data: { logged: true, event_id: event.id },
    summary: `Logged: ${params.direction} ${params.type} regarding ${unit?.purchaser_name || params.unit_identifier} (${unit?.unit_number || unit?.unit_uid || 'unit'}, ${dev.name}).${params.follow_up_required ? ` Follow-up set for ${params.follow_up_date ? new Date(params.follow_up_date).toLocaleDateString('en-IE') : 'TBD'}.` : ''}`,
  };
}

export async function draftMessage(
  supabase: SupabaseClient,
  tenantId: string,
  agentContext: AgentContext,
  params: {
    recipient_type: string;
    recipient_name: string;
    context: string;
    tone?: string;
    related_unit?: string;
    related_scheme?: string;
  }
): Promise<ToolResult> {
  // Gather context data for the draft
  let recipientEmail: string | null = null;
  let unitContext = '';

  if (params.related_scheme && params.related_unit) {
    const { data: dev } = await supabase
      .from('developments')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .ilike('name', `%${params.related_scheme}%`)
      .limit(1)
      .maybeSingle();

    if (dev) {
      const { data: units } = await supabase
        .from('units')
        .select('id, unit_number, unit_uid')
        .eq('development_id', dev.id)
        .or(`unit_number.ilike.%${params.related_unit}%,unit_uid.ilike.%${params.related_unit}%`)
        .limit(1);

      if (units?.[0]) {
        unitContext = `Unit ${units[0].unit_number || units[0].unit_uid} in ${dev.name}`;
        // Get email from pipeline table (units table doesn't have purchaser_email)
        const { data: pipeline } = await supabase
          .from('unit_sales_pipeline')
          .select('purchaser_email')
          .eq('unit_id', units[0].id)
          .maybeSingle();
        recipientEmail = pipeline?.purchaser_email || null;
      }
    }
  }

  // Determine tone
  const tone = params.tone || (
    params.recipient_type === 'buyer' ? 'warm' :
    params.recipient_type === 'solicitor' ? 'formal' :
    'professional'
  );

  // Return data for the LLM to generate the actual draft content
  return {
    data: {
      draft_request: true,
      recipient_type: params.recipient_type,
      recipient_name: params.recipient_name,
      recipient_email: recipientEmail,
      context: params.context,
      tone,
      unit_context: unitContext,
      agent_name: agentContext.displayName,
      notes: 'DRAFT — Review before sending. The agent must review, edit if needed, and send manually.',
    },
    summary: `Draft prepared for ${params.recipient_type} (${params.recipient_name}). Tone: ${tone}. The agent should review before sending.`,
  };
}

export async function generateDeveloperReport(
  supabase: SupabaseClient,
  tenantId: string,
  agentContext: AgentContext,
  params: {
    developer_name: string;
    period?: string;
    schemes?: string[];
  }
): Promise<ToolResult> {
  const period = params.period || 'week';
  const periodDays = period === 'month' ? 30 : period === 'fortnight' ? 14 : 7;
  const sinceDate = new Date(Date.now() - periodDays * 86400000).toISOString();

  // Get assigned schemes (or specified ones)
  let devQuery = supabase
    .from('developments')
    .select('id, name')
    .eq('tenant_id', tenantId);

  if (params.schemes?.length) {
    // Filter by scheme names
    devQuery = devQuery.in('name', params.schemes);
  }

  const { data: developments } = await devQuery;

  if (!developments?.length) {
    return { data: null, summary: 'No schemes found for this developer.' };
  }

  const schemeBreakdowns = await Promise.all(developments.map(async (dev: any) => {
    // Get pipeline data
    const { data: pipeline } = await supabase
      .from('unit_sales_pipeline')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('development_id', dev.id);

    const { data: units } = await supabase
      .from('units')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('development_id', dev.id);

    // Count statuses
    const statusCounts: Record<string, number> = { sold: 0, contracts_signed: 0, contracts_issued: 0, sale_agreed: 0, available: 0 };
    const now = new Date();

    for (const p of pipeline || []) {
      if (p.handover_date && new Date(p.handover_date) <= now) statusCounts.sold++;
      else if (p.counter_signed_date || p.signed_contracts_date) statusCounts.contracts_signed++;
      else if (p.contracts_issued_date) statusCounts.contracts_issued++;
      else if (p.sale_agreed_date) statusCounts.sale_agreed++;
      else statusCounts.available++;
    }

    const pipelineIds = new Set((pipeline || []).map((p: any) => p.unit_id));
    statusCounts.available += (units || []).filter((u: any) => !pipelineIds.has(u.id)).length;

    // Recent communications
    const { data: recentComms } = await supabase
      .from('communication_events')
      .select('type, direction, summary, created_at')
      .eq('tenant_id', tenantId)
      .eq('development_id', dev.id)
      .gte('created_at', sinceDate)
      .neq('visibility', 'private')
      .order('created_at', { ascending: false })
      .limit(5);

    // Outstanding items
    const unsignedContracts = (pipeline || []).filter(
      (p: any) => p.contracts_issued_date && !p.signed_contracts_date && !p.counter_signed_date
    ).length;

    const pendingSelections = (pipeline || []).filter(
      (p: any) => p.sale_agreed_date && !p.kitchen_selected
    ).length;

    return {
      scheme_name: dev.name,
      total_units: (units || []).length,
      status_breakdown: statusCounts,
      activity_this_period: (recentComms || []).length,
      recent_activity: recentComms || [],
      outstanding: {
        unsigned_contracts: unsignedContracts,
        pending_selections: pendingSelections,
      },
    };
  }));

  const totalUnits = schemeBreakdowns.reduce((sum: any, s: any) => sum + s.total_units, 0);
  const totalSold = schemeBreakdowns.reduce((sum: any, s: any) => sum + s.status_breakdown.sold, 0);

  return {
    data: {
      developer_name: params.developer_name,
      period,
      report_date: new Date().toISOString(),
      scheme_breakdowns: schemeBreakdowns,
      totals: { total_units: totalUnits, total_sold: totalSold },
    },
    summary: `Report for ${params.developer_name} (${period}): ${schemeBreakdowns.length} scheme(s), ${totalUnits} units total, ${totalSold} sold. Generated by OpenHouse Intelligence — Review for accuracy.`,
  };
}
