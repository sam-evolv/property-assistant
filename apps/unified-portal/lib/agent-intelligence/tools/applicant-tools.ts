import { SupabaseClient } from '@supabase/supabase-js';
import { ToolResult, AgentContext } from '../types';
import { parseBulkApplicants, type ParsedApplicant } from '../applicant-parser';

export type ApplicantWriteMode = 'always_confirm' | 'propose_undoable';

export interface ApplicantCandidate {
  full_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  source: string;
  classification: 'new' | 'duplicate_likely';
  existing_match?: { id: string; full_name: string; email: string | null };
}

export interface ApplicantUpdateDraft {
  applicant_id: string;
  full_name: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  changed_fields: string[];
}

export interface ApplicantRemoveDraft {
  applicant_id: string;
  full_name: string;
  has_dependencies: boolean;
  dependency_summary: string | null;
}

type ManageApplicantsAction = 'add' | 'update' | 'remove';

export interface ManageApplicantsAddDraft {
  status: 'draft';
  action: 'add';
  mode: ApplicantWriteMode;
  candidates: ApplicantCandidate[];
  message: string;
}

export interface ManageApplicantsUpdateDraft {
  status: 'draft';
  action: 'update';
  mode: ApplicantWriteMode;
  draft: ApplicantUpdateDraft;
  message: string;
}

export interface ManageApplicantsRemoveDraft {
  status: 'draft';
  action: 'remove';
  mode: ApplicantWriteMode;
  drafts: ApplicantRemoveDraft[];
  message: string;
}

export interface ManageApplicantsClarification {
  status: 'needs_clarification';
  reason:
    | 'no_input'
    | 'parse_empty'
    | 'applicant_not_found'
    | 'name_collision_warning';
  message: string;
  candidates?: Array<Record<string, unknown>>;
}

export type ManageApplicantsResult =
  | ManageApplicantsAddDraft
  | ManageApplicantsUpdateDraft
  | ManageApplicantsRemoveDraft
  | ManageApplicantsClarification;

interface ManageApplicantsParams {
  action: ManageApplicantsAction;
  applicants?: Array<{ full_name: string; email?: string; phone?: string; notes?: string; source?: string }>;
  applicant_id?: string;
  updates?: { full_name?: string; email?: string; phone?: string; notes?: string };
  applicant_ids?: string[];
  bulk_text?: string;
}

const UPDATABLE_FIELDS = ['full_name', 'email', 'phone', 'notes'] as const;
type UpdatableField = (typeof UPDATABLE_FIELDS)[number];

async function readApplicantWriteMode(
  supabase: SupabaseClient,
  authUserId: string,
): Promise<ApplicantWriteMode> {
  const { data } = await supabase
    .from('agent_settings')
    .select('applicant_write_mode')
    .eq('agent_id', authUserId)
    .maybeSingle();
  const mode = (data as any)?.applicant_write_mode;
  return mode === 'propose_undoable' ? 'propose_undoable' : 'always_confirm';
}

async function classifyAddCandidates(
  supabase: SupabaseClient,
  agentProfileId: string,
  raw: Array<Pick<ParsedApplicant, 'full_name'> & { email?: string | null; phone?: string | null; notes?: string | null; source?: string | null }>,
): Promise<ApplicantCandidate[]> {
  if (raw.length === 0) return [];
  const names = raw.map((r) => r.full_name.toLowerCase());
  const { data: existing } = await supabase
    .from('agent_applicants')
    .select('id, full_name, email')
    .eq('agent_id', agentProfileId)
    .in('full_name', Array.from(new Set(raw.map((r) => r.full_name))));

  // Case-insensitive lookup map
  const byLowerName = new Map<string, { id: string; full_name: string; email: string | null }>();
  for (const row of (existing as any[]) ?? []) {
    byLowerName.set(String(row.full_name).toLowerCase(), {
      id: row.id,
      full_name: row.full_name,
      email: row.email ?? null,
    });
  }
  // Second pass: also search ilike for case-insensitive matches the IN missed.
  const missingLower = raw
    .map((r) => r.full_name.toLowerCase())
    .filter((n) => !byLowerName.has(n));
  if (missingLower.length > 0) {
    for (const n of missingLower) {
      const { data: row } = await supabase
        .from('agent_applicants')
        .select('id, full_name, email')
        .eq('agent_id', agentProfileId)
        .ilike('full_name', n)
        .maybeSingle();
      if (row) {
        byLowerName.set(n, {
          id: (row as any).id,
          full_name: (row as any).full_name,
          email: (row as any).email ?? null,
        });
      }
    }
  }

  return raw.map((r) => {
    const match = byLowerName.get(r.full_name.toLowerCase()) || null;
    if (match) {
      return {
        full_name: r.full_name,
        email: r.email ?? null,
        phone: r.phone ?? null,
        notes: r.notes ?? null,
        source: r.source ?? 'intelligence',
        classification: 'duplicate_likely' as const,
        existing_match: match,
      };
    }
    return {
      full_name: r.full_name,
      email: r.email ?? null,
      phone: r.phone ?? null,
      notes: r.notes ?? null,
      source: r.source ?? 'intelligence',
      classification: 'new' as const,
    };
  });
}

function dedupeCandidates(input: Array<{ full_name: string; email?: string | null }>): typeof input {
  const seen = new Set<string>();
  const out: typeof input = [];
  for (const c of input) {
    const key = `${c.full_name.toLowerCase()}|${(c.email ?? '').toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export async function manageApplicants(
  supabase: SupabaseClient,
  _tenantId: string,
  agentContext: AgentContext,
  params: ManageApplicantsParams,
): Promise<ToolResult> {
  const action = params.action;
  const mode = await readApplicantWriteMode(supabase, agentContext.authUserId);

  if (action === 'add') {
    let candidates: Array<{ full_name: string; email?: string | null; phone?: string | null; notes?: string | null; source?: string | null }> = [];
    if (params.bulk_text && params.bulk_text.trim().length > 0) {
      const parsed = parseBulkApplicants(params.bulk_text);
      candidates = parsed.map((p) => ({ ...p, source: 'pasted' }));
    }
    if (Array.isArray(params.applicants) && params.applicants.length > 0) {
      for (const a of params.applicants) {
        const trimmed = (a.full_name || '').trim();
        if (!trimmed) continue;
        candidates.push({
          full_name: trimmed,
          email: a.email?.trim() || null,
          phone: a.phone?.trim() || null,
          notes: a.notes?.trim() || null,
          source: a.source?.trim() || 'intelligence',
        });
      }
    }
    candidates = dedupeCandidates(candidates);

    if (candidates.length === 0) {
      const result: ManageApplicantsResult = {
        status: 'needs_clarification',
        reason: params.bulk_text ? 'parse_empty' : 'no_input',
        message: params.bulk_text
          ? "I couldn't pick a name out of what you pasted. Paste it as one applicant per line."
          : 'Tell me the applicant name and I\'ll add them. You can paste a list too.',
      };
      return { data: result, summary: result.message };
    }

    const classified = await classifyAddCandidates(supabase, agentContext.agentProfileId, candidates);
    const newCount = classified.filter((c) => c.classification === 'new').length;
    const dupCount = classified.length - newCount;

    let summary: string;
    if (classified.length === 1) {
      summary = `Add ${classified[0].full_name}${classified[0].classification === 'duplicate_likely' ? ' (possible duplicate)' : ''}.`;
    } else {
      summary = `Add ${classified.length} applicants${dupCount > 0 ? `, ${dupCount} look like possible duplicates` : ''}.`;
    }

    const result: ManageApplicantsAddDraft = {
      status: 'draft',
      action: 'add',
      mode,
      candidates: classified,
      message: summary,
    };
    return { data: result, summary };
  }

  if (action === 'update') {
    if (!params.applicant_id || !params.updates) {
      const result: ManageApplicantsResult = {
        status: 'needs_clarification',
        reason: 'no_input',
        message: 'Tell me which applicant and what to change.',
      };
      return { data: result, summary: result.message };
    }
    const { data: existing } = await supabase
      .from('agent_applicants')
      .select('id, full_name, email, phone, notes')
      .eq('id', params.applicant_id)
      .eq('agent_id', agentContext.agentProfileId)
      .maybeSingle();
    if (!existing) {
      const result: ManageApplicantsResult = {
        status: 'needs_clarification',
        reason: 'applicant_not_found',
        message: "I can't find that applicant in your list.",
      };
      return { data: result, summary: result.message };
    }

    const before: Record<string, unknown> = {
      full_name: (existing as any).full_name,
      email: (existing as any).email ?? null,
      phone: (existing as any).phone ?? null,
      notes: (existing as any).notes ?? null,
    };
    const after: Record<string, unknown> = { ...before };
    const changed: string[] = [];
    for (const f of UPDATABLE_FIELDS) {
      const next = (params.updates as Record<UpdatableField, string | undefined>)[f];
      if (typeof next === 'string') {
        const trimmed = next.trim();
        const cur = (before[f] ?? null) as string | null;
        const nextVal = trimmed.length === 0 ? null : trimmed;
        if (nextVal !== cur) {
          after[f] = nextVal;
          changed.push(f);
        }
      }
    }

    if (changed.length === 0) {
      const result: ManageApplicantsResult = {
        status: 'needs_clarification',
        reason: 'no_input',
        message: "Nothing to change, those values match what's on file.",
      };
      return { data: result, summary: result.message };
    }

    const draft: ApplicantUpdateDraft = {
      applicant_id: params.applicant_id,
      full_name: (existing as any).full_name,
      before,
      after,
      changed_fields: changed,
    };
    const result: ManageApplicantsUpdateDraft = {
      status: 'draft',
      action: 'update',
      mode,
      draft,
      message: `Update ${draft.full_name} (${changed.join(', ')}).`,
    };
    return { data: result, summary: result.message };
  }

  if (action === 'remove') {
    const ids = (params.applicant_ids ?? []).filter((s) => typeof s === 'string' && s.length > 0);
    if (ids.length === 0) {
      const result: ManageApplicantsResult = {
        status: 'needs_clarification',
        reason: 'no_input',
        message: 'Which applicant should I remove?',
      };
      return { data: result, summary: result.message };
    }
    const { data: rows } = await supabase
      .from('agent_applicants')
      .select('id, full_name, email')
      .in('id', ids)
      .eq('agent_id', agentContext.agentProfileId);
    const existing = (rows as Array<{ id: string; full_name: string; email: string | null }>) ?? [];
    if (existing.length === 0) {
      const result: ManageApplicantsResult = {
        status: 'needs_clarification',
        reason: 'applicant_not_found',
        message: "I can't find any of those applicants in your list.",
      };
      return { data: result, summary: result.message };
    }

    // Surface dependency warnings: active enquiries or future viewings.
    const drafts: ApplicantRemoveDraft[] = [];
    for (const row of existing) {
      const orParts: string[] = [];
      if (row.email) orParts.push(`enquirer_email.eq.${row.email}`);
      orParts.push(`enquirer_name.ilike.${row.full_name}`);
      const { count: enquiryCount } = orParts.length
        ? await supabase
            .from('enquiries')
            .select('id', { count: 'exact', head: true })
            .eq('agent_id', agentContext.agentProfileId)
            .or(orParts.join(','))
            .not('status', 'in', '("closed","archived","completed","won","lost")')
        : { count: 0 };
      const { count: viewingCount } = await supabase
        .from('viewings')
        .select('id', { count: 'exact', head: true })
        .eq('agent_id', agentContext.authUserId)
        .eq('applicant_id', row.id)
        .gte('scheduled_at', new Date().toISOString());

      const enq = enquiryCount ?? 0;
      const vws = viewingCount ?? 0;
      const has = enq > 0 || vws > 0;
      const summaryBits: string[] = [];
      if (enq > 0) summaryBits.push(`${enq} active enquiry${enq === 1 ? '' : ' lines'}`);
      if (vws > 0) summaryBits.push(`${vws} upcoming viewing${vws === 1 ? '' : 's'}`);
      drafts.push({
        applicant_id: row.id,
        full_name: row.full_name,
        has_dependencies: has,
        dependency_summary: has ? summaryBits.join(' and ') : null,
      });
    }

    const summary =
      drafts.length === 1
        ? `Remove ${drafts[0].full_name}${drafts[0].has_dependencies ? ` (has ${drafts[0].dependency_summary})` : ''}.`
        : `Remove ${drafts.length} applicants${drafts.some((d) => d.has_dependencies) ? ' (some have active records)' : ''}.`;

    const result: ManageApplicantsRemoveDraft = {
      status: 'draft',
      action: 'remove',
      mode,
      drafts,
      message: summary,
    };
    return { data: result, summary };
  }

  // Unknown action
  const fallback: ManageApplicantsResult = {
    status: 'needs_clarification',
    reason: 'no_input',
    message: 'Add, update or remove? Tell me which.',
  };
  return { data: fallback, summary: fallback.message };
}

// -----------------------------------------------------------------------
// Confirmation + undo helpers, invoked from the API routes, not the tool.
// -----------------------------------------------------------------------

// Allowed source values per agent_applicants_source_check on the DB.
// Anything else gets normalised to 'other' before insert so the row lands
// instead of the constraint blocking it silently.
const ALLOWED_SOURCES = new Set([
  'daft',
  'myhome',
  'rent_ie',
  'facebook',
  'walk_in',
  'word_of_mouth',
  'other',
  'unknown',
]);

function normaliseSource(raw: string | null | undefined): string {
  if (!raw) return 'other';
  const lower = raw.trim().toLowerCase();
  if (ALLOWED_SOURCES.has(lower)) return lower;
  return 'other';
}

export interface ConfirmAddArgs {
  candidates: ApplicantCandidate[];
  selected_indices: number[];
}

export interface ConfirmAddResult {
  created: Array<{ id: string; full_name: string; audit_log_id: string }>;
  skipped: number;
  errors: Array<{ full_name: string; message: string }>;
}

export async function confirmApplicantAdd(
  supabase: SupabaseClient,
  agentContext: AgentContext,
  args: ConfirmAddArgs,
): Promise<ConfirmAddResult> {
  const { candidates, selected_indices } = args;
  const selectedSet = new Set(selected_indices);
  const chosen = candidates.filter((_, idx) => selectedSet.has(idx));
  const created: ConfirmAddResult['created'] = [];
  const errors: ConfirmAddResult['errors'] = [];
  console.log('[confirmApplicantAdd] start', {
    agentProfileId: agentContext.agentProfileId,
    tenantId: agentContext.tenantId,
    candidateCount: candidates.length,
    selectedCount: chosen.length,
    selectedIndices: Array.from(selectedSet.values()),
  });
  for (const c of chosen) {
    const insertRow = {
      agent_id: agentContext.agentProfileId,
      tenant_id: agentContext.tenantId,
      full_name: c.full_name,
      email: c.email,
      phone: c.phone,
      notes: c.notes,
      source: normaliseSource(c.source),
    };
    const { data, error } = await supabase
      .from('agent_applicants')
      .insert(insertRow)
      .select('id, full_name, email, phone, notes, source')
      .single();
    if (error || !data) {
      const message = error?.message || 'insert returned no row';
      console.error('[confirmApplicantAdd] insert failed', {
        full_name: c.full_name,
        error: message,
        details: error?.details,
        hint: error?.hint,
      });
      errors.push({ full_name: c.full_name, message });
      continue;
    }
    const { data: audit, error: auditError } = await supabase
      .from('applicant_audit_log')
      .insert({
        tenant_id: agentContext.tenantId,
        agent_id: agentContext.authUserId,
        applicant_id: (data as any).id,
        action: 'created',
        previous_state: null,
        new_state: data,
      })
      .select('id')
      .single();
    if (auditError) {
      console.error('[confirmApplicantAdd] audit log failed', {
        applicant_id: (data as any).id,
        error: auditError.message,
      });
    }
    created.push({
      id: (data as any).id,
      full_name: (data as any).full_name,
      audit_log_id: (audit as any)?.id ?? '',
    });
  }
  console.log('[confirmApplicantAdd] done', { created: created.length, errors: errors.length });
  return { created, skipped: candidates.length - created.length, errors };
}

export interface ConfirmUpdateArgs {
  draft: ApplicantUpdateDraft;
}

export async function confirmApplicantUpdate(
  supabase: SupabaseClient,
  agentContext: AgentContext,
  args: ConfirmUpdateArgs,
): Promise<{ id: string; full_name: string; audit_log_id: string }> {
  const { draft } = args;
  const { data: existing } = await supabase
    .from('agent_applicants')
    .select('id, full_name, email, phone, notes')
    .eq('id', draft.applicant_id)
    .eq('agent_id', agentContext.agentProfileId)
    .maybeSingle();
  if (!existing) throw new Error('Applicant not found');

  const updates: Record<string, unknown> = {};
  for (const f of draft.changed_fields) {
    updates[f] = draft.after[f];
  }
  const { data: updated, error } = await supabase
    .from('agent_applicants')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', draft.applicant_id)
    .eq('agent_id', agentContext.agentProfileId)
    .select('id, full_name, email, phone, notes')
    .single();
  if (error || !updated) throw new Error(error?.message || 'Update failed');

  const { data: audit } = await supabase
    .from('applicant_audit_log')
    .insert({
      tenant_id: agentContext.tenantId,
      agent_id: agentContext.authUserId,
      applicant_id: draft.applicant_id,
      action: 'updated',
      previous_state: existing,
      new_state: updated,
    })
    .select('id')
    .single();

  return {
    id: (updated as any).id,
    full_name: (updated as any).full_name,
    audit_log_id: (audit as any)?.id ?? '',
  };
}

export interface ConfirmRemoveArgs {
  drafts: ApplicantRemoveDraft[];
}

export interface ConfirmRemoveResult {
  removed: Array<{ id: string; full_name: string; audit_log_id: string }>;
  skipped: number;
}

export async function confirmApplicantRemove(
  supabase: SupabaseClient,
  agentContext: AgentContext,
  args: ConfirmRemoveArgs,
): Promise<ConfirmRemoveResult> {
  const { drafts } = args;
  const removed: ConfirmRemoveResult['removed'] = [];
  for (const d of drafts) {
    const { data: existing } = await supabase
      .from('agent_applicants')
      .select('id, full_name, email, phone, notes, employment_status, source, current_address, employer, annual_income, household_size, has_pets, pet_details, smoker, requested_move_in_date, budget_monthly, tenant_id, agent_id, created_at, updated_at')
      .eq('id', d.applicant_id)
      .eq('agent_id', agentContext.agentProfileId)
      .maybeSingle();
    if (!existing) continue;

    const { error } = await supabase
      .from('agent_applicants')
      .delete()
      .eq('id', d.applicant_id)
      .eq('agent_id', agentContext.agentProfileId);
    if (error) continue;

    const { data: audit } = await supabase
      .from('applicant_audit_log')
      .insert({
        tenant_id: agentContext.tenantId,
        agent_id: agentContext.authUserId,
        applicant_id: d.applicant_id,
        action: 'removed',
        previous_state: existing,
        new_state: null,
      })
      .select('id')
      .single();
    removed.push({
      id: d.applicant_id,
      full_name: (existing as any).full_name,
      audit_log_id: (audit as any)?.id ?? '',
    });
  }
  return { removed, skipped: drafts.length - removed.length };
}

const UNDO_WINDOW_MINUTES = 30;

export interface UndoResult {
  status: 'reverted' | 'expired' | 'already_undone' | 'not_found' | 'unsupported';
  message: string;
  applicant_id?: string;
  full_name?: string;
}

export async function undoApplicantAction(
  supabase: SupabaseClient,
  agentContext: AgentContext,
  audit_log_id: string,
): Promise<UndoResult> {
  const { data: row } = await supabase
    .from('applicant_audit_log')
    .select('*')
    .eq('id', audit_log_id)
    .eq('agent_id', agentContext.authUserId)
    .maybeSingle();
  if (!row) return { status: 'not_found', message: "I can't find that audit entry." };
  const r = row as any;
  if (r.undone_at) {
    return { status: 'already_undone', message: 'That action was already undone.' };
  }
  const ageMs = Date.now() - new Date(r.created_at).getTime();
  if (ageMs > UNDO_WINDOW_MINUTES * 60 * 1000) {
    return { status: 'expired', message: 'The undo window has passed for that action.' };
  }

  if (r.action === 'created') {
    // Reverse: delete the applicant we just created.
    const { error } = await supabase
      .from('agent_applicants')
      .delete()
      .eq('id', r.applicant_id)
      .eq('agent_id', agentContext.agentProfileId);
    if (error) return { status: 'unsupported', message: error.message };
  } else if (r.action === 'updated') {
    // Reverse: write previous_state back over the row.
    const prev = r.previous_state || {};
    const { error } = await supabase
      .from('agent_applicants')
      .update({
        full_name: prev.full_name,
        email: prev.email ?? null,
        phone: prev.phone ?? null,
        notes: prev.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', r.applicant_id)
      .eq('agent_id', agentContext.agentProfileId);
    if (error) return { status: 'unsupported', message: error.message };
  } else if (r.action === 'removed') {
    // Reverse: re-insert from previous_state.
    const prev = r.previous_state || {};
    const reinsert: Record<string, unknown> = {
      id: r.applicant_id,
      agent_id: agentContext.agentProfileId,
      tenant_id: agentContext.tenantId,
      full_name: prev.full_name,
      email: prev.email ?? null,
      phone: prev.phone ?? null,
      notes: prev.notes ?? null,
      employment_status: prev.employment_status ?? 'unknown',
      source: prev.source ?? 'intelligence',
    };
    if (prev.current_address) reinsert.current_address = prev.current_address;
    if (prev.employer) reinsert.employer = prev.employer;
    if (prev.annual_income !== undefined) reinsert.annual_income = prev.annual_income;
    if (prev.household_size !== undefined) reinsert.household_size = prev.household_size;
    if (prev.has_pets !== undefined) reinsert.has_pets = prev.has_pets;
    if (prev.pet_details) reinsert.pet_details = prev.pet_details;
    if (prev.smoker !== undefined) reinsert.smoker = prev.smoker;
    if (prev.requested_move_in_date) reinsert.requested_move_in_date = prev.requested_move_in_date;
    if (prev.budget_monthly !== undefined) reinsert.budget_monthly = prev.budget_monthly;
    const { error } = await supabase.from('agent_applicants').insert(reinsert);
    if (error) return { status: 'unsupported', message: error.message };
  }

  await supabase
    .from('applicant_audit_log')
    .update({ undone_at: new Date().toISOString() })
    .eq('id', audit_log_id);

  return {
    status: 'reverted',
    message: 'Reverted.',
    applicant_id: r.applicant_id,
    full_name: r.previous_state?.full_name ?? r.new_state?.full_name,
  };
}
