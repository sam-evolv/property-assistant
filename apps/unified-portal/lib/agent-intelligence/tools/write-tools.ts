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

export async function scheduleViewing(
  supabase: SupabaseClient,
  tenantId: string,
  agentContext: AgentContext,
  params: {
    buyer_name: string;
    scheme_name: string;
    unit_ref?: string;
    viewing_date: string;
    viewing_time?: string;
    buyer_phone?: string;
    buyer_email?: string;
    notes?: string;
  }
): Promise<ToolResult> {
  // Agent id is threaded through the agentContext — no re-resolve.
  if (!agentContext.agentId) {
    return { data: { created: false }, summary: 'No agent profile found. Cannot schedule viewing.' };
  }

  // Resolve development and unit if possible
  let developmentId: string | null = null;
  let unitId: string | null = null;

  const { data: dev } = await supabase
    .from('developments')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .ilike('name', `%${params.scheme_name}%`)
    .limit(1)
    .maybeSingle();

  if (dev) {
    developmentId = dev.id;

    if (params.unit_ref) {
      const { data: units } = await supabase
        .from('units')
        .select('id')
        .eq('development_id', dev.id)
        .or(`unit_number.ilike.%${params.unit_ref}%,unit_uid.ilike.%${params.unit_ref}%`)
        .limit(1);

      unitId = units?.[0]?.id || null;
    }
  }

  const { data: viewing, error } = await supabase
    .from('agent_viewings')
    .insert({
      agent_id: agentContext.agentId,
      tenant_id: tenantId,
      development_id: developmentId,
      unit_id: unitId,
      buyer_name: params.buyer_name,
      buyer_phone: params.buyer_phone || null,
      buyer_email: params.buyer_email || null,
      scheme_name: dev?.name || params.scheme_name,
      unit_ref: params.unit_ref || null,
      viewing_date: params.viewing_date,
      viewing_time: params.viewing_time || null,
      status: 'confirmed',
      notes: params.notes || null,
      source: 'intelligence',
    })
    .select('id')
    .single();

  if (error) {
    return { data: { created: false }, summary: `Failed to schedule viewing: ${error.message}` };
  }

  const dateStr = new Date(params.viewing_date).toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = params.viewing_time ? ` at ${params.viewing_time}` : '';

  return {
    data: { viewing_id: viewing.id, created: true },
    summary: `Viewing scheduled: ${params.buyer_name} viewing ${params.unit_ref ? `Unit ${params.unit_ref}, ` : ''}${dev?.name || params.scheme_name} on ${dateStr}${timeStr}.`,
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
  let schemeName = '';
  let unitNumber = '';

  if (params.related_scheme && params.related_unit) {
    const { data: dev } = await supabase
      .from('developments')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .ilike('name', `%${params.related_scheme}%`)
      .limit(1)
      .maybeSingle();

    if (dev) {
      schemeName = dev.name;
      const { data: units } = await supabase
        .from('units')
        .select('id, unit_number, unit_uid, purchaser_email')
        .eq('development_id', dev.id)
        .or(`unit_number.ilike.%${params.related_unit}%,unit_uid.ilike.%${params.related_unit}%`)
        .limit(1);

      if (units?.[0]) {
        recipientEmail = units[0].purchaser_email;
        unitNumber = units[0].unit_number || units[0].unit_uid || params.related_unit;
        unitContext = `Unit ${unitNumber} in ${dev.name}`;
      }
    }
  }

  // Determine tone
  const tone = params.tone || (
    params.recipient_type === 'buyer' ? 'warm' :
    params.recipient_type === 'solicitor' ? 'formal' :
    'professional'
  );

  // Extract first name from recipient
  const firstName = params.recipient_name.split(' ')[0];

  // Return rich context so the LLM generates the COMPLETE email in its response
  return {
    data: {
      draft_ready: true,
      recipient_type: params.recipient_type,
      recipient_name: params.recipient_name,
      recipient_first_name: firstName,
      recipient_email: recipientEmail,
      context: params.context,
      tone,
      unit_context: unitContext,
      unit_number: unitNumber,
      scheme_name: schemeName,
      agent_name: agentContext.displayName,
      instruction: `Generate the COMPLETE email now. Include: Subject line, greeting using "${firstName}", full body text, sign-off, and signature placeholder ([Agent Name] / [Agent Phone] / [Agency Name]). The email must sound like a real person wrote it in natural Irish conversational English. Do NOT describe what the email would say — write the actual email text ready to copy and send.`,
    },
    summary: `Drafting email to ${firstName} ${params.recipient_name !== firstName ? `(${params.recipient_name})` : ''} — ${unitContext || params.context.slice(0, 60)}.`,
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
      .select('unit_id, status, purchaser_name, sale_price, handover_date, counter_signed_date, signed_contracts_date, contracts_issued_date, sale_agreed_date, kitchen_selected')
      .eq('tenant_id', tenantId)
      .eq('development_id', dev.id);

    const { data: units } = await supabase
      .from('units')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('development_id', dev.id);

    // Count statuses — use status column as primary source, fall back to dates
    const statusCounts: Record<string, number> = { sold: 0, contracts_signed: 0, contracts_issued: 0, sale_agreed: 0, available: 0 };
    const now = new Date();

    for (const p of pipeline || []) {
      const dbStatus = p.status;
      if (dbStatus === 'sold' || (p.handover_date && new Date(p.handover_date) <= now)) statusCounts.sold++;
      else if (dbStatus === 'signed' || p.counter_signed_date || p.signed_contracts_date) statusCounts.contracts_signed++;
      else if (dbStatus === 'contracts_issued' || p.contracts_issued_date) statusCounts.contracts_issued++;
      else if (dbStatus === 'sale_agreed' || p.sale_agreed_date) statusCounts.sale_agreed++;
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

    // Outstanding items — only flag unsigned if status doesn't already show signed/sold
    const unsignedContracts = (pipeline || []).filter(
      (p: any) => p.contracts_issued_date && p.status !== 'signed' && p.status !== 'sold' && !p.signed_contracts_date && !p.counter_signed_date
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
