import { SupabaseClient } from '@supabase/supabase-js';
import { ToolResult, AgentContext } from '../types';
import {
  parseScheduledAtNatural,
  resolvePropertyForApplicant,
  formatViewingTime,
  DEFAULT_TZ,
} from '../viewing-resolver';
import { findApplicantByName } from '../applicant-lookup';
import { matchDevelopment } from '../property-matcher';

export interface ViewingDraft {
  applicant_id: string;
  applicant_name: string;
  development_id: string;
  development_name: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  notes: string | null;
}

export type CreateViewingResult =
  | {
      status: 'draft';
      draft: ViewingDraft;
      message: string;
    }
  | {
      status: 'needs_clarification';
      reason:
        | 'applicant_not_found'
        | 'applicant_ambiguous'
        | 'property_not_found'
        | 'property_ambiguous'
        | 'property_not_in_assigned_schemes'
        | 'no_property_specified'
        | 'date_unparseable'
        | 'missing_time';
      message: string;
      candidates?: Array<Record<string, unknown>>;
    };

export async function createViewing(
  supabase: SupabaseClient,
  _tenantId: string,
  agentContext: AgentContext,
  params: {
    applicant_name: string;
    property_hint?: string;
    scheduled_at_natural: string;
    duration_minutes?: number;
    notes?: string;
  },
): Promise<ToolResult> {
  const tz = DEFAULT_TZ;

  const parsedDate = parseScheduledAtNatural(params.scheduled_at_natural ?? '', { tz });
  if (!parsedDate.ok) {
    const reason = parsedDate.reason === 'missing_time' ? 'missing_time' : 'date_unparseable';
    const message =
      reason === 'missing_time'
        ? `What time on ${params.scheduled_at_natural || 'that day'}? I need a time to schedule the viewing.`
        : `I couldn't read "${params.scheduled_at_natural}" as a date. Try something like "Tuesday 6pm" or "tomorrow at 11".`;
    const result: CreateViewingResult = { status: 'needs_clarification', reason, message };
    return { data: result, summary: message };
  }

  const applicantRes = await findApplicantByName(supabase, agentContext.agentProfileId, params.applicant_name);
  if (applicantRes.status === 'none') {
    // Applicant isn't on the books. Don't dead-end — instead route the caller
    // toward picking a scheme. Once the user names one, the model will re-call
    // via schedule_viewings (composite), which has a working new-applicant
    // creation path. Without this redirect, "schedule a viewing with Jack
    // Murphy at 7pm Tuesday" (no scheme) wrongly returns "applicant not
    // found" even though Jack could be created.
    const assignedDevelopments = (agentContext.assignedDevelopmentIds || [])
      .map((id, idx) => ({ id, name: agentContext.assignedDevelopmentNames?.[idx] ?? '' }))
      .filter((d) => d.name.length > 0);
    const message = `I don't have ${params.applicant_name} on your books yet. Which development is this viewing for? I'll add them as a new applicant.`;
    const result: CreateViewingResult = {
      status: 'needs_clarification',
      reason: 'no_property_specified',
      message,
      candidates: assignedDevelopments.map((d) => ({ development_id: d.id, name: d.name })),
    };
    return { data: result, summary: message };
  }
  if (applicantRes.status === 'ambiguous') {
    const candidates = applicantRes.candidates ?? [];
    const summaryLine = candidates
      .map((c) => `${c.name}${c.latest_enquiry_property ? ` (${c.latest_enquiry_property})` : ''}`)
      .join('; ');
    const message = `A few applicants match "${params.applicant_name}": ${summaryLine}. Which one?`;
    const result: CreateViewingResult = {
      status: 'needs_clarification',
      reason: 'applicant_ambiguous',
      message,
      candidates,
    };
    return { data: result, summary: message };
  }

  const applicant = applicantRes.applicant!;

  const assignedDevelopments = (agentContext.assignedDevelopmentIds || [])
    .map((id, idx) => ({ id, name: agentContext.assignedDevelopmentNames?.[idx] ?? '' }))
    .filter((d) => d.name.length > 0);

  let property: { development_id: string; name: string } | null = null;

  // property_hint takes priority over enquiries: when the user named a
  // development, trust them, even if the applicant has enquiries on a
  // different scheme.
  const hint = (params.property_hint || '').trim();
  if (hint) {
    const hintMatch = matchDevelopment(hint, assignedDevelopments);
    if (hintMatch.type === 'unique') {
      property = { development_id: hintMatch.development.id, name: hintMatch.development.name };
    } else if (hintMatch.type === 'ambiguous') {
      const summaryLine = hintMatch.candidates.map((c) => c.name).join(', ');
      const message = `"${hint}" matches more than one of your schemes: ${summaryLine}. Which one is this viewing for?`;
      const result: CreateViewingResult = {
        status: 'needs_clarification',
        reason: 'property_ambiguous',
        message,
        candidates: hintMatch.candidates.map((c) => ({ development_id: c.id, name: c.name })),
      };
      return { data: result, summary: message };
    } else {
      const message = `"${hint}" isn't in your assigned developments. Which one did you mean?`;
      const result: CreateViewingResult = {
        status: 'needs_clarification',
        reason: 'property_not_in_assigned_schemes',
        message,
        candidates: assignedDevelopments.map((d) => ({ development_id: d.id, name: d.name })),
      };
      return { data: result, summary: message };
    }
  } else {
    const propertyRes = await resolvePropertyForApplicant(supabase, {
      agentProfileId: agentContext.agentProfileId,
      applicantId: applicant.id,
      applicantEmail: applicant.email,
      applicantName: applicant.name,
    });

    if (propertyRes.status === 'one') {
      property = { development_id: propertyRes.property!.development_id, name: propertyRes.property!.name };
    } else if (propertyRes.status === 'ambiguous') {
      const candidates = propertyRes.candidates ?? [];
      const summaryLine = candidates.map((c) => c.name).join(', ');
      const message = `${applicant.name} has enquiries on more than one scheme: ${summaryLine}. Which one is this viewing for?`;
      const result: CreateViewingResult = {
        status: 'needs_clarification',
        reason: 'property_ambiguous',
        message,
        candidates,
      };
      return { data: result, summary: message };
    } else {
      const message = 'Which development is this viewing for?';
      const result: CreateViewingResult = {
        status: 'needs_clarification',
        reason: 'no_property_specified',
        message,
        candidates: assignedDevelopments.map((d) => ({ development_id: d.id, name: d.name })),
      };
      return { data: result, summary: message };
    }
  }

  const resolvedProperty = property!;
  const duration = Number.isFinite(params.duration_minutes) && params.duration_minutes! > 0
    ? Math.min(Math.max(Math.round(params.duration_minutes!), 5), 240)
    : 30;

  const draft: ViewingDraft = {
    applicant_id: applicant.id,
    applicant_name: applicant.name,
    development_id: resolvedProperty.development_id,
    development_name: resolvedProperty.name,
    scheduled_at: parsedDate.iso,
    duration_minutes: duration,
    location: resolvedProperty.name,
    notes: params.notes?.trim() || null,
  };

  const message = `Viewing draft ready: ${applicant.name}, ${resolvedProperty.name}, ${formatViewingTime(parsedDate.iso, tz)}. Confirm to create.`;
  const result: CreateViewingResult = {
    status: 'draft',
    draft,
    message: 'Confirm to create this viewing',
  };
  return { data: result, summary: message };
}

export interface ConfirmViewingArgs {
  draft: ViewingDraft;
}

export async function confirmViewing(
  supabase: SupabaseClient,
  agentContext: AgentContext,
  args: ConfirmViewingArgs,
): Promise<{ id: string; scheduled_at: string; status: string }> {
  const { draft } = args;
  const insert = {
    tenant_id: agentContext.tenantId,
    agent_id: agentContext.authUserId,
    applicant_id: draft.applicant_id,
    development_id: draft.development_id,
    unit_id: null as string | null,
    scheduled_at: draft.scheduled_at,
    duration_minutes: draft.duration_minutes,
    location: draft.location,
    notes: draft.notes,
    status: 'scheduled' as const,
  };

  const { data, error } = await supabase
    .from('viewings')
    .insert(insert)
    .select('id, scheduled_at, status')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create viewing');
  }

  return { id: data.id, scheduled_at: data.scheduled_at, status: data.status };
}

// =====================================================================
// Viewings lifecycle: resolve, update, cancel, mark status, undo.
// All four mutation tools share the same resolveViewingReference helper
// so the LLM can refer to a viewing by applicant name + optional date.
// =====================================================================

export type ViewingSource = 'viewings' | 'agent_viewings';

export interface ResolvedViewing {
  source: ViewingSource;
  id: string;
  tenant_id: string;
  agent_id: string;
  applicant_id: string | null;
  applicant_name: string;
  development_id: string | null;
  development_name: string | null;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  notes: string | null;
  status: string;
  device_calendar_event_id: string | null;
}

export interface ViewingReferenceArgs {
  applicant_name?: string;
  scheduled_at_natural?: string;
  viewing_id?: string;
}

export type ViewingReferenceResolution =
  | { status: 'one'; viewing: ResolvedViewing }
  | { status: 'none'; reason: 'viewing_not_found'; message: string }
  | { status: 'ambiguous'; candidates: ResolvedViewing[]; message: string };

interface CanonicalRow {
  id: string;
  tenant_id: string;
  agent_id: string;
  applicant_id: string | null;
  development_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  notes: string | null;
  status: string;
  device_calendar_event_id: string | null;
}

interface LegacyRow {
  id: string;
  tenant_id: string;
  agent_id: string;
  buyer_name: string | null;
  scheme_name: string | null;
  unit_ref: string | null;
  development_id: string | null;
  unit_id: string | null;
  viewing_date: string;
  viewing_time: string;
  status: string;
  notes: string | null;
}

function legacyToZonedIso(dateStr: string, timeStr: string): string {
  // viewing_date is YYYY-MM-DD, viewing_time is HH:MM(:SS) in Europe/Dublin.
  // Reproject to UTC the same way the resolver does for natural input.
  const tz = DEFAULT_TZ;
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  const [hh, mm] = timeStr.split(':').map((n) => parseInt(n, 10));
  const utcGuess = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
  const probe = new Date(utcGuess);
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(probe)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  const projected = Date.UTC(
    parseInt(parts.year, 10),
    parseInt(parts.month, 10) - 1,
    parseInt(parts.day, 10),
    parseInt(parts.hour, 10),
    parseInt(parts.minute, 10),
  );
  const offset = utcGuess - projected;
  return new Date(utcGuess + offset).toISOString();
}

async function hydrateCanonical(
  supabase: SupabaseClient,
  rows: CanonicalRow[],
): Promise<ResolvedViewing[]> {
  if (rows.length === 0) return [];
  const applicantIds = Array.from(new Set(rows.map((r) => r.applicant_id).filter(Boolean))) as string[];
  const devIds = Array.from(new Set(rows.map((r) => r.development_id).filter(Boolean))) as string[];

  const [applicants, devs] = await Promise.all([
    applicantIds.length
      ? supabase.from('agent_applicants').select('id, full_name').in('id', applicantIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
    devIds.length
      ? supabase.from('developments').select('id, name').in('id', devIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);
  const applicantNames = new Map<string, string>(
    ((applicants as any).data || []).map((a: any) => [a.id, a.full_name]),
  );
  const devNames = new Map<string, string>(
    ((devs as any).data || []).map((d: any) => [d.id, d.name]),
  );

  return rows.map((r) => ({
    source: 'viewings' as const,
    id: r.id,
    tenant_id: r.tenant_id,
    agent_id: r.agent_id,
    applicant_id: r.applicant_id,
    applicant_name: r.applicant_id ? (applicantNames.get(r.applicant_id) || 'Applicant') : 'Applicant',
    development_id: r.development_id,
    development_name: r.development_id ? (devNames.get(r.development_id) || null) : null,
    scheduled_at: r.scheduled_at,
    duration_minutes: r.duration_minutes,
    location: r.location,
    notes: r.notes,
    status: r.status,
    device_calendar_event_id: r.device_calendar_event_id,
  }));
}

function hydrateLegacy(rows: LegacyRow[]): ResolvedViewing[] {
  return rows.map((r) => ({
    source: 'agent_viewings' as const,
    id: r.id,
    tenant_id: r.tenant_id,
    agent_id: r.agent_id,
    applicant_id: null,
    applicant_name: r.buyer_name || 'Applicant',
    development_id: r.development_id,
    development_name: r.scheme_name,
    scheduled_at: legacyToZonedIso(r.viewing_date, r.viewing_time),
    duration_minutes: 30,
    location: r.scheme_name,
    notes: r.notes,
    status: r.status === 'scheduled' ? 'confirmed' : r.status,
    device_calendar_event_id: null,
  }));
}

function describeViewing(v: ResolvedViewing): string {
  const when = formatViewingTime(v.scheduled_at);
  const where = v.development_name ? ` at ${v.development_name}` : '';
  return `${v.applicant_name}${where}, ${when}`;
}

export async function resolveViewingReference(
  supabase: SupabaseClient,
  agentContext: AgentContext,
  args: ViewingReferenceArgs,
): Promise<ViewingReferenceResolution> {
  // Direct id lookup wins. Try canonical then legacy.
  if (args.viewing_id) {
    const { data: canon } = await supabase
      .from('viewings')
      .select('id, tenant_id, agent_id, applicant_id, development_id, scheduled_at, duration_minutes, location, notes, status, device_calendar_event_id')
      .eq('id', args.viewing_id)
      .eq('tenant_id', agentContext.tenantId)
      .maybeSingle();
    if (canon) {
      const [hydrated] = await hydrateCanonical(supabase, [canon as CanonicalRow]);
      return { status: 'one', viewing: hydrated };
    }
    const { data: legacy } = await supabase
      .from('agent_viewings')
      .select('id, tenant_id, agent_id, buyer_name, scheme_name, unit_ref, development_id, unit_id, viewing_date, viewing_time, status, notes')
      .eq('id', args.viewing_id)
      .eq('tenant_id', agentContext.tenantId)
      .maybeSingle();
    if (legacy) {
      const [hydrated] = hydrateLegacy([legacy as LegacyRow]);
      return { status: 'one', viewing: hydrated };
    }
    return {
      status: 'none',
      reason: 'viewing_not_found',
      message: "I couldn't find that viewing on your books.",
    };
  }

  // Resolve by applicant name + optional time.
  const applicantName = (args.applicant_name || '').trim();
  if (!applicantName) {
    return {
      status: 'none',
      reason: 'viewing_not_found',
      message: 'Whose viewing? Tell me the applicant name.',
    };
  }

  const applicantRes = await findApplicantByName(supabase, agentContext.agentProfileId, applicantName);
  const applicantIds: string[] = [];
  if (applicantRes.status === 'one' && applicantRes.applicant) {
    applicantIds.push(applicantRes.applicant.id);
  } else if (applicantRes.status === 'ambiguous' && applicantRes.candidates) {
    for (const c of applicantRes.candidates) applicantIds.push(c.id);
  }

  // Canonical: fetch by applicant_id (or all rows for tenant if no match,
  // so we can try the legacy buyer_name path).
  const canonicalRowsRes = applicantIds.length
    ? await supabase
        .from('viewings')
        .select('id, tenant_id, agent_id, applicant_id, development_id, scheduled_at, duration_minutes, location, notes, status, device_calendar_event_id')
        .eq('tenant_id', agentContext.tenantId)
        .in('applicant_id', applicantIds)
        .neq('status', 'cancelled')
        .order('scheduled_at', { ascending: true })
        .limit(20)
    : { data: [] as CanonicalRow[] };
  const canonicalRows = (canonicalRowsRes.data || []) as CanonicalRow[];

  // Legacy: fetch by buyer_name ilike.
  const { data: legacyRowsData } = await supabase
    .from('agent_viewings')
    .select('id, tenant_id, agent_id, buyer_name, scheme_name, unit_ref, development_id, unit_id, viewing_date, viewing_time, status, notes')
    .eq('tenant_id', agentContext.tenantId)
    .ilike('buyer_name', `%${applicantName}%`)
    .neq('status', 'cancelled')
    .order('viewing_date', { ascending: true })
    .order('viewing_time', { ascending: true })
    .limit(20);

  const all: ResolvedViewing[] = [
    ...(await hydrateCanonical(supabase, canonicalRows)),
    ...hydrateLegacy((legacyRowsData || []) as LegacyRow[]),
  ];

  if (all.length === 0) {
    return {
      status: 'none',
      reason: 'viewing_not_found',
      message: `I couldn't find a viewing for ${applicantName}. Has it been scheduled yet?`,
    };
  }

  // Narrow by time hint.
  let pool = all;
  if (args.scheduled_at_natural) {
    const parsed = parseScheduledAtNatural(args.scheduled_at_natural, { tz: DEFAULT_TZ });
    if (parsed.ok) {
      const target = new Date(parsed.iso).getTime();
      const dayMs = 24 * 60 * 60 * 1000;
      const sameDay = pool.filter((v) => Math.abs(new Date(v.scheduled_at).getTime() - target) < dayMs / 2);
      if (sameDay.length > 0) pool = sameDay;
    }
  }

  if (pool.length === 1) return { status: 'one', viewing: pool[0] };

  // Default to upcoming-only.
  const now = Date.now();
  const upcoming = pool.filter((v) => new Date(v.scheduled_at).getTime() >= now);
  if (upcoming.length === 1) return { status: 'one', viewing: upcoming[0] };
  if (upcoming.length > 1) pool = upcoming;

  // Still ambiguous, return candidates.
  const message =
    pool.length === 2
      ? `Which one, ${formatViewingTime(pool[0].scheduled_at)} or ${formatViewingTime(pool[1].scheduled_at)}?`
      : `${applicantName} has ${pool.length} viewings on the books. Which one?`;

  return {
    status: 'ambiguous',
    candidates: pool.slice(0, 5),
    message,
  };
}

// ----- updateViewing ---------------------------------------------------

export interface UpdateViewingChanges {
  scheduled_at_natural?: string;
  duration_minutes?: number;
  property_hint?: string;
  notes?: string;
}

export interface UpdateViewingArgs {
  viewing_reference: ViewingReferenceArgs;
  changes: UpdateViewingChanges;
}

export interface ViewingFieldDelta {
  scheduled_at?: string;
  duration_minutes?: number;
  property?: { development_id: string | null; name: string | null };
  notes?: string | null;
}

export interface ViewingUpdateDraft {
  status: 'draft';
  type: 'viewing_update';
  viewing_id: string;
  source: ViewingSource;
  applicant_name: string;
  previous: ViewingFieldDelta;
  next: ViewingFieldDelta;
  calendar_will_update: boolean;
  message: string;
}

export interface ViewingNeedsClarification {
  status: 'needs_clarification';
  reason: 'viewing_not_found' | 'viewing_ambiguous' | 'date_unparseable' | 'missing_time' | 'property_ambiguous' | 'property_not_in_assigned_schemes' | 'no_changes';
  message: string;
  candidates?: Array<Record<string, unknown>>;
}

export type ViewingUpdateResult = ViewingUpdateDraft | ViewingNeedsClarification;

export async function updateViewing(
  supabase: SupabaseClient,
  _tenantId: string,
  agentContext: AgentContext,
  args: UpdateViewingArgs,
): Promise<ToolResult> {
  const ref = args.viewing_reference || {};
  const changes = args.changes || {};

  const resolved = await resolveViewingReference(supabase, agentContext, ref);
  if (resolved.status === 'none') {
    const result: ViewingNeedsClarification = {
      status: 'needs_clarification',
      reason: 'viewing_not_found',
      message: resolved.message,
    };
    return { data: result, summary: result.message };
  }
  if (resolved.status === 'ambiguous') {
    const result: ViewingNeedsClarification = {
      status: 'needs_clarification',
      reason: 'viewing_ambiguous',
      message: resolved.message,
      candidates: resolved.candidates.map((c) => ({
        viewing_id: c.id,
        source: c.source,
        applicant_name: c.applicant_name,
        scheduled_at: c.scheduled_at,
        property: c.development_name,
      })),
    };
    return { data: result, summary: result.message };
  }

  const v = resolved.viewing;
  const prev: ViewingFieldDelta = {};
  const next: ViewingFieldDelta = {};

  // Scheduled_at change
  if (changes.scheduled_at_natural) {
    const parsed = parseScheduledAtNatural(changes.scheduled_at_natural, { tz: DEFAULT_TZ });
    if (!parsed.ok) {
      const reason = parsed.reason === 'missing_time' ? 'missing_time' : 'date_unparseable';
      const message =
        reason === 'missing_time'
          ? `What time on ${changes.scheduled_at_natural}?`
          : `I couldn't read "${changes.scheduled_at_natural}" as a date. Try "Tuesday 6pm" or "tomorrow at 11".`;
      const result: ViewingNeedsClarification = { status: 'needs_clarification', reason, message };
      return { data: result, summary: message };
    }
    if (parsed.iso !== v.scheduled_at) {
      prev.scheduled_at = v.scheduled_at;
      next.scheduled_at = parsed.iso;
    }
  }

  // Duration change
  if (typeof changes.duration_minutes === 'number' && Number.isFinite(changes.duration_minutes)) {
    const newDuration = Math.max(5, Math.min(240, Math.round(changes.duration_minutes)));
    if (newDuration !== v.duration_minutes) {
      prev.duration_minutes = v.duration_minutes;
      next.duration_minutes = newDuration;
    }
  }

  // Property change
  if (changes.property_hint && changes.property_hint.trim()) {
    const assigned = (agentContext.assignedDevelopmentIds || [])
      .map((id, idx) => ({ id, name: agentContext.assignedDevelopmentNames?.[idx] ?? '' }))
      .filter((d) => d.name.length > 0);
    const match = matchDevelopment(changes.property_hint.trim(), assigned);
    if (match.type === 'unique') {
      if (match.development.id !== v.development_id) {
        prev.property = { development_id: v.development_id, name: v.development_name };
        next.property = { development_id: match.development.id, name: match.development.name };
      }
    } else if (match.type === 'ambiguous') {
      const summaryLine = match.candidates.map((c) => c.name).join(', ');
      const message = `"${changes.property_hint}" matches more than one of your schemes: ${summaryLine}. Which one?`;
      const result: ViewingNeedsClarification = {
        status: 'needs_clarification',
        reason: 'property_ambiguous',
        message,
        candidates: match.candidates.map((c) => ({ development_id: c.id, name: c.name })),
      };
      return { data: result, summary: message };
    } else {
      const message = `"${changes.property_hint}" isn't in your assigned developments. Which one did you mean?`;
      const result: ViewingNeedsClarification = {
        status: 'needs_clarification',
        reason: 'property_not_in_assigned_schemes',
        message,
        candidates: assigned.map((d) => ({ development_id: d.id, name: d.name })),
      };
      return { data: result, summary: message };
    }
  }

  // Notes change
  if (typeof changes.notes === 'string') {
    const newNotes = changes.notes.trim() || null;
    const oldNotes = v.notes ?? null;
    if (newNotes !== oldNotes) {
      prev.notes = oldNotes;
      next.notes = newNotes;
    }
  }

  if (Object.keys(next).length === 0) {
    const message = "Nothing to change, those values match what's on file.";
    const result: ViewingNeedsClarification = {
      status: 'needs_clarification',
      reason: 'no_changes',
      message,
    };
    return { data: result, summary: message };
  }

  const draft: ViewingUpdateDraft = {
    status: 'draft',
    type: 'viewing_update',
    viewing_id: v.id,
    source: v.source,
    applicant_name: v.applicant_name,
    previous: prev,
    next,
    calendar_will_update: Boolean(v.device_calendar_event_id),
    message: `Reschedule ${v.applicant_name}.`,
  };
  return { data: draft, summary: draft.message };
}

// ----- cancelViewing ---------------------------------------------------

export interface CancelViewingArgs {
  viewing_reference: ViewingReferenceArgs;
  reason?: string;
}

export interface ViewingCancelDraft {
  status: 'draft';
  type: 'viewing_cancel';
  viewing_id: string;
  source: ViewingSource;
  applicant_name: string;
  scheduled_at: string;
  location: string | null;
  reason: string | null;
  calendar_will_delete: boolean;
  message: string;
}

export type ViewingCancelResult = ViewingCancelDraft | ViewingNeedsClarification;

export async function cancelViewing(
  supabase: SupabaseClient,
  _tenantId: string,
  agentContext: AgentContext,
  args: CancelViewingArgs,
): Promise<ToolResult> {
  const resolved = await resolveViewingReference(supabase, agentContext, args.viewing_reference || {});
  if (resolved.status === 'none') {
    const result: ViewingNeedsClarification = {
      status: 'needs_clarification',
      reason: 'viewing_not_found',
      message: resolved.message,
    };
    return { data: result, summary: result.message };
  }
  if (resolved.status === 'ambiguous') {
    const result: ViewingNeedsClarification = {
      status: 'needs_clarification',
      reason: 'viewing_ambiguous',
      message: resolved.message,
      candidates: resolved.candidates.map((c) => ({
        viewing_id: c.id,
        source: c.source,
        applicant_name: c.applicant_name,
        scheduled_at: c.scheduled_at,
        property: c.development_name,
      })),
    };
    return { data: result, summary: result.message };
  }

  const v = resolved.viewing;
  const draft: ViewingCancelDraft = {
    status: 'draft',
    type: 'viewing_cancel',
    viewing_id: v.id,
    source: v.source,
    applicant_name: v.applicant_name,
    scheduled_at: v.scheduled_at,
    location: v.location ?? v.development_name,
    reason: (args.reason || '').trim() || null,
    calendar_will_delete: Boolean(v.device_calendar_event_id),
    message: `Cancel ${v.applicant_name}'s viewing.`,
  };
  return { data: draft, summary: draft.message };
}

// ----- markViewingStatus ----------------------------------------------

export type MarkStatus = 'no_show' | 'completed';

export interface MarkViewingStatusArgs {
  viewing_reference: ViewingReferenceArgs;
  status: MarkStatus;
}

export interface ViewingMarkStatusDraft {
  status: 'draft';
  type: 'viewing_mark_status';
  viewing_id: string;
  source: ViewingSource;
  applicant_name: string;
  scheduled_at: string;
  location: string | null;
  new_status: MarkStatus;
  message: string;
}

export type ViewingMarkStatusResult = ViewingMarkStatusDraft | ViewingNeedsClarification;

export async function markViewingStatus(
  supabase: SupabaseClient,
  _tenantId: string,
  agentContext: AgentContext,
  args: MarkViewingStatusArgs,
): Promise<ToolResult> {
  const resolved = await resolveViewingReference(supabase, agentContext, args.viewing_reference || {});
  if (resolved.status === 'none') {
    const result: ViewingNeedsClarification = {
      status: 'needs_clarification',
      reason: 'viewing_not_found',
      message: resolved.message,
    };
    return { data: result, summary: result.message };
  }
  if (resolved.status === 'ambiguous') {
    const result: ViewingNeedsClarification = {
      status: 'needs_clarification',
      reason: 'viewing_ambiguous',
      message: resolved.message,
      candidates: resolved.candidates.map((c) => ({
        viewing_id: c.id,
        source: c.source,
        applicant_name: c.applicant_name,
        scheduled_at: c.scheduled_at,
        property: c.development_name,
      })),
    };
    return { data: result, summary: result.message };
  }

  const v = resolved.viewing;
  const newStatus: MarkStatus = args.status === 'completed' ? 'completed' : 'no_show';
  const verb = newStatus === 'completed' ? 'completed' : 'a no-show';
  const draft: ViewingMarkStatusDraft = {
    status: 'draft',
    type: 'viewing_mark_status',
    viewing_id: v.id,
    source: v.source,
    applicant_name: v.applicant_name,
    scheduled_at: v.scheduled_at,
    location: v.location ?? v.development_name,
    new_status: newStatus,
    message: `Mark ${v.applicant_name}'s viewing as ${verb}.`,
  };
  return { data: draft, summary: draft.message };
}

// =====================================================================
// Confirm functions, called from API routes (not LLM tools).
// =====================================================================

export interface AuditedMutationResult {
  viewing_id: string;
  source: ViewingSource;
  audit_log_id: string;
  device_calendar_event_id: string | null;
  next_state: Record<string, unknown>;
  previous_state: Record<string, unknown>;
}

async function snapshotRow(
  supabase: SupabaseClient,
  source: ViewingSource,
  viewingId: string,
  tenantId: string,
): Promise<Record<string, unknown> | null> {
  const table = source === 'viewings' ? 'viewings' : 'agent_viewings';
  const { data } = await supabase
    .from(table)
    .select('*')
    .eq('id', viewingId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return (data as Record<string, unknown>) ?? null;
}

async function writeAudit(
  supabase: SupabaseClient,
  args: {
    tenantId: string;
    agentId: string;
    viewingId: string;
    action: 'updated' | 'cancelled' | 'marked_no_show' | 'marked_completed' | 'restored';
    previous: Record<string, unknown> | null;
    next: Record<string, unknown> | null;
  },
): Promise<string> {
  const { data, error } = await supabase
    .from('viewing_audit_log')
    .insert({
      tenant_id: args.tenantId,
      agent_id: args.agentId,
      viewing_id: args.viewingId,
      action: args.action,
      previous_state: args.previous,
      new_state: args.next,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message || 'Failed to write audit row');
  return data.id;
}

export interface ConfirmUpdateArgs {
  viewing_id: string;
  source: ViewingSource;
  next: ViewingFieldDelta;
}

export async function confirmUpdateViewing(
  supabase: SupabaseClient,
  agentContext: AgentContext,
  args: ConfirmUpdateArgs,
): Promise<AuditedMutationResult> {
  const previous = await snapshotRow(supabase, args.source, args.viewing_id, agentContext.tenantId);
  if (!previous) throw new Error('Viewing not found');

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (args.source === 'viewings') {
    if (args.next.scheduled_at) update.scheduled_at = args.next.scheduled_at;
    if (typeof args.next.duration_minutes === 'number') update.duration_minutes = args.next.duration_minutes;
    if (args.next.property && 'development_id' in args.next.property) {
      update.development_id = args.next.property.development_id;
      update.location = args.next.property.name;
    }
    if (args.next.notes !== undefined) update.notes = args.next.notes;
  } else {
    // agent_viewings has split date/time + scheme_name string columns.
    if (args.next.scheduled_at) {
      const dt = new Date(args.next.scheduled_at);
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: DEFAULT_TZ,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      });
      const parts: Record<string, string> = {};
      for (const p of fmt.formatToParts(dt)) {
        if (p.type !== 'literal') parts[p.type] = p.value;
      }
      update.viewing_date = `${parts.year}-${parts.month}-${parts.day}`;
      update.viewing_time = `${parts.hour}:${parts.minute}`;
    }
    if (args.next.property && 'development_id' in args.next.property) {
      update.development_id = args.next.property.development_id;
      update.scheme_name = args.next.property.name;
    }
    if (args.next.notes !== undefined) update.notes = args.next.notes;
  }

  const table = args.source === 'viewings' ? 'viewings' : 'agent_viewings';
  const { data: updated, error: updateError } = await supabase
    .from(table)
    .update(update)
    .eq('id', args.viewing_id)
    .eq('tenant_id', agentContext.tenantId)
    .select('*')
    .single();
  if (updateError || !updated) throw new Error(updateError?.message || 'Update did not land');

  const auditId = await writeAudit(supabase, {
    tenantId: agentContext.tenantId,
    agentId: agentContext.authUserId,
    viewingId: args.viewing_id,
    action: 'updated',
    previous,
    next: updated as Record<string, unknown>,
  });

  return {
    viewing_id: args.viewing_id,
    source: args.source,
    audit_log_id: auditId,
    device_calendar_event_id: (previous as any)?.device_calendar_event_id ?? null,
    next_state: updated as Record<string, unknown>,
    previous_state: previous,
  };
}

export interface ConfirmCancelArgs {
  viewing_id: string;
  source: ViewingSource;
  reason?: string | null;
}

export async function confirmCancelViewing(
  supabase: SupabaseClient,
  agentContext: AgentContext,
  args: ConfirmCancelArgs,
): Promise<AuditedMutationResult> {
  const previous = await snapshotRow(supabase, args.source, args.viewing_id, agentContext.tenantId);
  if (!previous) throw new Error('Viewing not found');

  const table = args.source === 'viewings' ? 'viewings' : 'agent_viewings';
  const update: Record<string, unknown> = {
    status: 'cancelled',
    updated_at: new Date().toISOString(),
  };
  if (args.reason) {
    const trimmed = args.reason.trim();
    if (trimmed) {
      const existingNotes = (previous as any).notes ? `${(previous as any).notes}\n` : '';
      update.notes = `${existingNotes}Cancelled: ${trimmed}`;
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from(table)
    .update(update)
    .eq('id', args.viewing_id)
    .eq('tenant_id', agentContext.tenantId)
    .select('*')
    .single();
  if (updateError || !updated || (updated as any).status !== 'cancelled') {
    throw new Error(updateError?.message || 'Cancel did not land');
  }

  const auditId = await writeAudit(supabase, {
    tenantId: agentContext.tenantId,
    agentId: agentContext.authUserId,
    viewingId: args.viewing_id,
    action: 'cancelled',
    previous,
    next: updated as Record<string, unknown>,
  });

  return {
    viewing_id: args.viewing_id,
    source: args.source,
    audit_log_id: auditId,
    device_calendar_event_id: (previous as any)?.device_calendar_event_id ?? null,
    next_state: updated as Record<string, unknown>,
    previous_state: previous,
  };
}

export interface ConfirmMarkStatusArgs {
  viewing_id: string;
  source: ViewingSource;
  status: MarkStatus;
}

export async function confirmMarkStatus(
  supabase: SupabaseClient,
  agentContext: AgentContext,
  args: ConfirmMarkStatusArgs,
): Promise<AuditedMutationResult> {
  const previous = await snapshotRow(supabase, args.source, args.viewing_id, agentContext.tenantId);
  if (!previous) throw new Error('Viewing not found');

  const table = args.source === 'viewings' ? 'viewings' : 'agent_viewings';
  const { data: updated, error } = await supabase
    .from(table)
    .update({ status: args.status, updated_at: new Date().toISOString() })
    .eq('id', args.viewing_id)
    .eq('tenant_id', agentContext.tenantId)
    .select('*')
    .single();
  if (error || !updated || (updated as any).status !== args.status) {
    throw new Error(error?.message || 'Status update did not land');
  }

  const auditAction = args.status === 'no_show' ? 'marked_no_show' : 'marked_completed';
  const auditId = await writeAudit(supabase, {
    tenantId: agentContext.tenantId,
    agentId: agentContext.authUserId,
    viewingId: args.viewing_id,
    action: auditAction,
    previous,
    next: updated as Record<string, unknown>,
  });

  return {
    viewing_id: args.viewing_id,
    source: args.source,
    audit_log_id: auditId,
    device_calendar_event_id: (previous as any)?.device_calendar_event_id ?? null,
    next_state: updated as Record<string, unknown>,
    previous_state: previous,
  };
}

// ----- undoViewingAction ----------------------------------------------

const UNDO_WINDOW_MS = 30 * 60 * 1000;

export interface UndoResult {
  audit_log_id: string;
  viewing_id: string;
  source: ViewingSource;
  restored_state: Record<string, unknown>;
  device_calendar_event_id: string | null;
  recalendar_hint: 'restore' | 'none';
}

export async function undoViewingAction(
  supabase: SupabaseClient,
  agentContext: AgentContext,
  args: { audit_log_id: string },
): Promise<UndoResult> {
  const { data: audit, error: auditErr } = await supabase
    .from('viewing_audit_log')
    .select('*')
    .eq('id', args.audit_log_id)
    .eq('tenant_id', agentContext.tenantId)
    .maybeSingle();
  if (auditErr || !audit) throw new Error('Audit row not found');

  const a = audit as any;
  if (a.undone_at) throw new Error('Already undone');
  if (Date.now() - new Date(a.created_at).getTime() > UNDO_WINDOW_MS) {
    throw new Error('Undo window has expired');
  }

  const previous = a.previous_state as Record<string, unknown> | null;
  if (!previous) throw new Error('No previous state recorded');

  // Detect source by trying canonical first.
  let source: ViewingSource = 'viewings';
  const { data: probe } = await supabase
    .from('viewings')
    .select('id')
    .eq('id', a.viewing_id)
    .eq('tenant_id', agentContext.tenantId)
    .maybeSingle();
  if (!probe) source = 'agent_viewings';
  const table = source === 'viewings' ? 'viewings' : 'agent_viewings';

  // Whitelist columns we restore to avoid clobbering created_at, id, etc.
  const restorableCanonical = [
    'scheduled_at', 'duration_minutes', 'location', 'notes', 'status',
    'development_id', 'unit_id',
  ];
  const restorableLegacy = [
    'viewing_date', 'viewing_time', 'status', 'notes', 'scheme_name',
    'unit_ref', 'development_id', 'unit_id', 'buyer_name',
  ];
  const allow = source === 'viewings' ? restorableCanonical : restorableLegacy;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allow) {
    if (k in previous) update[k] = previous[k];
  }

  const { data: restored, error: restoreErr } = await supabase
    .from(table)
    .update(update)
    .eq('id', a.viewing_id)
    .eq('tenant_id', agentContext.tenantId)
    .select('*')
    .single();
  if (restoreErr || !restored) throw new Error(restoreErr?.message || 'Restore did not land');

  await supabase
    .from('viewing_audit_log')
    .update({ undone_at: new Date().toISOString() })
    .eq('id', a.id);

  // Write a 'restored' audit row so the trail is complete.
  await supabase.from('viewing_audit_log').insert({
    tenant_id: agentContext.tenantId,
    agent_id: agentContext.authUserId,
    viewing_id: a.viewing_id,
    action: 'restored',
    previous_state: a.new_state,
    new_state: restored,
  });

  // For cancellations, the device calendar event is gone, so the client
  // should re-add. For other actions, the event still exists.
  const recalendarHint: 'restore' | 'none' = a.action === 'cancelled' ? 'restore' : 'none';

  return {
    audit_log_id: a.id,
    viewing_id: a.viewing_id,
    source,
    restored_state: restored as Record<string, unknown>,
    device_calendar_event_id: (restored as any)?.device_calendar_event_id ?? null,
    recalendar_hint: recalendarHint,
  };
}
