import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { getRenewalWindow, getRentArrears, getUpcomingWeekViewings } from '../context';
import { isInRPZ, rpzUpliftCap } from '../rpz-zones';

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

// =====================================================================
// Skill 3 — weekly_monday_briefing
// =====================================================================

// Inline aged-contract loader for the briefing. The public getAgedContracts
// helper in ../context requires a full AgentContext (with assignedSchemes and
// tenantId) which the skill call-site does not have. Rather than widen
// SkillAgentContext, we replicate the same query pattern used by
// chaseAgedContracts above — scheme assignments → pipeline → dev + unit
// lookups. Kept private to this module.
async function loadAgedForBriefing(
  supabase: SupabaseClient,
  agentId: string,
  thresholdDays = 42,
): Promise<Array<{ schemeName: string; unitNumber: string; purchaserName: string; daysAged: number }>> {
  const { data: asgs } = await supabase
    .from('agent_scheme_assignments')
    .select('development_id')
    .eq('agent_id', agentId)
    .eq('is_active', true);
  const devIds = Array.from(new Set((asgs || []).map((a: any) => a.development_id).filter(Boolean)));
  if (!devIds.length) return [];

  const cutoff = new Date(Date.now() - thresholdDays * 86400000).toISOString();
  const { data: rows } = await supabase
    .from('unit_sales_pipeline')
    .select('unit_id, development_id, purchaser_name, contracts_issued_date')
    .in('development_id', devIds)
    .not('contracts_issued_date', 'is', null)
    .is('signed_contracts_date', null)
    .lt('contracts_issued_date', cutoff);
  if (!rows?.length) return [];

  const [{ data: devs }, { data: units }] = await Promise.all([
    supabase.from('developments').select('id, name').in('id', devIds),
    supabase
      .from('units')
      .select('id, unit_number, unit_uid')
      .in('id', rows.map((r: any) => r.unit_id).filter(Boolean)),
  ]);
  const devNameById = new Map<string, string>((devs || []).map((d: any) => [d.id, d.name]));
  const unitById = new Map<string, { unit_number: string | null; unit_uid: string | null }>(
    (units || []).map((u: any) => [u.id, { unit_number: u.unit_number, unit_uid: u.unit_uid }]),
  );

  return rows
    .map((r: any) => {
      const unit = unitById.get(r.unit_id);
      return {
        schemeName: devNameById.get(r.development_id) || 'Unknown scheme',
        unitNumber: unit?.unit_number || unit?.unit_uid || 'unknown',
        purchaserName: r.purchaser_name || 'Unknown purchaser',
        daysAged: daysBetween(r.contracts_issued_date),
      };
    })
    .sort((a, b) => b.daysAged - a.daysAged);
}

function parseOverdueDays(note: string): number | null {
  const m = note.match(/(\d+)\s*days?\s*overdue/i);
  return m ? Number(m[1]) : null;
}

function parseTenantName(raw: string | null | undefined): { firstName: string } {
  if (!raw) return { firstName: 'there' };
  // Strip honorifics at the start of each segment before splitting on "and".
  const stripped = raw.replace(/\b(Mr|Ms|Mrs|Miss|Dr)\.?\s+/gi, '').trim();
  const primary = stripped.split(/\s+and\s+/i)[0] || stripped;
  const first = primary.trim().split(/\s+/)[0];
  return { firstName: first || 'there' };
}

function roundToNearest5(n: number): number {
  return Math.round(n / 5) * 5;
}

export async function weeklyMondayBriefing(
  supabase: SupabaseClient,
  agentContext: SkillAgentContext,
  _inputs: Record<string, never>,
): Promise<AgenticSkillEnvelope> {
  const skill = 'weekly_monday_briefing';
  const query = 'weekly_monday_briefing: aged contracts + renewal window + rent arrears + upcoming viewings';

  try {
    const [aged, renewals, arrears, viewings] = await Promise.all([
      loadAgedForBriefing(supabase, agentContext.agentId).catch(() => []),
      getRenewalWindow(supabase, agentContext.agentId).catch(() => []),
      getRentArrears(supabase, agentContext.agentId).catch(() => []),
      getUpcomingWeekViewings(supabase, agentContext.agentId).catch(() => []),
    ]);

    // --- Section 1: Sales movement ---
    const salesLines: string[] = ['SALES MOVEMENT', ''];
    if (!aged.length) {
      salesLines.push('No aged contracts.');
    } else {
      salesLines.push(`Aged contracts: ${aged.length} over 6 weeks.`);
      salesLines.push('');
      salesLines.push('Top by days aged:');
      for (const a of aged.slice(0, 3)) {
        salesLines.push(`- ${a.schemeName} Unit ${a.unitNumber} — ${a.purchaserName} — ${a.daysAged}d`);
      }
    }

    // --- Section 2: Lettings movement ---
    const lettingsLines: string[] = ['LETTINGS MOVEMENT', ''];
    if (!renewals.length) {
      lettingsLines.push('No renewals due in the window.');
    } else {
      lettingsLines.push(`Renewal windows opening: ${renewals.length} tenanc${renewals.length === 1 ? 'y' : 'ies'} in next 90 days.`);
      lettingsLines.push('');
      for (const r of renewals) {
        lettingsLines.push(`- ${r.propertyAddress} — ${r.tenantName} — ${r.daysOut} days to lease end`);
      }
    }

    // --- Section 3: Rent arrears ---
    const arrearsLines: string[] = ['RENT ARREARS', ''];
    if (!arrears.length) {
      arrearsLines.push('All rent up to date.');
    } else {
      arrearsLines.push(`Active arrears: ${arrears.length}.`);
      arrearsLines.push('');
      for (const a of arrears) {
        const days = parseOverdueDays(a.note);
        const suffix = days !== null ? `${days} days overdue` : 'overdue';
        arrearsLines.push(`- ${a.propertyAddress} — ${a.tenantName} — ${suffix}`);
      }
    }

    // --- Section 4: This week's viewings ---
    const viewingsLines: string[] = ["THIS WEEK'S VIEWINGS", ''];
    if (!viewings.length) {
      viewingsLines.push('No viewings scheduled this week.');
    } else {
      viewingsLines.push(`Total: ${viewings.length}.`);
      viewingsLines.push('');
      for (const v of viewings.slice(0, 5)) {
        const date = formatIrishDate(v.viewingDate);
        const time = v.viewingTime || 'time TBC';
        const where = [v.schemeName, v.unitRef ? `Unit ${v.unitRef}` : null].filter(Boolean).join(', ') || 'viewing';
        viewingsLines.push(`- ${date} ${time} — ${v.buyerName || 'Buyer'} — ${where}`);
      }
    }

    // --- Section 5: Needs attention summary ---
    const attentionTotal = aged.length + arrears.length + renewals.length;
    const summaryLines: string[] = [
      'NEEDS ATTENTION',
      '',
      `Total items needing attention: ${attentionTotal}`,
    ];

    const body = [
      salesLines.join('\n'),
      lettingsLines.join('\n'),
      arrearsLines.join('\n'),
      viewingsLines.join('\n'),
      summaryLines.join('\n'),
    ].join('\n\n');

    const draftId = randomUUID();
    const todayLabel = formatIrishDate(new Date().toISOString());

    const draft = {
      id: draftId,
      type: 'report' as const,
      recipient: { name: agentContext.displayName, email: 'self', role: 'agent' },
      subject: `Monday briefing — ${todayLabel}`,
      body,
      affected_record: { kind: 'briefing', id: draftId, label: 'Weekly briefing' },
      reasoning: `Ran 4 queries: aged contracts (6-week threshold), renewal window (next 90 days), rent arrears (notes ILIKE overdue), upcoming viewings (next 7 days). Found ${aged.length} aged, ${renewals.length} renewals, ${arrears.length} arrears, ${viewings.length} viewings.`,
    };

    return {
      skill,
      status: 'awaiting_approval',
      summary: `Generated weekly briefing covering ${aged.length} aged contract${aged.length === 1 ? '' : 's'}, ${renewals.length} renewal${renewals.length === 1 ? '' : 's'}, ${arrears.length} arrear${arrears.length === 1 ? '' : 's'}, ${viewings.length} viewing${viewings.length === 1 ? '' : 's'}.`,
      drafts: [draft],
      meta: { record_count: 1, generated_at: new Date().toISOString(), query },
    };
  } catch (err) {
    return errorEnvelope(skill, query, err);
  }
}

// =====================================================================
// Skill 4 — draft_lease_renewal
// =====================================================================
export async function draftLeaseRenewal(
  supabase: SupabaseClient,
  agentContext: SkillAgentContext,
  inputs: { tenancy_id?: string },
): Promise<AgenticSkillEnvelope> {
  const skill = 'draft_lease_renewal';
  const today = new Date();
  const todayIso = today.toISOString().split('T')[0];
  const ninetyIso = new Date(today.getTime() + 90 * 86400000).toISOString().split('T')[0];
  const tenancyFilter = inputs.tenancy_id ? ` AND id = '${inputs.tenancy_id}'` : '';
  const query = `agent_tenancies WHERE agent_id = '${agentContext.agentId}' AND status = 'active' AND lease_end BETWEEN ${todayIso} AND ${ninetyIso}${tenancyFilter}`;

  try {
    let tenancyQ = supabase
      .from('agent_tenancies')
      .select('id, letting_property_id, tenant_name, tenant_email, lease_end, status, rent_pcm')
      .eq('agent_id', agentContext.agentId)
      .eq('status', 'active')
      .gte('lease_end', todayIso)
      .lte('lease_end', ninetyIso);

    if (inputs.tenancy_id) tenancyQ = tenancyQ.eq('id', inputs.tenancy_id);

    const { data: tenancies, error: tenErr } = await tenancyQ;
    if (tenErr) throw tenErr;

    const rows = tenancies || [];
    if (!rows.length) {
      return {
        skill,
        status: 'awaiting_approval',
        summary: inputs.tenancy_id
          ? 'No matching active tenancy found in the 90-day renewal window.'
          : 'No tenancies in the 90-day renewal window — nothing to draft.',
        drafts: [],
        meta: { record_count: 0, generated_at: new Date().toISOString(), query },
      };
    }

    const propertyIds = Array.from(new Set(rows.map((t: any) => t.letting_property_id).filter(Boolean)));
    const propertyById = new Map<string, { address: string; city: string | null }>();
    if (propertyIds.length) {
      const { data: props } = await supabase
        .from('agent_letting_properties')
        .select('id, address, city')
        .in('id', propertyIds);
      for (const p of props || []) propertyById.set(p.id, { address: p.address, city: p.city ?? null });
    }

    const drafts = rows.map((t: any) => {
      const prop = propertyById.get(t.letting_property_id) || { address: 'Unknown property', city: null };
      const inRPZ = isInRPZ(prop.city);
      const currentRent = Number(t.rent_pcm ?? 0);
      const proposedRent = inRPZ
        ? roundToNearest5(currentRent * (1 + rpzUpliftCap()))
        : currentRent;
      const rentNote = inRPZ
        ? `In line with RPZ rules, the maximum increase is ${(rpzUpliftCap() * 100).toFixed(1)}% per annum.`
        : 'Outside RPZ — rent held at current level for this renewal. Open to discussion.';

      const leaseEnd = new Date(t.lease_end);
      const daysToLeaseEnd = Math.max(0, Math.round((leaseEnd.getTime() - today.getTime()) / 86400000));
      const { firstName: tenantFirst } = parseTenantName(t.tenant_name);
      const leaseEndLabel = formatIrishDate(t.lease_end);

      const body = [
        `Hi ${tenantFirst},`,
        ``,
        `Your current lease at ${prop.address} is due to end on ${leaseEndLabel} (in ${daysToLeaseEnd} days).`,
        ``,
        `We'd like to offer a renewal on the following terms:`,
        ``,
        `- 12-month fixed term from ${leaseEndLabel}`,
        `- Monthly rent: €${proposedRent} (current rent: €${currentRent})`,
        `- All other terms unchanged`,
        ``,
        rentNote,
        ``,
        `The renewal will be registered with the RTB as required.`,
        ``,
        `Let me know if you'd like to discuss or if you'd prefer to move out at the end of your current term. I'd appreciate a reply within the next 14 days so we can plan accordingly.`,
        ``,
        `Best,`,
        signature(agentContext),
      ].join('\n');

      return {
        id: randomUUID(),
        type: 'email' as const,
        recipient: {
          name: t.tenant_name || 'Tenant',
          email: t.tenant_email || 'tenant@tbc.invalid',
          role: 'tenant',
        },
        subject: `Lease renewal — ${prop.address}`,
        body,
        affected_record: {
          kind: 'tenancy',
          id: t.id,
          label: `${prop.address} — ${t.tenant_name || 'Tenant'}`,
        },
        reasoning: `Lease ends ${leaseEndLabel}. Property is ${inRPZ ? 'in RPZ' : 'outside RPZ'}. Proposed rent: €${proposedRent} (current €${currentRent}, ${inRPZ ? 'within RPZ cap' : 'no statutory cap'}).${t.tenant_email ? '' : ' Tenant email is missing on the tenancy record; recipient set to placeholder pending capture.'}`,
      };
    });

    return {
      skill,
      status: 'awaiting_approval',
      summary: `Drafted ${drafts.length} lease renewal offer${drafts.length === 1 ? '' : 's'} for tenancies in the renewal window.`,
      drafts,
      meta: { record_count: drafts.length, generated_at: new Date().toISOString(), query },
    };
  } catch (err) {
    return errorEnvelope(skill, query, err);
  }
}
