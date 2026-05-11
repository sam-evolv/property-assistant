import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { resolveAgentContextV2 } from '@/lib/agent-intelligence/resolve-agent-v2';
import {
  confirmCompositeSchedule,
  type ApplicantRef,
  type CalendarPreference,
} from '@/lib/agent-intelligence/tools/composite-tools';
import type { AgentContext } from '@/lib/agent-intelligence/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CALENDAR_CHOICES: CalendarPreference[] = ['device', 'google', 'outlook', 'apple', 'skip'];
const STORABLE_PROVIDERS: CalendarPreference[] = ['device', 'google', 'outlook', 'apple'];

interface IncomingApplicant {
  full_name: string;
  email?: string | null;
  phone?: string | null;
}

interface IncomingViewing {
  applicant_ref: ApplicantRef;
  development_id: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  notes: string | null;
  applicant_name?: string;
  development_name?: string;
}

interface IncomingBody {
  applicants_to_create: IncomingApplicant[];
  viewings_to_create: IncomingViewing[];
  selected_indices?: { applicants?: number[]; viewings?: number[] };
  calendar_choice: CalendarPreference;
}

function isCalendarChoice(value: unknown): value is CalendarPreference {
  return typeof value === 'string' && CALENDAR_CHOICES.includes(value as CalendarPreference);
}

function isApplicantRef(value: unknown): value is ApplicantRef {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.existing_id === 'string' && v.existing_id.length > 0) return true;
  if (typeof v.new_index === 'number' && Number.isInteger(v.new_index) && v.new_index >= 0) return true;
  return false;
}

function validateBody(body: any): { ok: true; data: IncomingBody } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid body' };
  if (!Array.isArray(body.applicants_to_create)) return { ok: false, error: 'applicants_to_create must be an array' };
  if (!Array.isArray(body.viewings_to_create)) return { ok: false, error: 'viewings_to_create must be an array' };
  if (!isCalendarChoice(body.calendar_choice)) return { ok: false, error: 'calendar_choice required' };

  for (const a of body.applicants_to_create) {
    if (!a || typeof a !== 'object') return { ok: false, error: 'Invalid applicant entry' };
    if (typeof a.full_name !== 'string' || a.full_name.trim().length === 0) {
      return { ok: false, error: 'Each applicant requires a full_name' };
    }
  }

  for (const v of body.viewings_to_create) {
    if (!v || typeof v !== 'object') return { ok: false, error: 'Invalid viewing entry' };
    if (!isApplicantRef(v.applicant_ref)) return { ok: false, error: 'Viewing applicant_ref must contain existing_id or new_index' };
    if (typeof v.development_id !== 'string' || v.development_id.length === 0) {
      return { ok: false, error: 'Viewing development_id required' };
    }
    if (typeof v.scheduled_at !== 'string' || v.scheduled_at.length === 0) {
      return { ok: false, error: 'Viewing scheduled_at required' };
    }
    if (typeof v.duration_minutes !== 'number' || !Number.isFinite(v.duration_minutes)) {
      return { ok: false, error: 'Viewing duration_minutes must be a number' };
    }
  }

  return { ok: true, data: body as IncomingBody };
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const validated = validateBody(raw);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const body = validated.data;

    const supabaseAdmin = getSupabaseAdmin();
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const v2 = await resolveAgentContextV2(supabaseAdmin, user.id);
    const resolved = v2.context;
    if (!resolved) return NextResponse.json({ error: 'No agent profile found' }, { status: 401 });

    const agentContext: AgentContext = {
      agentProfileId: resolved.agentProfileId,
      authUserId: resolved.authUserId,
      tenantId: resolved.tenantId ?? '',
      displayName: resolved.displayName,
      agencyName: resolved.agencyName,
      agentType: resolved.agentType,
      assignedSchemes: resolved.assignedSchemes,
      assignedDevelopmentIds: resolved.assignedDevelopmentIds,
      assignedDevelopmentNames: resolved.assignedDevelopmentNames,
      activeDevelopmentId: null,
      isDemoMode: resolved.isDemoMode,
    };

    if (!agentContext.tenantId) {
      return NextResponse.json({ error: 'Agent has no tenant assignment' }, { status: 403 });
    }

    // Apply selected_indices filtering. Defaults to "all selected" when the
    // client omits the keys, which is what the card sends on initial confirm.
    const selectedApplicants = Array.isArray(body.selected_indices?.applicants)
      ? new Set(body.selected_indices!.applicants)
      : new Set(body.applicants_to_create.map((_, i) => i));
    const selectedViewings = Array.isArray(body.selected_indices?.viewings)
      ? new Set(body.selected_indices!.viewings)
      : new Set(body.viewings_to_create.map((_, i) => i));

    // When the user deselects an applicant, drop any viewing that points to
    // that applicant via new_index. The card already disables those checkboxes
    // but we revalidate server-side because the client is untrusted.
    const applicantsKept = body.applicants_to_create
      .map((a, idx) => ({ a, idx }))
      .filter(({ idx }) => selectedApplicants.has(idx));
    const oldToNewIndex = new Map<number, number>();
    applicantsKept.forEach(({ idx }, newIdx) => {
      oldToNewIndex.set(idx, newIdx);
    });

    const viewingsKept = body.viewings_to_create
      .map((v, idx) => ({ v, idx }))
      .filter(({ v, idx }) => {
        if (!selectedViewings.has(idx)) return false;
        if ('new_index' in v.applicant_ref) {
          return selectedApplicants.has(v.applicant_ref.new_index);
        }
        return true;
      })
      .map(({ v }) => {
        let ref: ApplicantRef = v.applicant_ref;
        if ('new_index' in ref) {
          const remapped = oldToNewIndex.get(ref.new_index);
          ref = remapped !== undefined ? { new_index: remapped } : ref;
        }
        return {
          applicant_ref: ref,
          development_id: v.development_id,
          scheduled_at: v.scheduled_at,
          duration_minutes: v.duration_minutes,
          location: v.location,
          notes: v.notes,
        };
      });

    if (viewingsKept.length === 0) {
      return NextResponse.json({ error: 'Pick at least one viewing to schedule' }, { status: 400 });
    }

    // Persist calendar preference when the choice differs from what's stored
    // (and is something we can store, so 'skip' does not overwrite the
    // saved value).
    if (STORABLE_PROVIDERS.includes(body.calendar_choice)) {
      try {
        await supabaseAdmin
          .from('agent_settings')
          .upsert(
            {
              agent_id: agentContext.authUserId,
              tenant_id: agentContext.tenantId,
              preferred_calendar_provider: body.calendar_choice,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'agent_id' },
          );
      } catch (err) {
        console.error('[confirm-composite-schedule] failed to upsert preferred calendar', err);
      }
    }

    const expectedApplicants = applicantsKept.length;
    const expectedViewings = viewingsKept.length;

    const result = await confirmCompositeSchedule(supabaseAdmin, agentContext, {
      applicants_to_create: applicantsKept.map(({ a }) => ({
        full_name: a.full_name.trim(),
        email: a.email?.trim() || null,
        phone: a.phone?.trim() || null,
      })),
      viewings_to_create: viewingsKept,
    });

    if (result.status === 'error') {
      return NextResponse.json(
        {
          status: 'error',
          error: result.error,
          created_applicants: result.created_applicants,
          created_viewings: result.created_viewings,
        },
        { status: 500 },
      );
    }

    // Mutation-result-integrity guard. The RPC reports success, but we
    // refuse to call it success unless every expected row appears in the
    // returned arrays. Without this, a silently-shorter array could be
    // dressed up as a green receipt while half the writes never landed.
    const actualApplicants = result.created_applicants.length;
    const actualViewings = result.created_viewings.length;
    if (actualApplicants !== expectedApplicants || actualViewings !== expectedViewings) {
      const integrityMessage =
        `RPC reported success but only ${actualApplicants}/${expectedApplicants} applicants and ` +
        `${actualViewings}/${expectedViewings} viewings landed.`;
      console.error('[confirm-composite-schedule] integrity mismatch', {
        expectedApplicants,
        actualApplicants,
        expectedViewings,
        actualViewings,
      });
      return NextResponse.json(
        {
          status: 'error',
          error: integrityMessage,
          created_applicants: result.created_applicants,
          created_viewings: result.created_viewings,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      status: 'success',
      calendar_choice: body.calendar_choice,
      created_applicants: result.created_applicants,
      created_viewings: result.created_viewings,
      // Echo the original payload so the receipt card can render names and
      // dev info without a second round trip.
      applicant_payload: body.applicants_to_create,
      viewing_payload: body.viewings_to_create,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[confirm-composite-schedule] unhandled', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
