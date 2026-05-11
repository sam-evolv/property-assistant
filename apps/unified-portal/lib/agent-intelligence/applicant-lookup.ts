import { SupabaseClient } from '@supabase/supabase-js';
import { resolveApplicantByName, type ApplicantResolution } from './viewing-resolver';

/**
 * Shared applicant-by-name lookup used by every scheduling tool that needs
 * to resolve a free-form name into an agent_applicants row. Both
 * create_viewing (single) and schedule_viewings (composite) go through this
 * so the two flows can never diverge again — see bug log for the
 * "no scheme provided" regression that caused the single-viewing tool to
 * dead-end on applicant_not_found while the composite tool correctly
 * treated the same name as a new applicant.
 */
export async function findApplicantByName(
  supabase: SupabaseClient,
  agentProfileId: string,
  name: string,
): Promise<ApplicantResolution> {
  return resolveApplicantByName(supabase, agentProfileId, name);
}

export type { ApplicantResolution } from './viewing-resolver';
