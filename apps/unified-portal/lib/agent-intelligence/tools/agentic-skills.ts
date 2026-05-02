import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { getRenewalWindow, getRentArrears, getUpcomingWeekViewings } from '../context';
import { isInRPZ, rpzUpliftCap } from '../rpz-zones';
import type { AgenticSkillEnvelope } from '../envelope';
import {
  resolveUnitIdentifier,
  getCandidateUnits,
  type CandidateIntent,
} from '../unit-resolver';
import { resolveSchemeName } from '../scheme-resolver';
import {
  resolveAgentContact,
  detectRoleKeyword,
  type ContactResolution,
  type ResolvedContact,
} from '../contact-resolver';

// Envelope returned by every agentic skill. Draft ids generated here are
// temporary — the registry adapter funnels the envelope through
// persistSkillEnvelope() which rewrites each draft id to a real
// `pending_drafts.id` before the chat route streams it to the client.
export type { AgenticSkillEnvelope };

export interface SkillAgentContext {
  agentProfileId: import('../ids').AgentProfileId;
  authUserId: import('../ids').AuthUserId;
  displayName: string;
  agencyName: string;
  phone?: string;
  /**
   * Active workspace mode. Skills that have lettings-flavoured copy
   * (rent_roll, lease_end, fallback help text) branch on this to keep
   * BTR vocabulary out of Sales workspaces. Undefined is treated as 'sales'.
   */
  mode?: 'sales' | 'lettings';
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

// Defensive scrubber for the free-text body content the model passes via
// `topic` / `context` / `custom_instruction`. The skill template already
// supplies the greeting and the sign-off + signature block, so any greeting
// or sign-off the model wrote into the body produces a duplicate. Strip a
// leading greeting line (Hi/Hello/Dear/Hey ...,) and a trailing sign-off
// block (Thanks/Best/Best regards/Kind regards/Sincerely/Yours/Cheers/
// Warm regards/Many thanks ... followed by name(s) and an optional company
// line) before assembly. Conservative on purpose — only strips when the
// pattern clearly matches a salutation or closing block.
export function stripGreetingAndSignoff(input: string | null | undefined): string {
  if (!input) return '';
  let text = String(input).replace(/\r\n/g, '\n').trim();
  if (!text) return '';

  const lines = text.split('\n');

  // Leading greeting: Hi X,  /  Hello there,  /  Dear Eoin,  /  Hey,
  const greetingRe = /^\s*(hi|hello|hey|dear|good\s+(morning|afternoon|evening))\b[^\n]{0,60}[,!.]?\s*$/i;
  while (lines.length && greetingRe.test(lines[0])) {
    lines.shift();
    while (lines.length && lines[0].trim() === '') lines.shift();
  }

  // Trailing sign-off block. Sign-off line is something like "Thanks,",
  // "Best regards,", "Kind regards,", "Sincerely,", "Yours,", "Cheers,",
  // "Warm regards,", "Many thanks,". Followed by 0–3 short non-empty
  // lines (the agent's name, optional title, optional company) before EOF.
  const signoffRe = /^\s*(thanks|thank you|thanks so much|many thanks|best|best regards|kind regards|warm regards|warmest regards|regards|sincerely|sincerely yours|yours|yours sincerely|yours faithfully|cheers|talk soon|speak soon)\b[^\n]{0,30}[,!.]?\s*$/i;
  // Walk backwards skipping trailing blanks.
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  // Find a sign-off line within the last 5 lines.
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 5); i--) {
    if (signoffRe.test(lines[i])) {
      // Drop everything from this index onward (sign-off + name/company tail).
      lines.length = i;
      break;
    }
  }

  // Trim trailing blanks one more time in case the pop loop above didn't.
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

  return lines.join('\n').trim();
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
      .eq('agent_id', agentContext.agentProfileId)
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
  const query = `agent_viewings WHERE status = 'completed' AND viewing_date >= current_date - ${windowDays} day${windowDays === 1 ? '' : 's'} AND agent_id = '${agentContext.agentProfileId}'`;

  try {
    const { data, error } = await supabase
      .from('agent_viewings')
      .select('id, buyer_name, buyer_email, scheme_name, unit_ref, viewing_date, viewing_time, status')
      .eq('agent_id', agentContext.agentProfileId)
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
      loadAgedForBriefing(supabase, agentContext.agentProfileId).catch(() => []),
      getRenewalWindow(supabase, agentContext.agentProfileId).catch(() => []),
      getRentArrears(supabase, agentContext.agentProfileId).catch(() => []),
      getUpcomingWeekViewings(supabase, agentContext.agentProfileId).catch(() => []),
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
  const query = `agent_tenancies WHERE agent_id = '${agentContext.agentProfileId}' AND status = 'active' AND lease_end BETWEEN ${todayIso} AND ${ninetyIso}${tenancyFilter}`;

  try {
    let tenancyQ = supabase
      .from('agent_tenancies')
      .select('id, letting_property_id, tenant_name, tenant_email, lease_end, status, rent_pcm')
      .eq('agent_id', agentContext.agentProfileId)
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

// =====================================================================
// Skill 5 — natural_query
// =====================================================================
//
// CRITICAL: we never construct raw SQL from the user's input. The question
// is matched against a small set of keyword patterns; each pattern maps to a
// pre-defined, parameterised Supabase query. Unmatched questions fall through
// to a help message. Agents (or the model) are expected to fall back to the
// more specific skills above when a question needs something richer than
// these canned intents.

type QueryIntent =
  | 'rent_roll'
  | 'lease_end'
  | 'aged_contracts'
  | 'viewings_period'
  | 'for_sale_count'
  | 'needs_attention'
  | 'fallback';

function detectIntent(lowered: string): QueryIntent {
  if (/rent\s*roll|monthly\s*rent|total\s*rent/.test(lowered)) return 'rent_roll';
  if (/when\s+does|lease\s+end(s|ing)?.*for|.*lease\s+up/.test(lowered)) return 'lease_end';
  if (/how\s+many.*aged|aged\s+contracts|overdue\s+contracts|contracts.*over\s*(6|six)\s*weeks/.test(lowered)) return 'aged_contracts';
  if (/(viewed|viewing).*(yesterday|last\s+week|this\s+week|today)/.test(lowered)) return 'viewings_period';
  if (/how\s+many.*(for\s*sale|available|on\s*market)/.test(lowered)) return 'for_sale_count';
  if (/need(s|ing)?\s+(my\s+)?attention|what\s+should\s+i|outstanding|priorities/.test(lowered)) return 'needs_attention';
  return 'fallback';
}

function extractTenantName(rawQuestion: string): string | null {
  const quoted = rawQuestion.match(/"([^"]+)"|'([^']+)'/);
  if (quoted) return (quoted[1] || quoted[2] || '').trim() || null;
  const afterKeyword = rawQuestion.match(/(?:does|for)\s+([A-Z][a-zA-Z'’-]+(?:\s+[A-Z][a-zA-Z'’-]+)?)/);
  if (afterKeyword) return afterKeyword[1].trim();
  return null;
}

// Monday-to-Sunday bounds for a given date. Pure ISO date strings (YYYY-MM-DD).
function weekBounds(base: Date): { start: string; end: string } {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun..6=Sat
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getTime() + mondayOffset * 86400000);
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

function periodFromQuestion(lowered: string): { label: string; start: string; end: string } {
  const today = new Date();
  const todayIso = today.toISOString().split('T')[0];
  if (/today/.test(lowered)) return { label: 'today', start: todayIso, end: todayIso };
  if (/yesterday/.test(lowered)) {
    const y = new Date(today.getTime() - 86400000).toISOString().split('T')[0];
    return { label: 'yesterday', start: y, end: y };
  }
  if (/last\s+week/.test(lowered)) {
    const lastWeekBase = new Date(today.getTime() - 7 * 86400000);
    const { start, end } = weekBounds(lastWeekBase);
    return { label: 'last week', start, end };
  }
  const { start, end } = weekBounds(today);
  return { label: 'this week', start, end };
}

export async function naturalQuery(
  supabase: SupabaseClient,
  agentContext: SkillAgentContext,
  inputs: { question: string },
): Promise<AgenticSkillEnvelope> {
  const skill = 'natural_query';
  const question = (inputs.question || '').trim();
  const lowered = question.toLowerCase();
  const intent = detectIntent(lowered);
  const query = `natural_query intent=${intent}`;

  try {
    let answer = '';
    let patternName: string = intent;
    let recordIds: string[] = [];
    let coverage: 'ok' | 'tool_returned_zero' | 'tool_not_applicable' = 'ok';

    const mode = agentContext.mode === 'lettings' ? 'lettings' : 'sales';

    if (intent === 'rent_roll') {
      if (mode !== 'lettings') {
        answer = "That's a lettings-mode capability. Switch to your Lettings workspace to ask about rent roll.";
      } else {
        const { data } = await supabase
          .from('agent_tenancies')
          .select('id, rent_pcm')
          .eq('agent_id', agentContext.agentProfileId)
          .eq('status', 'active');
        const rows = data || [];
        const total = rows.reduce((sum: number, r: any) => sum + (Number(r.rent_pcm) || 0), 0);
        recordIds = rows.map((r: any) => r.id);
        answer = `Your current monthly rent roll is €${total.toLocaleString('en-IE')} across ${rows.length} active tenanc${rows.length === 1 ? 'y' : 'ies'}.`;
      }
    } else if (intent === 'lease_end') {
      if (mode !== 'lettings') {
        answer = "That's a lettings-mode capability. Switch to your Lettings workspace to ask about lease end dates.";
      } else {
        const name = extractTenantName(question);
        if (!name) {
          answer = "I couldn't pick up a tenant name from that question. Try something like: when does Priya Shah's lease end?";
        } else {
          const { data } = await supabase
            .from('agent_tenancies')
            .select('id, letting_property_id, tenant_name, lease_end, status')
            .eq('agent_id', agentContext.agentProfileId)
            .eq('status', 'active')
            .ilike('tenant_name', `%${name}%`);
          const rows = data || [];
          if (!rows.length) {
            answer = "I couldn't find an active tenancy matching that name.";
          } else {
            const propertyIds = Array.from(new Set(rows.map((t: any) => t.letting_property_id).filter(Boolean)));
            const { data: props } = await supabase
              .from('agent_letting_properties')
              .select('id, address')
              .in('id', propertyIds);
            const addressById = new Map<string, string>((props || []).map((p: any) => [p.id, p.address]));
            if (rows.length === 1) {
              const t = rows[0];
              const address = addressById.get(t.letting_property_id) || 'Unknown property';
              const days = Math.max(0, Math.round((new Date(t.lease_end).getTime() - Date.now()) / 86400000));
              answer = `${t.tenant_name}'s lease at ${address} ends on ${formatIrishDate(t.lease_end)} (${days} days).`;
            } else {
              const top = rows.slice(0, 3).map((t: any) => {
                const address = addressById.get(t.letting_property_id) || 'Unknown property';
                return `- ${t.tenant_name} at ${address} — ${formatIrishDate(t.lease_end)}`;
              });
              answer = [`Found ${rows.length} matching tenancies:`, ...top].join('\n');
            }
            recordIds = rows.map((r: any) => r.id);
          }
        }
      }
    } else if (intent === 'aged_contracts') {
      const aged = await loadAgedForBriefing(supabase, agentContext.agentProfileId, 42);
      if (!aged.length) {
        answer = 'There are 0 contracts issued over 6 weeks ago with no signature.';
      } else {
        const top = aged.slice(0, 3).map(a => `${a.schemeName} Unit ${a.unitNumber}, ${a.daysAged}d`).join('; ');
        answer = `There are ${aged.length} contracts issued over 6 weeks ago with no signature. Top: ${top}.`;
      }
    } else if (intent === 'viewings_period') {
      const period = periodFromQuestion(lowered);
      const { data } = await supabase
        .from('agent_viewings')
        .select('id, buyer_name, scheme_name, unit_ref, viewing_date, viewing_time')
        .eq('agent_id', agentContext.agentProfileId)
        .gte('viewing_date', period.start)
        .lte('viewing_date', period.end)
        .order('viewing_date', { ascending: true });
      const rows = data || [];
      recordIds = rows.map((r: any) => r.id);
      if (!rows.length) {
        answer = `0 viewings ${period.label}.`;
      } else {
        const details = rows.slice(0, 5).map((v: any) => {
          const where = [v.scheme_name, v.unit_ref ? `Unit ${v.unit_ref}` : null].filter(Boolean).join(', ');
          const time = v.viewing_time || 'time TBC';
          return `- ${formatIrishDate(v.viewing_date)} ${time} — ${v.buyer_name || 'Buyer'} — ${where}`;
        });
        answer = [`${rows.length} viewings ${period.label}. Details:`, ...details].join('\n');
      }
    } else if (intent === 'for_sale_count') {
      const { data: asgs } = await supabase
        .from('agent_scheme_assignments')
        .select('development_id')
        .eq('agent_id', agentContext.agentProfileId)
        .eq('is_active', true);
      const devIds = Array.from(new Set((asgs || []).map((a: any) => a.development_id).filter(Boolean)));
      if (!devIds.length) {
        answer = 'You have 0 units currently for sale across your schemes.';
        coverage = 'tool_not_applicable';
      } else {
        const { data, count } = await supabase
          .from('unit_sales_pipeline')
          .select('unit_id', { count: 'exact' })
          .in('development_id', devIds)
          .eq('status', 'for_sale');
        const n = count ?? (data?.length || 0);
        answer = `You have ${n} unit${n === 1 ? '' : 's'} currently for sale across your schemes.`;
        coverage = n === 0 ? 'tool_returned_zero' : 'ok';
      }
    } else if (intent === 'needs_attention') {
      if (mode === 'lettings') {
        const [aged, arrears, renewals] = await Promise.all([
          loadAgedForBriefing(supabase, agentContext.agentProfileId, 42).catch(() => []),
          getRentArrears(supabase, agentContext.agentProfileId).catch(() => []),
          getRenewalWindow(supabase, agentContext.agentProfileId).catch(() => []),
        ]);
        answer = `Items needing attention: ${aged.length} aged contracts, ${arrears.length} rent arrears, ${renewals.length} renewals due.`;
      } else {
        const aged = await loadAgedForBriefing(supabase, agentContext.agentProfileId, 42).catch(() => []);
        answer = `Items needing attention: ${aged.length} aged contracts (issued over 6 weeks ago with no signature).`;
      }
    } else {
      patternName = 'fallback';
      answer = mode === 'lettings'
        ? 'I can answer questions about your pipeline, lettings, viewings, and tenancies. Try asking about: aged contracts, rent roll, lease end for [tenant], upcoming viewings, or what needs your attention.'
        : 'I can answer questions about your pipeline, viewings, and what needs your attention. Try asking about: aged contracts, units sale-agreed but not signed, buyers awaiting kitchen finishes, or upcoming closings.';
    }

    const draftId = randomUUID();
    const firstLine = answer.split('\n')[0] || answer;
    const subject = `Answer: ${question}`.slice(0, 100);
    const reasoningParts = [
      `Matched intent pattern '${patternName}'. Backed by ${recordIds.length} record${recordIds.length === 1 ? '' : 's'}.`,
    ];
    if (recordIds.length) reasoningParts.push(`Record IDs: ${recordIds.slice(0, 10).join(', ')}${recordIds.length > 10 ? ` (+${recordIds.length - 10} more)` : ''}`);

    const draft = {
      id: draftId,
      type: 'report' as const,
      recipient: { name: agentContext.displayName, email: 'self', role: 'agent' },
      subject,
      body: answer,
      affected_record: { kind: 'query', id: draftId, label: question.slice(0, 60) },
      reasoning: reasoningParts.join('\n'),
    };

    return {
      skill,
      status: 'awaiting_approval',
      summary: firstLine.slice(0, 120),
      drafts: [draft],
      meta: { record_count: 1, generated_at: new Date().toISOString(), query },
      coverage,
    };
  } catch (err) {
    return errorEnvelope(skill, query, err);
  }
}

// =====================================================================
// Skill 6 — schedule_viewing_draft
// =====================================================================
//
// Unlike the legacy schedule_viewing write tool, this skill NEVER inserts a
// viewing row. It resolves the property reference, checks for clashes, and
// returns two drafts: the would-be viewing record (as a JSON review body) and
// a confirmation email to the buyer. Both drafts are held in the envelope
// and materialised only by the /confirm endpoint after agent approval.

function formatClockTime(hhmm: string | null): string {
  if (!hhmm) return 'time TBC';
  const m = hhmm.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return hhmm;
  const h = Number(m[1]);
  const min = m[2];
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return min === '00' ? `${h12}${suffix}` : `${h12}:${min}${suffix}`;
}

export async function scheduleViewingDraft(
  supabase: SupabaseClient,
  agentContext: SkillAgentContext,
  inputs: {
    unit_or_property_ref: string;
    buyer_name: string;
    buyer_email?: string;
    buyer_phone?: string;
    preferred_datetime: string;
  },
): Promise<AgenticSkillEnvelope> {
  const skill = 'schedule_viewing_draft';
  const ref = (inputs.unit_or_property_ref || '').trim();
  const query = `schedule_viewing_draft ref="${ref}" buyer="${inputs.buyer_name}" at=${inputs.preferred_datetime}`;

  try {
    // --- Step B (parse datetime up front so we fail fast) ---
    const dt = new Date(inputs.preferred_datetime);
    if (Number.isNaN(dt.getTime())) {
      return {
        skill,
        status: 'awaiting_approval',
        summary: 'Invalid datetime format. Use ISO 8601.',
        drafts: [],
        meta: { record_count: 0, generated_at: new Date().toISOString(), query },
      };
    }
    const viewingDate = dt.toISOString().split('T')[0];
    const viewingTime = dt.toISOString().split('T')[1].slice(0, 8); // HH:MM:SS

    // --- Step A: resolve reference ---
    type Resolved =
      | { kind: 'sales_unit'; unitId: string; developmentId: string; schemeName: string; unitNumber: string; label: string }
      | { kind: 'letting_property'; lettingPropertyId: string; address: string; city: string | null; label: string };
    let resolved: Resolved | null = null;

    const unitMatch = ref.match(/unit\s*(\w+)/i);
    if (unitMatch && typeof unitMatch.index === 'number') {
      const unitToken = unitMatch[1];
      const schemeToken = ref.slice(0, unitMatch.index).trim();
      if (schemeToken) {
        // Session 14 — resolve the scheme through the alias table and the
        // unit through the strict exact-match resolver. Pre-14 this was
        // `.ilike('name', '%<schemeToken>%')` + `unit_number.ilike.<t>` →
        // silent first-row pick.
        const { data: asgs } = await supabase
          .from('agent_scheme_assignments')
          .select('development_id')
          .eq('agent_id', agentContext.agentProfileId)
          .eq('is_active', true);
        const devIds = Array.from(
          new Set((asgs || []).map((a: any) => a.development_id).filter(Boolean)),
        );
        const { data: devs } = devIds.length
          ? await supabase.from('developments').select('id, name').in('id', devIds)
          : { data: [] };
        const devList = (devs || []) as Array<{ id: string; name: string }>;
        const schemeContext = {
          assignedDevelopmentIds: devList.map((d) => d.id),
          assignedDevelopmentNames: devList.map((d) => d.name),
        };
        const schemeResolution = await resolveSchemeName(supabase, schemeToken, schemeContext);
        if (schemeResolution.ok) {
          const unitRes = await resolveUnitIdentifier(supabase, unitToken, {
            developmentIds: [schemeResolution.developmentId],
            preferredDevelopmentId: schemeResolution.developmentId,
          });
          if (unitRes.status === 'ok') {
            resolved = {
              kind: 'sales_unit',
              unitId: unitRes.unit.id,
              developmentId: unitRes.unit.development_id,
              schemeName: schemeResolution.canonicalName,
              unitNumber: unitRes.unit.unit_number || unitRes.unit.unit_uid || unitToken,
              label: `${schemeResolution.canonicalName} Unit ${unitRes.unit.unit_number || unitRes.unit.unit_uid || unitToken}`,
            };
          }
        }
      }
    }

    if (!resolved) {
      const { data: props } = await supabase
        .from('agent_letting_properties')
        .select('id, address, city')
        .eq('agent_id', agentContext.agentProfileId)
        .ilike('address', `%${ref}%`);
      const prop = (props || [])[0];
      if (prop) {
        resolved = {
          kind: 'letting_property',
          lettingPropertyId: prop.id,
          address: prop.address,
          city: prop.city ?? null,
          label: prop.address,
        };
      }
    }

    if (!resolved) {
      return {
        skill,
        status: 'awaiting_approval',
        summary: `Could not resolve property reference "${ref}". Please use a clearer identifier.`,
        drafts: [],
        meta: { record_count: 0, generated_at: new Date().toISOString(), query },
      };
    }

    // --- Step C: conflict check (±30 minutes on the same date) ---
    const { data: existing } = await supabase
      .from('agent_viewings')
      .select('id, buyer_name, viewing_time, viewing_date')
      .eq('agent_id', agentContext.agentProfileId)
      .eq('viewing_date', viewingDate);

    const prefMinutes = dt.getUTCHours() * 60 + dt.getUTCMinutes();
    const conflicts = (existing || []).filter((v: any) => {
      if (!v.viewing_time) return false;
      const m = v.viewing_time.match(/^(\d{1,2}):(\d{2})/);
      if (!m) return false;
      const minutes = Number(m[1]) * 60 + Number(m[2]);
      return Math.abs(minutes - prefMinutes) <= 30;
    });
    const conflictNote = conflicts.length
      ? ` Conflict: existing viewing with ${conflicts[0].buyer_name || 'unknown buyer'} at ${conflicts[0].viewing_time} on ${viewingDate}.`
      : '';

    // --- Step D: build two drafts ---
    const schemeName = resolved.kind === 'sales_unit' ? resolved.schemeName : null;
    const unitRef = resolved.kind === 'sales_unit' ? resolved.unitNumber : resolved.address;
    const recordRow: Record<string, any> = {
      agent_id: agentContext.agentProfileId,
      buyer_name: inputs.buyer_name,
      buyer_email: inputs.buyer_email || null,
      buyer_phone: inputs.buyer_phone || null,
      viewing_date: viewingDate,
      viewing_time: viewingTime,
      status: 'confirmed',
      source: 'intelligence',
      unit_ref: unitRef,
    };
    if (resolved.kind === 'sales_unit') {
      recordRow.development_id = resolved.developmentId;
      recordRow.unit_id = resolved.unitId;
      recordRow.scheme_name = schemeName;
    } else {
      recordRow.letting_property_id = resolved.lettingPropertyId;
    }

    const recordDraftId = randomUUID();
    const affectedId = resolved.kind === 'sales_unit' ? resolved.unitId : resolved.lettingPropertyId;

    const recordDraft = {
      id: recordDraftId,
      type: 'viewing_record' as const,
      body: JSON.stringify(recordRow, null, 2),
      affected_record: { kind: resolved.kind, id: affectedId, label: resolved.label },
      reasoning: `Will create new viewing record on approval.${conflictNote}`,
    };

    const dateLabel = formatIrishDate(viewingDate);
    const timeLabel = formatClockTime(viewingTime);
    const buyerFirst = firstName(inputs.buyer_name);

    const emailBody = [
      `Hi ${buyerFirst},`,
      ``,
      `Thanks for your interest in ${resolved.label}.`,
      ``,
      `Just confirming your viewing on ${dateLabel} at ${timeLabel}. I'll be there to meet you and walk you through the property.`,
      ``,
      `If any questions come up beforehand, or you need to reschedule, just reply to this email.`,
      ``,
      `Looking forward to meeting you.`,
      ``,
      `Best,`,
      signature(agentContext),
    ].join('\n');

    const emailDraft = {
      id: randomUUID(),
      type: 'email' as const,
      recipient: {
        name: inputs.buyer_name,
        email: inputs.buyer_email || 'buyer@tbc.invalid',
        role: 'buyer',
      },
      subject: `Viewing confirmed — ${resolved.label} on ${dateLabel}`,
      body: emailBody,
      affected_record: { kind: resolved.kind, id: affectedId, label: resolved.label },
      reasoning: 'Confirmation email to buyer.',
    };

    return {
      skill,
      status: 'awaiting_approval',
      summary: `Prepared viewing for ${inputs.buyer_name} at ${resolved.label} on ${dateLabel} at ${timeLabel}.`,
      drafts: [recordDraft, emailDraft],
      meta: { record_count: 2, generated_at: new Date().toISOString(), query },
    };
  } catch (err) {
    return errorEnvelope(skill, query, err);
  }
}

// =====================================================================
// Skill 7 — draft_message (rewritten as envelope-producing)
// =====================================================================
//
// Session 6D fix. The pre-6D `draftMessage` returned a template plus an
// `instruction` string telling the model to "Generate the COMPLETE email
// now" inline. That meant the model wrote a convincing email in its
// streamed response, said "drafts are ready for your review", and
// persisted NOTHING. This version produces a real draft every time the
// tool is called. Multi-recipient requests naturally resolve as multiple
// parallel tool calls (gpt-4o-mini supports these) — each call adds one
// draft to the turn's envelope.

interface DraftMessageSkillInput {
  recipient_type: 'buyer' | 'solicitor' | 'developer' | 'tenant' | string;
  recipient_name: string;
  context: string;
  tone?: string;
  related_unit?: string;
  related_scheme?: string;
  related_property?: string;
  recipient_email?: string;
}

function toneGreeting(firstNameValue: string): string {
  return `Hi ${firstNameValue},`;
}

function toneSignOff(tone: string): string {
  if (tone === 'formal') return 'Kind regards,';
  if (tone === 'urgent') return 'Thanks,';
  if (tone === 'gentle_chase') return 'Thanks,';
  return 'Thanks,';
}

// Lettings branch of draft_message. Resolves the recipient against
// agent_tenancies + agent_letting_properties (active tenancy only) instead
// of the sales scheme/unit/buyer chain. Triggered when recipient_type ===
// 'tenant'. The agent can pass the tenant's name, the property address, or
// both — at least one is required.
async function draftTenantMessage(
  supabase: SupabaseClient,
  agentContext: SkillAgentContext,
  inputs: DraftMessageSkillInput,
): Promise<AgenticSkillEnvelope> {
  const skill = 'draft_message';
  const recipientName = (inputs.recipient_name || '').trim();
  const propertyHint = (inputs.related_property || '').trim();
  // Scrub greeting/sign-off the model may have included — the template
  // below adds them once, which is the single source of truth.
  const context = stripGreetingAndSignoff(inputs.context);
  const tone = (inputs.tone || 'warm').trim();
  const query = `draft_message recipient_type=tenant recipient="${recipientName}" property="${propertyHint}"`;

  if (!recipientName && !propertyHint) {
    return {
      skill,
      status: 'awaiting_approval',
      summary: 'Tenant name or property address is required to draft a message.',
      drafts: [],
      meta: { record_count: 0, generated_at: new Date().toISOString(), query },
    };
  }

  try {
    const { data: tenancies, error } = await supabase
      .from('agent_tenancies')
      .select('id, tenant_name, tenant_email, tenant_phone, lease_end, rent_pcm, letting_property_id, agent_letting_properties!inner(id, address, address_line_1, eircode, status)')
      .eq('agent_id', agentContext.agentProfileId)
      .eq('status', 'active');

    if (error || !tenancies?.length) {
      return {
        skill,
        status: 'awaiting_approval',
        summary: 'No active tenancies found for your portfolio.',
        drafts: [],
        meta: { record_count: 0, generated_at: new Date().toISOString(), query },
      };
    }

    const lowerName = recipientName.toLowerCase();
    const lowerProp = propertyHint.toLowerCase();

    const matches = (tenancies as any[]).filter((t) => {
      const tName = (t.tenant_name || '').toLowerCase();
      const prop = t.agent_letting_properties;
      const addr1 = (prop?.address_line_1 || '').toLowerCase();
      const fullAddr = (prop?.address || '').toLowerCase();
      const propMatch = !lowerProp
        || addr1.includes(lowerProp)
        || fullAddr.includes(lowerProp)
        || (addr1 && lowerProp.includes(addr1))
        || (fullAddr && lowerProp.includes((fullAddr.split(',')[0] || '').trim()));
      const nameMatch = !lowerName
        || tName.includes(lowerName)
        || (tName && lowerName.includes(tName));
      return propMatch && nameMatch;
    });

    if (matches.length === 0) {
      const candidates = (tenancies as any[]).slice(0, 5).map((t) => {
        const prop = t.agent_letting_properties;
        return `${t.tenant_name} (${prop?.address_line_1 || prop?.address || 'address tbc'})`;
      }).join(', ');
      const moreSuffix = tenancies.length > 5 ? ` and ${tenancies.length - 5} more` : '';
      const queryDesc = recipientName && propertyHint
        ? `"${recipientName}" at "${propertyHint}"`
        : recipientName ? `"${recipientName}"`
          : `"${propertyHint}"`;
      return {
        skill,
        status: 'awaiting_approval',
        summary: `I couldn't find an active tenancy matching ${queryDesc}. Active tenants you have on record: ${candidates}${moreSuffix}.`,
        drafts: [],
        meta: { record_count: 0, generated_at: new Date().toISOString(), query },
      };
    }

    if (matches.length > 1) {
      const ambiguous = matches.slice(0, 5).map((t: any) => {
        const prop = t.agent_letting_properties;
        return `${t.tenant_name} at ${prop?.address_line_1 || prop?.address}`;
      }).join(' or ');
      return {
        skill,
        status: 'awaiting_approval',
        summary: `Multiple matching tenancies — could you clarify? I see: ${ambiguous}.`,
        drafts: [],
        meta: { record_count: 0, generated_at: new Date().toISOString(), query },
      };
    }

    const tenancy: any = matches[0];
    const property: any = tenancy.agent_letting_properties;
    const tenantFullName = tenancy.tenant_name || 'Tenant';
    const tenantFirst = firstName(tenantFullName);
    const propertyAddress = property?.address_line_1 || property?.address || 'your property';
    const tenantEmail = tenancy.tenant_email || 'tenant@tbc.invalid';

    const subject = context
      ? `Re: ${context.slice(0, 60)}`
      : `Quick note from ${agentContext.agencyName || 'your letting agent'}`;

    const body = [
      toneGreeting(tenantFirst),
      '',
      context || '[Message body — fill in the intent here.]',
      '',
      "Let me know what works for you and I'll come back to confirm.",
      '',
      toneSignOff(tone),
      signature(agentContext),
    ].filter((line) => line !== undefined).join('\n');

    return {
      skill,
      status: 'awaiting_approval',
      summary: `Drafted a message to ${tenantFullName} at ${propertyAddress}.`,
      drafts: [{
        id: randomUUID(),
        type: 'email' as const,
        recipient: { name: tenantFullName, email: tenantEmail, role: 'tenant' },
        subject,
        body,
        affected_record: { kind: 'tenancy', id: tenancy.id, label: `${propertyAddress} — ${tenantFullName}` },
        reasoning: `Drafted per agent request (${tone} tone). ${tenancy.tenant_email ? '' : 'Tenant email was not on file; placeholder used — please fill in before approving.'}`.trim(),
      }],
      meta: { record_count: 1, generated_at: new Date().toISOString(), query },
    };
  } catch (err) {
    return errorEnvelope(skill, query, err);
  }
}

export async function draftMessageSkill(
  supabase: SupabaseClient,
  agentContext: SkillAgentContext,
  inputs: DraftMessageSkillInput,
): Promise<AgenticSkillEnvelope> {
  const skill = 'draft_message';
  // Lettings branch: when the model calls with recipient_type='tenant',
  // route to the tenant resolver. The sales path below stays unchanged.
  if (inputs.recipient_type === 'tenant') {
    return draftTenantMessage(supabase, agentContext, inputs);
  }
  // Session 14.10 — recipient_name is now optional. Many real instructions
  // refer to a buyer by unit only ("reach out to number 3, Árdan View" —
  // no name attached). The skill can derive the recipient name from the
  // resolved unit's purchaser_name. We carry recipientName as a let so the
  // unit-resolution stage below can fill it in when empty.
  let recipientName = (inputs.recipient_name || '').trim();
  // Scrub greeting/sign-off the model may have included — the template
  // below adds them once, which is the single source of truth.
  const context = stripGreetingAndSignoff(inputs.context);
  const tone = (inputs.tone || (inputs.recipient_type === 'solicitor' ? 'formal' : 'warm')).trim();
  const query = `draft_message recipient="${recipientName}" unit="${inputs.related_unit || ''}" scheme="${inputs.related_scheme || ''}"`;

  // Defer the "no recipient" check until AFTER unit resolution. We only
  // surface the error if no unit was given AND no name was given AND no
  // scheme was given — i.e. nothing the skill can hang a draft on.
  if (!recipientName && !inputs.related_unit && !inputs.related_scheme) {
    return {
      skill,
      status: 'awaiting_approval',
      summary: 'Recipient name (or unit/scheme) is required to draft an email.',
      drafts: [],
      meta: { record_count: 0, generated_at: new Date().toISOString(), query },
    };
  }

  try {
    // Strict scheme/unit resolution when the caller specified a unit
    // context. If related_scheme or related_unit fails to resolve, we
    // return an envelope with zero drafts plus a skipped reason —
    // matching the draftBuyerFollowups contract.
    let resolvedEmail: string | null = inputs.recipient_email || null;
    let resolvedUnitNumber: string | null = null;
    let resolvedSchemeName: string | null = null;
    let affectedUnitId: string | null = null;
    let resolvedDevId: string | null = null;

    const hasUnitContext = Boolean(inputs.related_scheme || inputs.related_unit);

    if (hasUnitContext) {
      // --- Stage: resolve scheme ---
      if (inputs.related_scheme) {
        const { data: asgs } = await supabase
          .from('agent_scheme_assignments')
          .select('development_id')
          .eq('agent_id', agentContext.agentProfileId)
          .eq('is_active', true);
        const devIds = Array.from(
          new Set((asgs || []).map((a: any) => a.development_id).filter(Boolean)),
        );
        const { data: devs } = devIds.length
          ? await supabase.from('developments').select('id, name').in('id', devIds)
          : { data: [] };
        const devList = (devs || []) as Array<{ id: string; name: string }>;
        const schemeContext = {
          assignedDevelopmentIds: devList.map((d) => d.id),
          assignedDevelopmentNames: devList.map((d) => d.name),
        };
        const schemeResolution = await resolveSchemeName(
          supabase,
          inputs.related_scheme,
          schemeContext,
        );
        if (!schemeResolution.ok) {
          const reasonText =
            schemeResolution.reason === 'not_found'
              ? `I couldn't find a scheme matching "${inputs.related_scheme}". Your assigned schemes are: ${schemeResolution.candidates.join(', ')}.`
              : schemeResolution.reason === 'ambiguous'
                ? `"${inputs.related_scheme}" matches multiple schemes (${schemeResolution.candidates.join(', ')}). Please be specific.`
                : `Scheme "${inputs.related_scheme}" is not in your assigned list.`;
          // Session 14 — thread top_candidate through so the chat route
          // can turn this refusal into a "Did you mean X? (yes/no)" prompt
          // when exactly one assigned scheme is a phonetic neighbour.
          const topCandidate =
            schemeResolution.reason === 'not_found' && schemeResolution.top_candidate
              ? {
                  name: schemeResolution.top_candidate.name,
                  developmentId: schemeResolution.top_candidate.developmentId,
                  typed: inputs.related_scheme,
                }
              : null;
          return {
            skill,
            status: 'awaiting_approval',
            summary: reasonText,
            drafts: [],
            meta: {
              record_count: 0,
              generated_at: new Date().toISOString(),
              query,
              // @ts-ignore — read by the chat route's scheme-not-found injector
              skipped: [{ unit_identifier: inputs.related_unit || '', reason: reasonText }],
              ...(topCandidate ? { top_candidate: topCandidate } : {}),
            } as any,
          };
        }
        resolvedDevId = schemeResolution.developmentId;
        resolvedSchemeName = schemeResolution.canonicalName;
      }

      // --- Stage: resolve unit ---
      if (inputs.related_unit) {
        // Need the scope list for the unit resolver. If scheme resolved,
        // use just that dev; otherwise use the agent's full assigned set.
        let unitScope: string[] = [];
        if (resolvedDevId) {
          unitScope = [resolvedDevId];
        } else {
          const { data: asgs } = await supabase
            .from('agent_scheme_assignments')
            .select('development_id')
            .eq('agent_id', agentContext.agentProfileId)
            .eq('is_active', true);
          unitScope = Array.from(
            new Set((asgs || []).map((a: any) => a.development_id).filter(Boolean)),
          );
        }
        const unitRes = await resolveUnitIdentifier(supabase, inputs.related_unit, {
          developmentIds: unitScope,
          preferredDevelopmentId: resolvedDevId,
        });
        if (unitRes.status !== 'ok') {
          const reasonText =
            unitRes.status === 'not_found'
              ? `I couldn't find Unit ${inputs.related_unit}${resolvedSchemeName ? ` in ${resolvedSchemeName}` : ''}.`
              : `Unit "${inputs.related_unit}" matches multiple units across schemes. Include the scheme name.`;
          return {
            skill,
            status: 'awaiting_approval',
            summary: reasonText,
            drafts: [],
            meta: {
              record_count: 0,
              generated_at: new Date().toISOString(),
              query,
              // @ts-ignore
              skipped: [{ unit_identifier: inputs.related_unit, reason: reasonText }],
            } as any,
          };
        }
        resolvedUnitNumber = unitRes.unit.unit_number || unitRes.unit.unit_uid || inputs.related_unit;
        if (!resolvedEmail && unitRes.unit.purchaser_email) {
          resolvedEmail = unitRes.unit.purchaser_email;
        }
        // Session 14.10 — derive recipientName from the unit's purchaser
        // when the user didn't name a person explicitly. "reach out to
        // number 3, Árdan View" should draft to whoever the purchaser of
        // Unit 3 is on file (the Foley family in our test data) without
        // requiring the user to also type the name. Falls back to the
        // unit_sales_pipeline.purchaser_name if the units row doesn't
        // carry one, since pipeline rows are the canonical record for
        // sale-agreed-and-later state.
        if (!recipientName) {
          if (unitRes.unit.purchaser_name) {
            recipientName = unitRes.unit.purchaser_name.trim();
          } else {
            const { data: pipe } = await supabase
              .from('unit_sales_pipeline')
              .select('purchaser_name, purchaser_email')
              .eq('unit_id', unitRes.unit.id)
              .maybeSingle();
            if (pipe?.purchaser_name) recipientName = pipe.purchaser_name.trim();
            if (!resolvedEmail && pipe?.purchaser_email) resolvedEmail = pipe.purchaser_email;
          }
        }
        if (!resolvedSchemeName) {
          // Only the unit was specified; pull the scheme name from the
          // resolved unit's development_id.
          const { data: dev } = await supabase
            .from('developments')
            .select('name')
            .eq('id', unitRes.unit.development_id)
            .maybeSingle();
          resolvedSchemeName = dev?.name ?? null;
        }
        affectedUnitId = unitRes.unit.id;
      }
    }

    // Session 14.10 — final guard: if after unit resolution we STILL have
    // no recipient name, surface the honest reason. The unit has no
    // purchaser on file yet (truly unsold or reserved-without-record).
    if (!recipientName) {
      return {
        skill,
        status: 'awaiting_approval',
        summary: resolvedUnitNumber && resolvedSchemeName
          ? `I couldn't find a buyer on file for Unit ${resolvedUnitNumber}, ${resolvedSchemeName}. Add a recipient name or specify the buyer.`
          : 'Recipient name (or unit/scheme) is required to draft an email.',
        drafts: [],
        meta: { record_count: 0, generated_at: new Date().toISOString(), query },
      };
    }

    const unitLabel = resolvedUnitNumber && resolvedSchemeName
      ? `Unit ${resolvedUnitNumber}, ${resolvedSchemeName}`
      : resolvedUnitNumber
        ? `Unit ${resolvedUnitNumber}`
        : resolvedSchemeName || '';

    // Contact resolution. If the model didn't pass recipient_email and the
    // unit-resolution stage didn't pull one off the purchaser record, run
    // the contact resolver against the recipient_name (or the role keyword
    // it implies). Falls into one of three branches:
    //   - one match: use that email
    //   - multiple: return a structured needs_recipient envelope so the
    //     chat route can surface an inline "which one?" prompt
    //   - none: return needs_recipient with no candidates so the chat
    //     route can ask the user to paste an address
    if (!resolvedEmail && !affectedUnitId) {
      const role = detectRoleKeyword(recipientName);
      const resolution = await resolveAgentContact(
        supabase,
        { agentProfileId: agentContext.agentProfileId },
        {
          name: recipientName,
          role: role,
          schemeHint: inputs.related_scheme || resolvedSchemeName,
        },
      );
      const ndsEnvelope = needsRecipientEnvelope(skill, query, recipientName, resolution);
      if (ndsEnvelope) return ndsEnvelope;
      if (resolution.status === 'one') {
        resolvedEmail = resolution.contact.email;
        // If the resolver disambiguated from a role keyword, use the
        // resolved name as the recipient label too — "Developer (Lakeside
        // Manor)" reads better than "the developer" on a draft card.
        if (!recipientName || detectRoleKeyword(recipientName)) {
          recipientName = resolution.contact.name;
        }
      }
    }

    const subject = unitLabel
      ? `Following up — ${unitLabel}`
      : `Following up — ${context.slice(0, 60)}`;

    const body = [
      toneGreeting(firstName(recipientName)),
      '',
      context,
      '',
      toneSignOff(tone),
      signature(agentContext),
    ].filter((line) => line !== undefined).join('\n');

    // After resolver: when a unit is resolved but no email is on file we
    // still produce a draft using the buyer@tbc.invalid sentinel (the
    // persistence guard explicitly allows this — agent fills it in before
    // approving). When no unit AND no resolved email, the resolver
    // already returned a needs_recipient envelope above; we never reach
    // the placeholder path here.
    const placeholderEmail = 'buyer@tbc.invalid';
    const finalEmail = resolvedEmail || placeholderEmail;
    const draft = {
      id: randomUUID(),
      type: 'email' as const,
      recipient: {
        name: recipientName,
        email: finalEmail,
        role: inputs.recipient_type || 'recipient',
      },
      subject,
      body,
      affected_record: affectedUnitId
        ? { kind: 'sales_unit', id: affectedUnitId, label: unitLabel || recipientName }
        : { kind: 'contact', id: recipientName, label: recipientName },
      reasoning: `Drafted per agent request (${tone} tone). ${resolvedEmail ? '' : 'Recipient email was not on file; placeholder used — please fill in before approving.'}`.trim(),
    };

    return {
      skill,
      status: 'awaiting_approval',
      summary: `Drafted email to ${recipientName}${unitLabel ? ` — ${unitLabel}` : ''}.`,
      drafts: [draft],
      meta: {
        record_count: 1,
        generated_at: new Date().toISOString(),
        query,
        // @ts-ignore — Session 13 alias capture keys off this
        resolved_development_ids: resolvedDevId ? [resolvedDevId] : [],
      } as any,
    };
  } catch (err) {
    return errorEnvelope(skill, query, err);
  }
}

/**
 * Build a structured "needs recipient" envelope when contact resolution
 * comes back empty or ambiguous. Carries the candidate list (if any) on
 * meta.needs_recipient so the chat route can render a disambiguation
 * prompt that names each candidate plus the option to paste an address.
 *
 * Returns null when the resolution succeeded with exactly one match —
 * the caller proceeds with the resolved email.
 */
function needsRecipientEnvelope(
  skill: string,
  query: string,
  recipientQuery: string,
  resolution: ContactResolution,
): AgenticSkillEnvelope | null {
  if (resolution.status === 'one') return null;
  const correlationId = randomUUID().slice(0, 8);
  const niceQuery = recipientQuery?.trim() || 'that recipient';
  if (resolution.status === 'multiple') {
    const lines = resolution.candidates.slice(0, 6).map((c, i) => {
      const where = c.schemeName
        ? c.unitLabel
          ? ` — ${c.unitLabel}, ${c.schemeName}`
          : ` — ${c.schemeName}`
        : c.unitLabel
          ? ` — ${c.unitLabel}`
          : '';
      return `${i + 1}. ${c.name}${where} (${c.email})`;
    });
    const summary = [
      `I found ${resolution.candidates.length} contacts that match "${niceQuery}". Which one did you mean?`,
      ...lines,
      'Or paste an email address.',
    ].join('\n');
    return {
      skill,
      status: 'awaiting_approval',
      summary,
      drafts: [],
      meta: {
        record_count: 0,
        generated_at: new Date().toISOString(),
        query,
        // @ts-ignore — chat route surfaces this
        needs_recipient: {
          correlationId,
          recipient_query: niceQuery,
          candidates: resolution.candidates.map((c) => ({
            name: c.name,
            email: c.email,
            role: c.role,
            scheme_name: c.schemeName ?? null,
            unit_label: c.unitLabel ?? null,
          })),
        },
      } as any,
    };
  }
  // status === 'none'
  const summary = `I couldn't find an email on file for "${niceQuery}". Reply with the address and I'll draft the email.`;
  return {
    skill,
    status: 'awaiting_approval',
    summary,
    drafts: [],
    meta: {
      record_count: 0,
      generated_at: new Date().toISOString(),
      query,
      // @ts-ignore
      needs_recipient: {
        correlationId,
        recipient_query: niceQuery,
        candidates: [],
        searched: resolution.searched,
      },
    } as any,
  };
}

// =====================================================================
// Skill 8 — draft_buyer_followups (explicit multi-recipient)
// =====================================================================
//
// Session 6D introduced this skill. Session 8 was planned to add `purpose`
// + joint-purchaser handling but didn't land. Session 9 adds those plus
// strict unit resolution and purpose preconditions in one go.

export type DraftBuyerFollowupPurpose =
  | 'chase'
  | 'congratulate_handover'
  | 'introduce'
  | 'update'
  | 'custom';

interface DraftBuyerFollowupsInput {
  targets: Array<{
    unit_identifier: string;
    scheme_name?: string;
    recipient_name?: string;
  }>;
  topic?: string;
  tone?: string;
  purpose?: DraftBuyerFollowupPurpose;
  custom_instruction?: string;
}

/**
 * Parse a purchaser_name field into individual given names. The units
 * table stores joint purchasers as a single free-text string like
 * "Laura Hayes and Dylan Rogers" or "Laura Hayes & Dylan Rogers".
 * One email per household, both names greeted — matches how an agent
 * actually writes.
 */
export function parseJointPurchaserNames(raw: string | null | undefined): {
  fullName: string;
  firstNames: string[];
  greeting: string;
} {
  const fallback = { fullName: 'Buyer', firstNames: ['there'], greeting: 'Hi there,' };
  if (!raw) return fallback;
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallback;

  const parts = cleaned
    .split(/\s+and\s+|\s*&\s*/i)
    .map((p) => p.replace(/\b(Mr|Mrs|Ms|Miss|Dr)\.?\s+/gi, '').trim())
    .filter(Boolean);
  if (!parts.length) return fallback;

  const firstNames = parts.map((p) => p.split(/\s+/)[0] || 'there');
  const greeting =
    firstNames.length === 1
      ? `Hi ${firstNames[0]},`
      : firstNames.length === 2
        ? `Hi ${firstNames[0]} and ${firstNames[1]},`
        : `Hi ${firstNames.slice(0, -1).join(', ')} and ${firstNames[firstNames.length - 1]},`;
  return { fullName: cleaned, firstNames, greeting };
}

// -- Purpose preconditions: the skill refuses to draft when the resolved
//    unit doesn't satisfy the precondition for the requested purpose.
//    "Welcome to your new home" for a unit with no handover_date is the
//    bug we're killing.
interface UnitStateForPrecondition {
  handover_date: string | null;
  unit_status: string | null;
  contracts_issued_date: string | null;
  signed_contracts_date: string | null;
  counter_signed_date: string | null;
  purchaser_name: string | null;
}

const PURPOSE_PRECONDITIONS: Record<
  DraftBuyerFollowupPurpose,
  { check: (u: UnitStateForPrecondition) => boolean; rejectionReason: (unitLabel: string) => string }
> = {
  congratulate_handover: {
    check: (u) => Boolean(u.handover_date) || u.unit_status === 'handed_over' || u.unit_status === 'sold',
    rejectionReason: (label) =>
      `Cannot congratulate ${label} on receiving keys — handover hasn't happened yet.`,
  },
  chase: {
    check: (u) => !!u.contracts_issued_date && !u.signed_contracts_date && !u.counter_signed_date,
    rejectionReason: (label) =>
      `Cannot draft a contract chase for ${label} — no unsigned contracts on file.`,
  },
  introduce: {
    check: (u) => !!u.purchaser_name,
    rejectionReason: (label) =>
      `Cannot draft an introduction for ${label} — no buyer on file yet.`,
  },
  update: { check: () => true, rejectionReason: () => '' },
  custom: { check: () => true, rejectionReason: () => '' },
};

function buildFollowupContent(opts: {
  purpose: DraftBuyerFollowupPurpose;
  topic: string;
  customInstruction?: string;
  unitLabel: string;
  greeting: string;
  tone: string;
  ctx: SkillAgentContext;
}): { subject: string; body: string } {
  const { purpose, topic: rawTopic, customInstruction: rawCustom, unitLabel, greeting, tone, ctx } = opts;
  const sign = toneSignOff(tone);
  const sig = signature(ctx);
  // Defensive: scrub any greeting / sign-off the model may have included in
  // the free-text fields, since the template already supplies both.
  const topic = stripGreetingAndSignoff(rawTopic);
  const customInstruction = stripGreetingAndSignoff(rawCustom);

  if (purpose === 'congratulate_handover') {
    return {
      subject: `Welcome to your new home — ${unitLabel}`,
      body: [
        greeting,
        '',
        `Congratulations on getting the keys to ${unitLabel} — delighted to see you over the line.`,
        '',
        'Wishing you every happiness settling in.',
        '',
        'If anything comes up over the first few weeks — snags, paperwork, anything we can help with — just let me know and I\'ll sort it.',
        '',
        sign,
        sig,
      ].join('\n'),
    };
  }

  if (purpose === 'introduce') {
    return {
      subject: `Introduction — ${unitLabel}`,
      body: [
        greeting,
        '',
        topic || `I\'m getting in touch as the agent looking after ${unitLabel}.`,
        '',
        'Happy to answer any questions and walk you through the next steps whenever suits.',
        '',
        sign,
        sig,
      ].join('\n'),
    };
  }

  if (purpose === 'update') {
    return {
      subject: `Update — ${unitLabel}`,
      body: [greeting, '', topic || 'Quick update on where things stand.', '', sign, sig].join('\n'),
    };
  }

  if (purpose === 'custom') {
    const instruction = customInstruction || topic;
    return {
      subject: unitLabel,
      body: [greeting, '', instruction, '', sign, sig].join('\n'),
    };
  }

  // Default: chase.
  return {
    subject: `Following up — ${unitLabel}`,
    body: [
      greeting,
      '',
      topic,
      '',
      'Could you let me know where things stand on your end? Happy to help work through anything that\'s holding things up.',
      '',
      sign,
      sig,
    ].join('\n'),
  };
}

export async function draftBuyerFollowups(
  supabase: SupabaseClient,
  agentContext: SkillAgentContext,
  inputs: DraftBuyerFollowupsInput,
): Promise<AgenticSkillEnvelope> {
  const skill = 'draft_buyer_followups';
  const tone = (inputs.tone || 'gentle_chase').trim();
  const topic = (inputs.topic || '').trim();
  const purpose: DraftBuyerFollowupPurpose = inputs.purpose || 'chase';
  const customInstruction = inputs.custom_instruction?.trim();
  const targets = Array.isArray(inputs.targets) ? inputs.targets : [];
  const query = `draft_buyer_followups targets=${targets.length} purpose=${purpose} topic="${topic.slice(0, 80)}"`;

  if (!targets.length) {
    return {
      skill,
      status: 'awaiting_approval',
      summary: 'No targets provided — nothing to draft.',
      drafts: [],
      meta: { record_count: 0, generated_at: new Date().toISOString(), query },
    };
  }
  // Most purposes need a topic. congratulate_handover has a built-in
  // fallback; custom can rely on custom_instruction alone.
  if (!topic && purpose !== 'congratulate_handover' && !(purpose === 'custom' && customInstruction)) {
    return {
      skill,
      status: 'awaiting_approval',
      summary: 'A topic is required so the follow-up makes sense to the recipient.',
      drafts: [],
      meta: { record_count: 0, generated_at: new Date().toISOString(), query },
    };
  }

  try {
    const drafts: AgenticSkillEnvelope['drafts'] = [];
    const skipped: Array<{ ref: string; reason: string }> = [];
    const seenUnitIds = new Set<string>();
    // Session 13 — track which developments actually resolved this
    // turn so the chat route's self-healing alias capture has
    // something to key off of. Only dev_ids where at least one draft
    // landed go into this set.
    const resolvedDevIds = new Set<string>();
    // Session 14 — when a target's scheme resolution returns not_found
    // with a single phonetic-neighbour candidate, stash it keyed by the
    // typed input. We only surface top_candidate on the final envelope
    // if ALL distinct typed inputs collapsed to the same single
    // candidate and zero drafts landed — otherwise the yes/no prompt
    // would be ambiguous.
    const topCandidatesByTyped = new Map<string, { name: string; developmentId: string; typed: string }>();

    const { data: asgs } = await supabase
      .from('agent_scheme_assignments')
      .select('development_id')
      .eq('agent_id', agentContext.agentProfileId)
      .eq('is_active', true);
    const devIds = Array.from(new Set((asgs || []).map((a: any) => a.development_id).filter(Boolean)));
    const { data: devs } = devIds.length
      ? await supabase.from('developments').select('id, name').in('id', devIds)
      : { data: [] };
    const devList = (devs || []) as Array<{ id: string; name: string }>;

    // Session 13 — scheme-name resolution goes through the alias table
    // so phonetic variants ("Ardawn View", "Add on View") map to the
    // right development before we look up the unit.
    const assignedContextForResolver = {
      assignedDevelopmentIds: devList.map((d) => d.id),
      assignedDevelopmentNames: devList.map((d) => d.name),
    };

    for (const target of targets) {
      const unitRef = (target.unit_identifier || '').trim();
      if (!unitRef) continue;

      let preferredDevId: string | null = null;
      if (target.scheme_name) {
        const schemeResolution = await resolveSchemeName(
          supabase,
          target.scheme_name,
          assignedContextForResolver,
        );
        if (schemeResolution.ok) {
          preferredDevId = schemeResolution.developmentId;
        } else if (schemeResolution.reason === 'not_found') {
          if (schemeResolution.top_candidate) {
            topCandidatesByTyped.set(target.scheme_name, {
              name: schemeResolution.top_candidate.name,
              developmentId: schemeResolution.top_candidate.developmentId,
              typed: target.scheme_name,
            });
          }
          skipped.push({
            ref: unitRef,
            reason: `I couldn't find a scheme matching "${target.scheme_name}". Your assigned schemes are: ${schemeResolution.candidates.join(', ')}.`,
          });
          continue;
        } else if (schemeResolution.reason === 'ambiguous') {
          skipped.push({
            ref: unitRef,
            reason: `"${target.scheme_name}" matches multiple schemes (${schemeResolution.candidates.join(', ')}). Please be specific.`,
          });
          continue;
        }
        // not_assigned falls through to unit resolver with no
        // preferredDevId — the unit resolver will also fail, giving
        // a consistent "not in your assigned schemes" message.
      }

      const resolution = await resolveUnitIdentifier(supabase, unitRef, {
        developmentIds: devIds,
        preferredDevelopmentId: preferredDevId,
      });

      if (resolution.status === 'not_found') {
        skipped.push({ ref: unitRef, reason: `No unit "${resolution.normalised}" in your assigned schemes.` });
        continue;
      }
      if (resolution.status === 'ambiguous') {
        const list = resolution.candidates
          .map((c) => `${c.scheme_name ?? '?'} Unit ${c.unit_number ?? '?'}`)
          .join(', ');
        skipped.push({
          ref: unitRef,
          reason: `"${unitRef}" matches multiple units across schemes (${list}). Include the scheme name.`,
        });
        continue;
      }

      const unit = resolution.unit;
      const pipeline = resolution.pipeline;
      if (seenUnitIds.has(unit.id)) continue;
      seenUnitIds.add(unit.id);

      const schemeName =
        devList.find((d) => d.id === unit.development_id)?.name ?? target.scheme_name ?? 'Unknown scheme';
      const unitLabel = `Unit ${unit.unit_number ?? unit.unit_uid ?? unitRef}, ${schemeName}`;

      // Precondition: resolved unit must satisfy the purpose.
      const preconditionState: UnitStateForPrecondition = {
        handover_date: pipeline?.handover_date ?? null,
        unit_status: unit.unit_status,
        contracts_issued_date: pipeline?.contracts_issued_date ?? null,
        signed_contracts_date: pipeline?.signed_contracts_date ?? null,
        counter_signed_date: pipeline?.counter_signed_date ?? null,
        purchaser_name: unit.purchaser_name,
      };
      const precondition = PURPOSE_PRECONDITIONS[purpose];
      if (!precondition.check(preconditionState)) {
        skipped.push({ ref: unitRef, reason: precondition.rejectionReason(unitLabel) });
        continue;
      }

      const rawName =
        target.recipient_name ||
        unit.purchaser_name ||
        pipeline?.purchaser_name ||
        'Buyer';
      const parsed = parseJointPurchaserNames(rawName);
      const resolvedEmail = unit.purchaser_email || pipeline?.purchaser_email || 'buyer@tbc.invalid';

      const { subject, body } = buildFollowupContent({
        purpose,
        topic,
        customInstruction,
        unitLabel,
        greeting: parsed.greeting,
        tone,
        ctx: agentContext,
      });

      drafts.push({
        id: randomUUID(),
        type: 'email' as const,
        recipient: { name: parsed.fullName, email: resolvedEmail, role: 'buyer' },
        subject,
        body,
        affected_record: { kind: 'sales_unit', id: unit.id, label: unitLabel },
        reasoning: `${purpose} email to ${parsed.fullName} at ${unitLabel}. Tone: ${tone}.${resolvedEmail === 'buyer@tbc.invalid' ? ' Recipient email missing — placeholder used, please fill in before approving.' : ''}`,
      });
      if (unit.development_id) resolvedDevIds.add(unit.development_id);
    }

    const summaryParts: string[] = [];
    if (drafts.length) {
      summaryParts.push(`Drafted ${drafts.length} ${purpose} email${drafts.length === 1 ? '' : 's'}.`);
    }
    if (skipped.length) {
      summaryParts.push(`Skipped ${skipped.length}: ${skipped.map((s) => s.reason).join(' ')}`);
    }
    if (!summaryParts.length) {
      summaryParts.push(
        'Could not resolve any of the requested units. Try naming them more specifically.',
      );
    }

    // Session 14 — surface top_candidate only when zero drafts landed AND
    // every failed scheme_name pointed at the same single phonetic
    // neighbour. Mixed inputs or any successful drafts → no candidate,
    // the user needs to re-state rather than yes/no.
    let topCandidate: { name: string; developmentId: string; typed: string } | null = null;
    if (drafts.length === 0 && topCandidatesByTyped.size > 0) {
      const uniqueCandidates = new Set(
        Array.from(topCandidatesByTyped.values()).map((c) => c.developmentId),
      );
      if (uniqueCandidates.size === 1) {
        topCandidate = Array.from(topCandidatesByTyped.values())[0];
      }
    }

    return {
      skill,
      status: 'awaiting_approval',
      summary: summaryParts.join(' '),
      drafts,
      meta: {
        record_count: drafts.length,
        generated_at: new Date().toISOString(),
        query,
        // @ts-ignore — extra diagnostic field read by the chat route
        skipped,
        // @ts-ignore — Session 13: chat route uses this to key alias capture
        resolved_development_ids: Array.from(resolvedDevIds),
        // @ts-ignore — Session 14: chat route uses this for yes/no disambiguation
        ...(topCandidate ? { top_candidate: topCandidate } : {}),
      } as any,
    };
  } catch (err) {
    return errorEnvelope(skill, query, err);
  }
}

// =====================================================================
// Skill 9 — get_candidate_units (intent-aware clarification helper)
// =====================================================================
//
// Session 9 fix. Before prompting "which N units?", the model must see
// a candidate set filtered by INTENT, not the first N unit numbers in
// whatever order they sit in the DB. For "congratulate on keys" intent
// that means handed-over units only.
//
// This skill is technically read-only — it returns an envelope with
// zero drafts and surfaces the candidate list in the summary + meta.
// Not strictly an agentic skill (no approvals), but registered as one
// so it lives on the same runAgenticSkill adapter and benefits from
// the anti-hallucination telemetry.

export async function getCandidateUnitsSkill(
  supabase: SupabaseClient,
  agentContext: SkillAgentContext,
  inputs: { intent: CandidateIntent; scheme_name?: string; limit?: number },
): Promise<AgenticSkillEnvelope> {
  const skill = 'get_candidate_units';
  const intent: CandidateIntent = (inputs.intent || 'all') as CandidateIntent;
  const limit = Math.max(1, Math.min(20, inputs.limit ?? 6));
  const query = `get_candidate_units intent=${intent} scheme=${inputs.scheme_name ?? '(any)'}`;

  try {
    const { data: asgs } = await supabase
      .from('agent_scheme_assignments')
      .select('development_id')
      .eq('agent_id', agentContext.agentProfileId)
      .eq('is_active', true);
    const devIds = Array.from(new Set((asgs || []).map((a: any) => a.development_id).filter(Boolean)));
    if (!devIds.length) {
      return {
        skill,
        status: 'awaiting_approval',
        summary: 'No assigned schemes — no candidate units.',
        drafts: [],
        meta: { record_count: 0, generated_at: new Date().toISOString(), query },
      };
    }

    let preferredDevId: string | null = null;
    if (inputs.scheme_name) {
      const key = inputs.scheme_name.trim().toLowerCase();
      const { data: devs } = await supabase
        .from('developments')
        .select('id, name')
        .in('id', devIds);
      const match = (devs || []).find((d: any) => {
        const n = String(d.name).toLowerCase();
        return n === key || n.includes(key) || key.includes(n);
      });
      if (match) preferredDevId = match.id as string;
    }

    const candidates = await getCandidateUnits(supabase, intent, {
      developmentIds: devIds,
      preferredDevelopmentId: preferredDevId,
      limit,
    });

    const summaryLines = candidates.length
      ? [
          `Found ${candidates.length} candidate unit${candidates.length === 1 ? '' : 's'} (${intent}):`,
          ...candidates.map((c) => {
            const buyer = c.purchaser_name ? ` — ${c.purchaser_name}` : '';
            return `- ${c.scheme_name} Unit ${c.unit_number}${buyer} (${c.status_hint})`;
          }),
        ]
      : [`No candidate units found for intent '${intent}'.`];

    return {
      skill,
      status: 'awaiting_approval',
      summary: summaryLines.join('\n'),
      drafts: [],
      meta: {
        record_count: candidates.length,
        generated_at: new Date().toISOString(),
        query,
        // @ts-ignore extra diagnostic
        candidates,
      } as any,
    };
  } catch (err) {
    return errorEnvelope(skill, query, err);
  }
}

// =====================================================================
// Skill 10 — rank_pipeline_buyers (deterministic SQL ranking)
// =====================================================================
//
// Phase 1 ranking helper for "who is most likely to convert" / "give me
// the top N buyers" style asks, plus the input to create_viewing_schedule.
// No LLM scoring layer — a transparent SQL rubric the agent can argue
// with. Each ranked row carries a numeric score (0..100) and a short
// `reason` string naming the top contributor ("contacted 3 days ago,
// sale agreed, viewed twice").

export interface RankedPipelineBuyer {
  unit_id: string;
  development_id: string;
  unit_number: string;
  scheme_name: string;
  buyer_name: string;
  buyer_email: string | null;
  stage: string;
  score: number;
  reason: string;
  last_contact_days: number | null;
  pipeline_age_days: number | null;
  viewing_count: number;
}

interface RankPipelineBuyersInput {
  development_id?: string;
  scheme_name?: string;
  limit?: number;
}

function classifyStage(unitStatus: string | null, pipe: any | null): {
  stage: string;
  stagePoints: number;
} {
  // Pipeline-date-derived stage takes priority: a unit can be 'available'
  // in `units.unit_status` while the pipeline row carries a deposit_date,
  // because the column drift between the two tables is not always tight.
  // We prefer the more progressed signal.
  if (pipe?.handover_date) return { stage: 'handed_over', stagePoints: 100 };
  if (pipe?.counter_signed_date) return { stage: 'counter_signed', stagePoints: 95 };
  if (pipe?.signed_contracts_date) return { stage: 'signed', stagePoints: 90 };
  if (pipe?.contracts_issued_date) return { stage: 'contracts_issued', stagePoints: 80 };
  if (pipe?.deposit_date) return { stage: 'deposit_received', stagePoints: 70 };
  if (pipe?.sale_agreed_date) return { stage: 'sale_agreed', stagePoints: 65 };
  if (unitStatus === 'sale_agreed') return { stage: 'sale_agreed', stagePoints: 65 };
  if (unitStatus === 'reserved') return { stage: 'reserved', stagePoints: 55 };
  if (pipe?.release_date) return { stage: 'in_progress', stagePoints: 35 };
  if (unitStatus === 'available') return { stage: 'for_sale', stagePoints: 15 };
  return { stage: unitStatus || 'unknown', stagePoints: 10 };
}

function recencyPoints(daysSinceContact: number | null): number {
  if (daysSinceContact === null) return 0;
  if (daysSinceContact <= 3) return 100;
  if (daysSinceContact <= 7) return 80;
  if (daysSinceContact <= 14) return 50;
  if (daysSinceContact <= 30) return 25;
  return 5;
}

function agingPoints(daysInPipeline: number | null): number {
  if (daysInPipeline === null) return 50; // unknown — neutral
  if (daysInPipeline <= 14) return 100;
  if (daysInPipeline <= 30) return 70;
  if (daysInPipeline <= 60) return 40;
  if (daysInPipeline <= 120) return 20;
  return 5;
}

function viewingPoints(count: number): number {
  if (count >= 2) return 100;
  if (count === 1) return 70;
  return 25;
}

function buildRankReason(
  stage: string,
  daysSinceContact: number | null,
  daysInPipeline: number | null,
  viewingCount: number,
): string {
  const parts: string[] = [];
  // Always lead with the strongest signal.
  if (daysSinceContact !== null && daysSinceContact <= 7) {
    parts.push(`contacted ${daysSinceContact === 0 ? 'today' : `${daysSinceContact} day${daysSinceContact === 1 ? '' : 's'} ago`}`);
  } else if (daysSinceContact !== null && daysSinceContact <= 30) {
    parts.push(`last contact ${daysSinceContact} days ago`);
  } else if (daysSinceContact === null) {
    parts.push('no contact logged yet');
  } else {
    parts.push(`gone quiet (${daysSinceContact} days since contact)`);
  }
  if (stage && stage !== 'for_sale' && stage !== 'unknown') {
    parts.push(stage.replace(/_/g, ' '));
  }
  if (viewingCount >= 1) {
    parts.push(`viewed ${viewingCount === 1 ? 'once' : `${viewingCount} times`}`);
  } else {
    parts.push('no viewings yet');
  }
  if (daysInPipeline !== null && daysInPipeline > 60) {
    parts.push(`in pipeline ${daysInPipeline} days`);
  }
  return parts.slice(0, 3).join(', ');
}

async function resolveRankingScope(
  supabase: SupabaseClient,
  agentContext: SkillAgentContext,
  inputs: RankPipelineBuyersInput,
): Promise<
  | { ok: true; developmentId: string; schemeName: string }
  | { ok: false; reason: string }
> {
  const { data: asgs } = await supabase
    .from('agent_scheme_assignments')
    .select('development_id')
    .eq('agent_id', agentContext.agentProfileId)
    .eq('is_active', true);
  const devIds = Array.from(
    new Set((asgs || []).map((a: any) => a.development_id).filter(Boolean)),
  );
  if (!devIds.length) {
    return { ok: false, reason: 'No assigned schemes for this agent.' };
  }

  if (inputs.development_id) {
    if (!devIds.includes(inputs.development_id)) {
      return { ok: false, reason: 'That development is not in your assigned schemes.' };
    }
    const { data: dev } = await supabase
      .from('developments')
      .select('id, name')
      .eq('id', inputs.development_id)
      .maybeSingle();
    if (!dev) return { ok: false, reason: 'Development not found.' };
    return { ok: true, developmentId: dev.id, schemeName: dev.name };
  }

  if (inputs.scheme_name) {
    const { data: devs } = await supabase
      .from('developments')
      .select('id, name')
      .in('id', devIds);
    const devList = (devs || []) as Array<{ id: string; name: string }>;
    const resolution = await resolveSchemeName(supabase, inputs.scheme_name, {
      assignedDevelopmentIds: devList.map((d) => d.id),
      assignedDevelopmentNames: devList.map((d) => d.name),
    });
    if (!resolution.ok) {
      return {
        ok: false,
        reason:
          resolution.reason === 'not_found'
            ? `I couldn't find a scheme matching "${inputs.scheme_name}". Your assigned schemes are: ${resolution.candidates.join(', ')}.`
            : resolution.reason === 'ambiguous'
              ? `"${inputs.scheme_name}" matches multiple schemes (${resolution.candidates.join(', ')}). Please be specific.`
              : `Scheme "${inputs.scheme_name}" is not in your assigned list.`,
      };
    }
    return { ok: true, developmentId: resolution.developmentId, schemeName: resolution.canonicalName };
  }

  return {
    ok: false,
    reason: 'Provide either development_id or scheme_name.',
  };
}

async function rankBuyersForDevelopment(
  supabase: SupabaseClient,
  developmentId: string,
  schemeName: string,
  limit: number,
): Promise<RankedPipelineBuyer[]> {
  // 1. Pipeline rows with stage dates + buyer contact info.
  const { data: pipelineRows } = await supabase
    .from('unit_sales_pipeline')
    .select(
      'unit_id, development_id, purchaser_name, purchaser_email, ' +
        'release_date, sale_agreed_date, deposit_date, contracts_issued_date, ' +
        'signed_contracts_date, counter_signed_date, handover_date, created_at',
    )
    .eq('development_id', developmentId);

  const pipeRows = (pipelineRows || []) as any[];
  if (!pipeRows.length) return [];

  // 2. Unit rows for fallback purchaser name + status.
  const unitIds = pipeRows.map((p) => p.unit_id).filter(Boolean);
  const { data: unitRows } = await supabase
    .from('units')
    .select('id, unit_number, unit_uid, unit_status, purchaser_name, purchaser_email')
    .in('id', unitIds);
  const unitById = new Map<string, any>((unitRows || []).map((u: any) => [u.id, u]));

  // 3. Communication recency per unit.
  const { data: commsRows } = await supabase
    .from('communication_events')
    .select('unit_id, created_at')
    .in('unit_id', unitIds)
    .order('created_at', { ascending: false });
  const lastCommByUnit = new Map<string, string>();
  for (const c of (commsRows || []) as any[]) {
    if (!c.unit_id) continue;
    if (!lastCommByUnit.has(c.unit_id)) lastCommByUnit.set(c.unit_id, c.created_at);
  }

  // 4. Viewing counts. agent_viewings keys off a free-text unit_ref + a
  //    nullable unit_id; we count by unit_id where available, and fall
  //    back to unit_number string match for legacy rows.
  const { data: viewingRows } = await supabase
    .from('agent_viewings')
    .select('unit_id, unit_ref, scheme_name, buyer_name')
    .eq('scheme_name', schemeName);
  const viewingsByUnitId = new Map<string, number>();
  const viewingsByUnitRef = new Map<string, number>();
  for (const v of (viewingRows || []) as any[]) {
    if (v.unit_id) {
      viewingsByUnitId.set(v.unit_id, (viewingsByUnitId.get(v.unit_id) || 0) + 1);
    } else if (v.unit_ref) {
      const k = String(v.unit_ref).toLowerCase();
      viewingsByUnitRef.set(k, (viewingsByUnitRef.get(k) || 0) + 1);
    }
  }

  const now = Date.now();
  const ranked: RankedPipelineBuyer[] = [];

  for (const p of pipeRows) {
    const unit = unitById.get(p.unit_id);
    const buyerName = (p.purchaser_name || unit?.purchaser_name || '').trim();
    const buyerEmail = (p.purchaser_email || unit?.purchaser_email || null) as string | null;
    if (!buyerName) continue; // No buyer in pipeline yet — skip, this is "who would convert", not "who could".

    const unitNumber = unit?.unit_number || unit?.unit_uid || 'unknown';
    const { stage, stagePoints } = classifyStage(unit?.unit_status || null, p);

    const lastCommIso = lastCommByUnit.get(p.unit_id) || null;
    const daysSinceContact = lastCommIso
      ? Math.max(0, Math.floor((now - new Date(lastCommIso).getTime()) / 86400000))
      : null;

    const pipelineStartIso: string | null =
      p.release_date || p.created_at || null;
    const daysInPipeline = pipelineStartIso
      ? Math.max(0, Math.floor((now - new Date(pipelineStartIso).getTime()) / 86400000))
      : null;

    let viewingCount = viewingsByUnitId.get(p.unit_id) || 0;
    if (!viewingCount && unitNumber) {
      viewingCount = viewingsByUnitRef.get(String(unitNumber).toLowerCase()) || 0;
    }

    const score =
      0.4 * stagePoints +
      0.3 * recencyPoints(daysSinceContact) +
      0.2 * agingPoints(daysInPipeline) +
      0.1 * viewingPoints(viewingCount);

    ranked.push({
      unit_id: p.unit_id,
      development_id: p.development_id,
      unit_number: String(unitNumber),
      scheme_name: schemeName,
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      stage,
      score: Math.round(score * 10) / 10,
      reason: buildRankReason(stage, daysSinceContact, daysInPipeline, viewingCount),
      last_contact_days: daysSinceContact,
      pipeline_age_days: daysInPipeline,
      viewing_count: viewingCount,
    });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}

export async function rankPipelineBuyers(
  supabase: SupabaseClient,
  agentContext: SkillAgentContext,
  inputs: RankPipelineBuyersInput,
): Promise<AgenticSkillEnvelope> {
  const skill = 'rank_pipeline_buyers';
  const limit = Math.max(1, Math.min(50, inputs.limit ?? 10));
  const query = `rank_pipeline_buyers development=${inputs.development_id ?? inputs.scheme_name ?? ''} limit=${limit}`;

  try {
    const scope = await resolveRankingScope(supabase, agentContext, inputs);
    if (!scope.ok) {
      return {
        skill,
        status: 'awaiting_approval',
        summary: scope.reason,
        drafts: [],
        meta: { record_count: 0, generated_at: new Date().toISOString(), query },
      };
    }

    const ranked = await rankBuyersForDevelopment(
      supabase,
      scope.developmentId,
      scope.schemeName,
      limit,
    );

    if (!ranked.length) {
      return {
        skill,
        status: 'awaiting_approval',
        summary: `No active buyers in the pipeline at ${scope.schemeName} yet.`,
        drafts: [],
        meta: { record_count: 0, generated_at: new Date().toISOString(), query },
      };
    }

    const summaryLines = [
      `Top ${ranked.length} buyer${ranked.length === 1 ? '' : 's'} most likely to convert at ${scope.schemeName}:`,
      ...ranked.map(
        (r, i) =>
          `${i + 1}. ${r.buyer_name} — Unit ${r.unit_number} (score ${r.score}) — ${r.reason}`,
      ),
    ];

    return {
      skill,
      status: 'awaiting_approval',
      summary: summaryLines.join('\n'),
      drafts: [],
      meta: {
        record_count: ranked.length,
        generated_at: new Date().toISOString(),
        query,
        // @ts-ignore — diagnostic + consumed by create_viewing_schedule
        ranked_buyers: ranked,
        // @ts-ignore
        development_id: scope.developmentId,
        // @ts-ignore
        scheme_name: scope.schemeName,
      } as any,
    };
  } catch (err) {
    return errorEnvelope(skill, query, err);
  }
}

// =====================================================================
// Skill 11 — create_viewing_schedule (timeslots + per-buyer proposals)
// =====================================================================
//
// Phase 1 viewing scheduler. Builds N timeslots between start_time and
// end_time at slot_duration_minutes spacing, ranks N buyers via the
// existing rank_pipeline_buyers helper, and emits one viewing_record
// draft and one email draft per buyer. The drafts go through the same
// persistence / drawer pipeline every other agentic skill uses — no new
// email pipeline.

interface CreateViewingScheduleInput {
  development_id?: string;
  scheme_name?: string;
  date: string; // ISO date "2026-05-09"
  start_time: string; // "09:00"
  end_time: string; // "14:00"
  slot_duration_minutes?: number;
  target_count?: number;
}

function parseClockTime(value: string): { hour: number; minute: number } | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  // Accept "9", "9am", "9:00", "9:00am", "14:30", "2pm", "2:30pm".
  const ampmMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!ampmMatch) return null;
  let hour = Number(ampmMatch[1]);
  const minute = ampmMatch[2] ? Number(ampmMatch[2]) : 0;
  const meridiem = ampmMatch[3];
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function buildSlots(
  date: string,
  startTime: string,
  endTime: string,
  slotMinutes: number,
  targetCount: number,
): Array<{ start: string; end: string; iso: string }> | null {
  const start = parseClockTime(startTime);
  const end = parseClockTime(endTime);
  if (!start || !end) return null;
  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;
  if (endMinutes <= startMinutes) return null;
  const slots: Array<{ start: string; end: string; iso: string }> = [];
  let cursor = startMinutes;
  while (cursor + slotMinutes <= endMinutes && slots.length < targetCount) {
    const sH = Math.floor(cursor / 60);
    const sM = cursor % 60;
    const eMins = cursor + slotMinutes;
    const eH = Math.floor(eMins / 60);
    const eM = eMins % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    const startLabel = `${pad(sH)}:${pad(sM)}`;
    const endLabel = `${pad(eH)}:${pad(eM)}`;
    const iso = `${date}T${startLabel}:00`;
    slots.push({ start: startLabel, end: endLabel, iso });
    cursor += slotMinutes;
  }
  return slots;
}

function formatSlotForCopy(date: string, slotStart: string): string {
  const d = new Date(`${date}T${slotStart}:00`);
  if (Number.isNaN(d.getTime())) return `${date} ${slotStart}`;
  const dayLabel = d.toLocaleDateString('en-IE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return `${dayLabel} at ${slotStart}`;
}

export async function createViewingSchedule(
  supabase: SupabaseClient,
  agentContext: SkillAgentContext,
  inputs: CreateViewingScheduleInput,
): Promise<AgenticSkillEnvelope> {
  const skill = 'create_viewing_schedule';
  const slotMinutes = Math.max(15, Math.min(120, inputs.slot_duration_minutes ?? 30));
  const targetCount = Math.max(1, Math.min(20, inputs.target_count ?? 10));
  const query = `create_viewing_schedule date=${inputs.date} ${inputs.start_time}-${inputs.end_time} slots=${targetCount}@${slotMinutes}m`;

  try {
    if (!inputs.date || !/^\d{4}-\d{2}-\d{2}$/.test(inputs.date)) {
      return {
        skill,
        status: 'awaiting_approval',
        summary: 'Provide date as ISO YYYY-MM-DD (e.g. 2026-05-09).',
        drafts: [],
        meta: { record_count: 0, generated_at: new Date().toISOString(), query },
      };
    }

    const scope = await resolveRankingScope(supabase, agentContext, inputs);
    if (!scope.ok) {
      return {
        skill,
        status: 'awaiting_approval',
        summary: scope.reason,
        drafts: [],
        meta: { record_count: 0, generated_at: new Date().toISOString(), query },
      };
    }

    const slots = buildSlots(
      inputs.date,
      inputs.start_time,
      inputs.end_time,
      slotMinutes,
      targetCount,
    );
    if (!slots || slots.length === 0) {
      return {
        skill,
        status: 'awaiting_approval',
        summary:
          'Could not build slots from the time range. Check start_time / end_time / slot_duration_minutes.',
        drafts: [],
        meta: { record_count: 0, generated_at: new Date().toISOString(), query },
      };
    }

    // Use the same ranker the agent would call directly. We fetch one
    // extra so we have headroom if a top-ranked buyer is missing an
    // email and we need to skip them.
    const ranked = await rankBuyersForDevelopment(
      supabase,
      scope.developmentId,
      scope.schemeName,
      targetCount + 5,
    );

    const eligible = ranked.filter((r) => r.buyer_email && r.buyer_name);
    if (eligible.length === 0) {
      return {
        skill,
        status: 'awaiting_approval',
        summary: `No buyers with email on file at ${scope.schemeName}. Update purchaser emails on the units before scheduling.`,
        drafts: [],
        meta: { record_count: 0, generated_at: new Date().toISOString(), query },
      };
    }

    const drafts: AgenticSkillEnvelope['drafts'] = [];
    const usedSlots = Math.min(slots.length, eligible.length);

    for (let i = 0; i < usedSlots; i++) {
      const buyer = eligible[i];
      const primarySlot = slots[i];
      // Offer 2-3 specific slots: the primary plus the next two on either
      // side, deduped, capped at the schedule's bounds. Phase 1 keeps it
      // simple — let the agent edit later if needed.
      const altSlots: typeof slots = [];
      for (const offset of [1, -1, 2, -2]) {
        const idx = i + offset;
        if (idx >= 0 && idx < slots.length && altSlots.length < 2) {
          altSlots.push(slots[idx]);
        }
      }
      const slotLines = [primarySlot, ...altSlots]
        .map((s) => `- ${formatSlotForCopy(inputs.date, s.start)}`)
        .join('\n');

      const buyerFirst = firstName(buyer.buyer_name);
      const opener = `${buyer.reason}, so I wanted to put a slot in front of you.`;

      const subject = `Viewing slot for Unit ${buyer.unit_number}, ${scope.schemeName}`;
      const body = [
        `Hi ${buyerFirst},`,
        '',
        opener,
        '',
        `I'm running viewings at ${scope.schemeName} on ${formatSlotForCopy(inputs.date, primarySlot.start).replace(' at ' + primarySlot.start, '')}. I've held a slot for you — pick whichever works:`,
        slotLines,
        '',
        `Reply with the time and I'll lock it in. Happy to suggest another day if none of those land.`,
        '',
        'Thanks,',
        signature(agentContext),
      ].join('\n');

      // Email draft.
      drafts.push({
        id: randomUUID(),
        type: 'email' as const,
        recipient: {
          name: buyer.buyer_name,
          email: buyer.buyer_email!,
          role: 'buyer',
        },
        subject,
        body,
        affected_record: {
          kind: 'sales_unit',
          id: buyer.unit_id,
          label: `Unit ${buyer.unit_number}, ${scope.schemeName}`,
        },
        reasoning: `Ranked #${i + 1} (score ${buyer.score}). ${buyer.reason}.`,
      });

      // Viewing-record draft. Mirrors scheduleViewingDraft so the same
      // approval drawer creates a real agent_viewings row when the agent
      // hits Approve.
      const recordRow: Record<string, any> = {
        agent_id: agentContext.agentProfileId,
        buyer_name: buyer.buyer_name,
        buyer_email: buyer.buyer_email,
        viewing_date: inputs.date,
        viewing_time: `${primarySlot.start}:00`,
        status: 'pending',
        source: 'intelligence',
        unit_ref: buyer.unit_number,
        development_id: scope.developmentId,
        unit_id: buyer.unit_id,
        scheme_name: scope.schemeName,
      };
      drafts.push({
        id: randomUUID(),
        type: 'viewing_record' as const,
        body: JSON.stringify(recordRow, null, 2),
        affected_record: {
          kind: 'sales_unit',
          id: buyer.unit_id,
          label: `Unit ${buyer.unit_number}, ${scope.schemeName}`,
        },
        reasoning: `Holds ${formatSlotForCopy(inputs.date, primarySlot.start)} for ${buyer.buyer_name}. Created on approval.`,
      });
    }

    return {
      skill,
      status: 'awaiting_approval',
      summary: `Drafted a ${usedSlots}-slot viewing schedule for ${scope.schemeName} on ${inputs.date} (${inputs.start_time}–${inputs.end_time}). Each buyer has an email proposal and a held slot in the drawer for review.`,
      drafts,
      meta: {
        record_count: drafts.length,
        generated_at: new Date().toISOString(),
        query,
        // @ts-ignore — surfaced for diagnostics + analytics
        development_id: scope.developmentId,
        // @ts-ignore
        scheme_name: scope.schemeName,
        // @ts-ignore
        slot_count: usedSlots,
        // @ts-ignore
        ranked_buyers: eligible.slice(0, usedSlots),
      } as any,
    };
  } catch (err) {
    return errorEnvelope(skill, query, err);
  }
}
