import { SupabaseClient } from '@supabase/supabase-js';
import { ToolResult, AgentContext } from '../types';
import {
  parseScheduledAtNatural,
  resolveApplicantByName,
  resolvePropertyForApplicant,
  formatViewingTime,
  DEFAULT_TZ,
} from '../viewing-resolver';

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

  const applicantRes = await resolveApplicantByName(supabase, agentContext.agentProfileId, params.applicant_name);
  if (applicantRes.status === 'none') {
    const message = `I don't have an applicant matching "${params.applicant_name}". Add them in Applicants first, or check the spelling.`;
    const result: CreateViewingResult = {
      status: 'needs_clarification',
      reason: 'applicant_not_found',
      message,
    };
    return { data: result, summary: message };
  }
  if (applicantRes.status === 'ambiguous') {
    const candidates = applicantRes.candidates ?? [];
    const summaryLine = candidates
      .map((c) => `${c.name}${c.latest_enquiry_property ? ` — ${c.latest_enquiry_property}` : ''}`)
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

  const propertyRes = await resolvePropertyForApplicant(supabase, {
    agentProfileId: agentContext.agentProfileId,
    applicantId: applicant.id,
    applicantEmail: applicant.email,
    applicantName: applicant.name,
    propertyHint: params.property_hint,
  });

  if (propertyRes.status === 'none') {
    const message = `${applicant.name} has no active enquiry I can pin a property to. Which development is this viewing for?`;
    const result: CreateViewingResult = {
      status: 'needs_clarification',
      reason: 'property_not_found',
      message,
    };
    return { data: result, summary: message };
  }

  if (propertyRes.status === 'ambiguous') {
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
  }

  const property = propertyRes.property!;
  const duration = Number.isFinite(params.duration_minutes) && params.duration_minutes! > 0
    ? Math.min(Math.max(Math.round(params.duration_minutes!), 5), 240)
    : 30;

  const draft: ViewingDraft = {
    applicant_id: applicant.id,
    applicant_name: applicant.name,
    development_id: property.development_id,
    development_name: property.name,
    scheduled_at: parsedDate.iso,
    duration_minutes: duration,
    location: property.name,
    notes: params.notes?.trim() || null,
  };

  const message = `Viewing draft ready: ${applicant.name}, ${property.name}, ${formatViewingTime(parsedDate.iso, tz)}. Confirm to create.`;
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
