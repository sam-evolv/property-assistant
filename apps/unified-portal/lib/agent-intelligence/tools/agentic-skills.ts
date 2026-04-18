import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

// Standard envelope returned by every agentic skill. The LLM holds this in
// conversation state; the client passes it back to /api/agent-intelligence/confirm
// when the user approves a draft. Skills do NOT write to intelligence_actions
// at tool-call time — persistence happens inside the /confirm endpoint (Step 4).
export type AgenticSkillEnvelope = {
  skill: string;
  status: 'awaiting_approval';
  summary: string;
  drafts: Array<{
    id: string;
    type: 'email' | 'viewing_record' | 'report';
    recipient?: { name: string; email: string; role?: string };
    subject?: string;
    body: string;
    affected_record: { kind: string; id: string; label: string };
    reasoning: string;
  }>;
  meta: { record_count: number; generated_at: string; query: string };
};

export interface SkillAgentContext {
  agentId: string;
  userId: string;
  displayName: string;
  agencyName: string;
  phone?: string;
}

function formatIrishDate(iso: string | null | undefined): string {
  if (!iso) return 'unknown date';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysBetween(fromIso: string, to: Date = new Date()): number {
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) return 0;
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

function signature(ctx: SkillAgentContext): string {
  const lines = [ctx.displayName, ctx.agencyName];
  if (ctx.phone) lines.push(ctx.phone);
  return lines.filter(Boolean).join('\n');
}

function firstName(fullName: string | null | undefined): string {
  if (!fullName) return 'there';
  return fullName.trim().split(/\s+/)[0] ?? 'there';
}

function errorEnvelope(skill: string, query: string, err: unknown): AgenticSkillEnvelope {
  const message = err instanceof Error ? err.message : String(err);
  return {
    skill,
    status: 'awaiting_approval',
    summary: 'Could not retrieve data',
    drafts: [],
    meta: {
      record_count: 0,
      generated_at: new Date().toISOString(),
      query: `${query} — error: ${message}`,
    },
  };
}

// =====================================================================
// Skill 1 — chase_aged_contracts
// =====================================================================
export async function chaseAgedContracts(
  supabase: SupabaseClient,
  agentContext: SkillAgentContext,
  inputs: { threshold_days?: number; scheme_filter?: string },
): Promise<AgenticSkillEnvelope> {
  const thresholdDays = Number.isFinite(Number(inputs.threshold_days))
    ? Math.max(1, Number(inputs.threshold_days))
    : 42;
  const schemeFilter = (inputs.scheme_filter || '').trim().toLowerCase();
  const skill = 'chase_aged_contracts';
  const cutoffIso = new Date(Date.now() - thresholdDays * 86400000).toISOString();
  const query = `unit_sales_pipeline WHERE signed_contracts_date IS NULL AND contracts_issued_date < now() - interval '${thresholdDays} days'${schemeFilter ? ` AND scheme ILIKE '%${schemeFilter}%'` : ''}`;

  try {
    const { data: assignments, error: asgErr } = await supabase
      .from('agent_scheme_assignments')
      .select('development_id')
      .eq('agent_id', agentContext.agentId)
      .eq('is_active', true);
    if (asgErr) throw asgErr;

    const devIds = Array.from(new Set((assignments || []).map((a: any) => a.development_id).filter(Boolean)));
    if (!devIds.length) {
      return {
        skill,
        status: 'awaiting_approval',
        summary: 'No assigned schemes found — nothing to chase.',
        drafts: [],
        meta: { record_count: 0, generated_at: new Date().toISOString(), query },
      };
    }

    const { data: pipeline, error: pipeErr } = await supabase
      .from('unit_sales_pipeline')
      .select('unit_id, development_id, purchaser_name, contracts_issued_date, signed_contracts_date')
      .in('development_id', devIds)
      .not('contracts_issued_date', 'is', null)
      .is('signed_contracts_date', null)
      .lt('contracts_issued_date', cutoffIso);
    if (pipeErr) throw pipeErr;

    const rows = pipeline || [];
    if (!rows.length) {
      return {
        skill,
        status: 'awaiting_approval',
        summary: `No aged contracts over ${thresholdDays} days — nothing to chase.`,
        drafts: [],
        meta: { record_count: 0, generated_at: new Date().toISOString(), query },
      };
    }

    const [{ data: developments }, { data: units }] = await Promise.all([
      supabase.from('developments').select('id, name').in('id', devIds),
      supabase
        .from('units')
        .select('id, unit_number, unit_uid')
        .in('id', rows.map((r: any) => r.unit_id).filter(Boolean)),
    ]);

    const devNameById = new Map<string, string>((developments || []).map((d: any) => [d.id, d.name]));
    const unitById = new Map<string, { unit_number: string | null; unit_uid: string | null }>(
      (units || []).map((u: any) => [u.id, { unit_number: u.unit_number, unit_uid: u.unit_uid }]),
    );

    const filtered = schemeFilter
      ? rows.filter((r: any) => (devNameById.get(r.development_id) || '').toLowerCase().includes(schemeFilter))
      : rows;

    // Sort oldest first so the most urgent chases land at the top of the list.
    filtered.sort((a: any, b: any) =>
      new Date(a.contracts_issued_date).getTime() - new Date(b.contracts_issued_date).getTime(),
    );

    const drafts = filtered.map((r: any) => {
      const schemeName = devNameById.get(r.development_id) || 'Unknown scheme';
      const unit = unitById.get(r.unit_id);
      const unitNumber = unit?.unit_number || unit?.unit_uid || 'unknown';
      const purchaser = r.purchaser_name || 'the purchaser';
      const issuedLabel = formatIrishDate(r.contracts_issued_date);
      const daysAged = daysBetween(r.contracts_issued_date);

      const body = [
        `Hi,`,
        ``,
        `Following up on Unit ${unitNumber} at ${schemeName}. Contracts were issued on ${issuedLabel} to ${purchaser}, and we still haven't had signed contracts back. That's now ${daysAged} days out.`,
        ``,
        `Could you let me know where we stand on signing? Happy to talk through anything that's holding things up.`,
        ``,
        `Thanks,`,
        signature(agentContext),
      ].join('\n');

      return {
        id: randomUUID(),
        type: 'email' as const,
        recipient: { name: 'Solicitor (TBC)', email: 'solicitor@tbc.invalid', role: 'solicitor' },
        subject: `Contracts issued ${issuedLabel} — following up on Unit ${unitNumber}, ${schemeName}`,
        body,
        affected_record: {
          kind: 'sales_unit',
          id: r.unit_id || '',
          label: `${schemeName} Unit ${unitNumber}`,
        },
        reasoning: `Contract was issued ${daysAged} days ago (${issuedLabel}) and remains unsigned. Solicitor follow-up suggested. Note: solicitor email is a placeholder pending data capture — the agent should replace it before approving.`,
      };
    });

    return {
      skill,
      status: 'awaiting_approval',
      summary: `Drafted ${drafts.length} chase email${drafts.length === 1 ? '' : 's'} for contracts aged over ${thresholdDays} days.`,
      drafts,
      meta: { record_count: drafts.length, generated_at: new Date().toISOString(), query },
    };
  } catch (err) {
    return errorEnvelope(skill, query, err);
  }
}

// =====================================================================
// Skill 2 — draft_viewing_followup
// =====================================================================
export async function draftViewingFollowup(
  supabase: SupabaseClient,
  agentContext: SkillAgentContext,
  inputs: { window_hours?: number },
): Promise<AgenticSkillEnvelope> {
  const windowHours = Number.isFinite(Number(inputs.window_hours))
    ? Math.max(1, Number(inputs.window_hours))
    : 24;
  const windowDays = Math.max(1, Math.ceil(windowHours / 24));
  const skill = 'draft_viewing_followup';
  const cutoffIso = new Date(Date.now() - windowDays * 86400000).toISOString().split('T')[0];
  const query = `agent_viewings WHERE status = 'completed' AND viewing_date >= current_date - ${windowDays} day${windowDays === 1 ? '' : 's'} AND agent_id = '${agentContext.agentId}'`;

  try {
    const { data, error } = await supabase
      .from('agent_viewings')
      .select('id, buyer_name, buyer_email, scheme_name, unit_ref, viewing_date, viewing_time, status')
      .eq('agent_id', agentContext.agentId)
      .eq('status', 'completed')
      .gte('viewing_date', cutoffIso)
      .order('viewing_date', { ascending: false });
    if (error) throw error;

    const viewings = data || [];
    if (!viewings.length) {
      return {
        skill,
        status: 'awaiting_approval',
        summary: `No completed viewings in the last ${windowHours} hours — nothing to follow up on.`,
        drafts: [],
        meta: { record_count: 0, generated_at: new Date().toISOString(), query },
      };
    }

    const drafts = viewings.map((v: any) => {
      const propertyLabel = [v.scheme_name, v.unit_ref ? `Unit ${v.unit_ref}` : null]
        .filter(Boolean)
        .join(', ');
      const dateLabel = formatIrishDate(v.viewing_date);

      const body = [
        `Hi ${firstName(v.buyer_name)},`,
        ``,
        `Thanks for coming out to view ${propertyLabel || 'the property'} on ${dateLabel}. Hope it gave you a good feel for the place.`,
        ``,
        `If any questions came up after the viewing, or if you'd like a second look, just let me know. Happy to walk through next steps on an offer or booking deposit whenever you're ready.`,
        ``,
        `Thanks,`,
        signature(agentContext),
      ].join('\n');

      return {
        id: randomUUID(),
        type: 'email' as const,
        recipient: {
          name: v.buyer_name || 'Buyer',
          email: v.buyer_email || 'buyer@tbc.invalid',
          role: 'buyer',
        },
        subject: `Following up on your viewing${v.scheme_name ? ` — ${v.scheme_name}` : ''}${v.unit_ref ? `, Unit ${v.unit_ref}` : ''}`,
        body,
        affected_record: {
          kind: 'viewing',
          id: v.id,
          label: `${v.buyer_name || 'Buyer'} — ${propertyLabel || v.scheme_name || 'viewing'}`,
        },
        reasoning: `Viewing completed on ${dateLabel}. No follow-up sent yet (current system does not track follow-up state — assumed not sent). Standard ${windowHours}-hour follow-up applies.${v.buyer_email ? '' : ' Buyer email is missing on the viewing record; recipient set to placeholder pending capture.'}`,
      };
    });

    return {
      skill,
      status: 'awaiting_approval',
      summary: `Drafted ${drafts.length} follow-up email${drafts.length === 1 ? '' : 's'} for viewings completed in the last ${windowHours} hours.`,
      drafts,
      meta: { record_count: drafts.length, generated_at: new Date().toISOString(), query },
    };
  } catch (err) {
    return errorEnvelope(skill, query, err);
  }
}
