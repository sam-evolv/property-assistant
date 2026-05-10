import { SupabaseClient } from '@supabase/supabase-js';
import { ToolResult, AgentContext } from '../types';
import {
  parseScheduledAtNatural,
  resolveApplicantByName,
  resolvePropertyForApplicant,
  formatViewingTime,
  DEFAULT_TZ,
} from '../viewing-resolver';
import { matchDevelopment } from '../property-matcher';

/**
 * Composite scheduling tool, session 3.
 *
 * Whereas create_viewing handles a single existing applicant and
 * manage_applicants handles a list of applicants in isolation, this
 * composite handles "schedule N viewings, possibly creating M applicants"
 * as one mental object. The card surfaces a single Confirm; the writes
 * land atomically through schedule_viewings_atomic so a property typo
 * does not leave half the applicants created.
 */

export type CalendarPreference = 'device' | 'google' | 'outlook' | 'apple' | 'skip';

export interface CompositeApplicantToCreate {
  temp_index: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  classification: 'new';
}

export type ApplicantRef = { existing_id: string } | { new_index: number };

export interface CompositeViewingToCreate {
  temp_index: number;
  applicant_ref: ApplicantRef;
  applicant_name: string;
  development_id: string;
  development_name: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  notes: string | null;
}

export interface CompositeCalendarBlock {
  preferred_provider: CalendarPreference | null;
  ask_user: boolean;
}

export interface CompositeScheduleDraft {
  status: 'draft';
  type: 'composite_schedule';
  applicants_to_create: CompositeApplicantToCreate[];
  viewings_to_create: CompositeViewingToCreate[];
  calendar: CompositeCalendarBlock;
  message: string;
}

export interface CompositeScheduleClarification {
  status: 'needs_clarification';
  reason:
    | 'applicant_ambiguous'
    | 'property_required_for_new_applicant'
    | 'property_ambiguous'
    | 'property_not_found'
    | 'property_not_in_assigned_schemes'
    | 'no_property_specified'
    | 'date_unparseable'
    | 'missing_time'
    | 'no_viewings';
  message: string;
  candidates?: Array<Record<string, unknown>>;
}

export type CompositeScheduleResult = CompositeScheduleDraft | CompositeScheduleClarification;

interface ScheduleViewingsParams {
  viewings?: Array<{
    applicant_name: string;
    scheduled_at_natural: string;
    property_hint?: string;
    duration_minutes?: number;
    notes?: string;
  }>;
  calendar_preference?: CalendarPreference;
}

const VALID_CALENDAR_PREFERENCES: CalendarPreference[] = ['device', 'google', 'outlook', 'apple', 'skip'];

function normalisePreference(raw: unknown): CalendarPreference | null {
  if (typeof raw !== 'string') return null;
  const lower = raw.trim().toLowerCase();
  return VALID_CALENDAR_PREFERENCES.includes(lower as CalendarPreference)
    ? (lower as CalendarPreference)
    : null;
}

async function readPreferredCalendar(
  supabase: SupabaseClient,
  authUserId: string,
): Promise<CalendarPreference | null> {
  const { data } = await supabase
    .from('agent_settings')
    .select('preferred_calendar_provider')
    .eq('agent_id', authUserId)
    .maybeSingle();
  return normalisePreference((data as any)?.preferred_calendar_provider);
}

interface AssignedDevelopment {
  id: string;
  name: string;
}

function clampDuration(raw: number | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return 30;
  return Math.min(Math.max(Math.round(raw), 5), 240);
}

export async function scheduleViewings(
  supabase: SupabaseClient,
  _tenantId: string,
  agentContext: AgentContext,
  params: ScheduleViewingsParams,
): Promise<ToolResult> {
  const tz = DEFAULT_TZ;
  const requested = Array.isArray(params.viewings) ? params.viewings : [];
  if (requested.length === 0) {
    const message = "Tell me which viewings you'd like scheduled. One name and time per slot.";
    const result: CompositeScheduleResult = {
      status: 'needs_clarification',
      reason: 'no_viewings',
      message,
    };
    return { data: result, summary: message };
  }

  const assignedDevelopments: AssignedDevelopment[] = (agentContext.assignedDevelopmentIds || []).map((id, idx) => ({
    id,
    name: agentContext.assignedDevelopmentNames?.[idx] ?? '',
  })).filter((d) => d.name.length > 0);

  // Build new-applicant slots, deduped by lowercased full_name. Multiple
  // viewings for the same new person share one applicants_to_create entry
  // and reference it by the same new_index.
  const applicantsByLowerName = new Map<string, number>();
  const applicants_to_create: CompositeApplicantToCreate[] = [];
  const viewings_to_create: CompositeViewingToCreate[] = [];

  for (let i = 0; i < requested.length; i++) {
    const v = requested[i];
    const applicantName = (v.applicant_name || '').trim();
    if (!applicantName) {
      const message = `Viewing #${i + 1} has no applicant name. Tell me who the viewing is for.`;
      const result: CompositeScheduleResult = {
        status: 'needs_clarification',
        reason: 'applicant_ambiguous',
        message,
      };
      return { data: result, summary: message };
    }

    const parsed = parseScheduledAtNatural(v.scheduled_at_natural ?? '', { tz });
    if (!parsed.ok) {
      const reason = parsed.reason === 'missing_time' ? 'missing_time' : 'date_unparseable';
      const message =
        reason === 'missing_time'
          ? `What time on ${v.scheduled_at_natural || 'that day'} for ${applicantName}?`
          : `I couldn't read "${v.scheduled_at_natural}" as a date for ${applicantName}. Try "Thursday 6pm" or "tomorrow at 11".`;
      const result: CompositeScheduleResult = {
        status: 'needs_clarification',
        reason,
        message,
      };
      return { data: result, summary: message };
    }

    const applicantRes = await resolveApplicantByName(
      supabase,
      agentContext.agentProfileId,
      applicantName,
    );

    if (applicantRes.status === 'ambiguous') {
      const candidates = applicantRes.candidates ?? [];
      const summaryLine = candidates
        .map((c) => `${c.name}${c.latest_enquiry_property ? ` (${c.latest_enquiry_property})` : ''}`)
        .join('; ');
      const message = `A few applicants match "${applicantName}": ${summaryLine}. Which one?`;
      const result: CompositeScheduleResult = {
        status: 'needs_clarification',
        reason: 'applicant_ambiguous',
        message,
        candidates,
      };
      return { data: result, summary: message };
    }

    let applicant_ref: ApplicantRef;
    let resolvedApplicantName = applicantName;
    let development_id: string | null = null;
    let development_name: string | null = null;

    if (applicantRes.status === 'one') {
      const a = applicantRes.applicant!;
      applicant_ref = { existing_id: a.id };
      resolvedApplicantName = a.name;
    } else {
      // New applicant. Dedup by lowercased name so multiple viewings for
      // the same new person share one applicants_to_create entry.
      const lowerKey = applicantName.toLowerCase();
      const existingIdx = applicantsByLowerName.get(lowerKey);
      if (existingIdx === undefined) {
        const slotIdx = applicants_to_create.length;
        applicants_to_create.push({
          temp_index: slotIdx,
          full_name: applicantName,
          email: null,
          phone: null,
          classification: 'new',
        });
        applicantsByLowerName.set(lowerKey, slotIdx);
        applicant_ref = { new_index: slotIdx };
      } else {
        applicant_ref = { new_index: existingIdx };
      }
    }

    // Property resolution. property_hint takes priority over enquiries:
    // when the user named a development, trust them, even if the applicant
    // also has enquiries on a different scheme.
    const hint = (v.property_hint || '').trim();
    if (hint) {
      const hintMatch = matchDevelopment(hint, assignedDevelopments);
      if (hintMatch.type === 'unique') {
        development_id = hintMatch.development.id;
        development_name = hintMatch.development.name;
      } else if (hintMatch.type === 'ambiguous') {
        const summaryLine = hintMatch.candidates.map((c) => c.name).join(', ');
        const message = `"${hint}" matches more than one of your schemes: ${summaryLine}. Which one for ${resolvedApplicantName}?`;
        const result: CompositeScheduleResult = {
          status: 'needs_clarification',
          reason: 'property_ambiguous',
          message,
          candidates: hintMatch.candidates.map((c) => ({ development_id: c.id, name: c.name })),
        };
        return { data: result, summary: message };
      } else {
        const message = `"${hint}" isn't in your assigned developments. Which one did you mean?`;
        const result: CompositeScheduleResult = {
          status: 'needs_clarification',
          reason: 'property_not_in_assigned_schemes',
          message,
          candidates: assignedDevelopments.map((d) => ({ development_id: d.id, name: d.name })),
        };
        return { data: result, summary: message };
      }
    } else if (applicantRes.status === 'one') {
      const a = applicantRes.applicant!;
      const propertyRes = await resolvePropertyForApplicant(supabase, {
        agentProfileId: agentContext.agentProfileId,
        applicantId: a.id,
        applicantEmail: a.email,
        applicantName: a.name,
      });

      if (propertyRes.status === 'one') {
        development_id = propertyRes.property!.development_id;
        development_name = propertyRes.property!.name;
      } else if (propertyRes.status === 'ambiguous') {
        const candidates = propertyRes.candidates ?? [];
        const summaryLine = candidates.map((c) => c.name).join(', ');
        const message = `${a.name} has enquiries on more than one scheme: ${summaryLine}. Which one for the ${formatViewingTime(parsed.iso, tz)} viewing?`;
        const result: CompositeScheduleResult = {
          status: 'needs_clarification',
          reason: 'property_ambiguous',
          message,
          candidates,
        };
        return { data: result, summary: message };
      } else {
        const message = 'Which development is this viewing for?';
        const result: CompositeScheduleResult = {
          status: 'needs_clarification',
          reason: 'no_property_specified',
          message,
          candidates: assignedDevelopments.map((d) => ({ development_id: d.id, name: d.name })),
        };
        return { data: result, summary: message };
      }
    } else {
      // New applicant + no hint: ask which scheme.
      const message = 'Which development is this viewing for?';
      const result: CompositeScheduleResult = {
        status: 'needs_clarification',
        reason: 'no_property_specified',
        message,
        candidates: assignedDevelopments.map((d) => ({ development_id: d.id, name: d.name })),
      };
      return { data: result, summary: message };
    }

    if (!development_id || !development_name) {
      const message = `Couldn't pin a development for the ${formatViewingTime(parsed.iso, tz)} viewing. Tell me which scheme.`;
      const result: CompositeScheduleResult = {
        status: 'needs_clarification',
        reason: 'property_not_found',
        message,
      };
      return { data: result, summary: message };
    }

    viewings_to_create.push({
      temp_index: viewings_to_create.length,
      applicant_ref,
      applicant_name: resolvedApplicantName,
      development_id,
      development_name,
      scheduled_at: parsed.iso,
      duration_minutes: clampDuration(v.duration_minutes),
      location: development_name,
      notes: (v.notes || '').trim() || null,
    });
  }

  // Resolve calendar preference. If the message carried one explicitly,
  // use it. Otherwise fall back to the stored agent_settings value.
  const explicit = normalisePreference(params.calendar_preference);
  const stored = await readPreferredCalendar(supabase, agentContext.authUserId);
  const preferred = explicit ?? stored;

  const summaryParts: string[] = [];
  summaryParts.push(`Schedule ${viewings_to_create.length} viewing${viewings_to_create.length === 1 ? '' : 's'}`);
  if (applicants_to_create.length > 0) {
    summaryParts.push(`(${applicants_to_create.length} new applicant${applicants_to_create.length === 1 ? '' : 's'})`);
  }
  const message = summaryParts.join(' ');

  const result: CompositeScheduleDraft = {
    status: 'draft',
    type: 'composite_schedule',
    applicants_to_create,
    viewings_to_create,
    calendar: {
      preferred_provider: preferred,
      ask_user: preferred === null,
    },
    message,
  };
  return { data: result, summary: message };
}

// -------- Confirmation path, called from the API route ----------------

export interface ConfirmCompositeScheduleArgs {
  applicants_to_create: Array<Pick<CompositeApplicantToCreate, 'full_name' | 'email' | 'phone'>>;
  viewings_to_create: Array<{
    applicant_ref: ApplicantRef;
    development_id: string;
    scheduled_at: string;
    duration_minutes: number;
    location: string | null;
    notes: string | null;
  }>;
}

export interface ConfirmCompositeScheduleResult {
  status: 'success' | 'error';
  created_applicants: Array<{ temp_index: number; id: string; full_name: string; audit_log_id: string }>;
  created_viewings: Array<{ temp_index: number; id: string; applicant_id: string; scheduled_at: string; duration_minutes: number }>;
  error: string | null;
}

export async function confirmCompositeSchedule(
  supabase: SupabaseClient,
  agentContext: AgentContext,
  args: ConfirmCompositeScheduleArgs,
): Promise<ConfirmCompositeScheduleResult> {
  console.log('[confirmCompositeSchedule] start', {
    authUserId: agentContext.authUserId,
    tenantId: agentContext.tenantId,
    applicants: args.applicants_to_create.length,
    viewings: args.viewings_to_create.length,
  });

  const { data, error } = await supabase.rpc('schedule_viewings_atomic', {
    p_agent_id: agentContext.authUserId,
    p_tenant_id: agentContext.tenantId,
    p_applicants_to_create: args.applicants_to_create.map((a) => ({
      full_name: a.full_name,
      email: a.email,
      phone: a.phone,
    })),
    p_viewings_to_create: args.viewings_to_create,
  });

  if (error) {
    console.error('[confirmCompositeSchedule] rpc error', { message: error.message });
    return {
      status: 'error',
      created_applicants: [],
      created_viewings: [],
      error: error.message,
    };
  }

  const payload = (data ?? {}) as Record<string, unknown>;
  if (typeof payload.error === 'string') {
    console.error('[confirmCompositeSchedule] rpc returned error', { message: payload.error });
    return {
      status: 'error',
      created_applicants: [],
      created_viewings: [],
      error: payload.error,
    };
  }

  const created_applicants = Array.isArray(payload.created_applicants)
    ? (payload.created_applicants as ConfirmCompositeScheduleResult['created_applicants'])
    : [];
  const created_viewings = Array.isArray(payload.created_viewings)
    ? (payload.created_viewings as ConfirmCompositeScheduleResult['created_viewings'])
    : [];

  console.log('[confirmCompositeSchedule] done', {
    applicants: created_applicants.length,
    viewings: created_viewings.length,
  });

  return {
    status: 'success',
    created_applicants,
    created_viewings,
    error: null,
  };
}
