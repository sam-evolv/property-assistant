/**
 * Session 14.3 — branded identifier types.
 *
 * Three regressions (Session 6A → 14 → 14.2) boiled down to the same
 * class of bug: `auth.uid()` (a Supabase auth UUID) got passed where
 * `agent_profiles.id` (a separate UUID) was required. `agent_scheme_assignments.agent_id`
 * references `agent_profiles.id`; querying it with an auth UID produces
 * a clean zero-row result, which downstream code translated as "this
 * agent has no schemes". Both identifiers are UUIDs, so a plain `string`
 * type can't tell them apart.
 *
 * Branded types make the compiler enforce the distinction. At runtime
 * they are still strings — zero cost — but a `string` cannot be assigned
 * to an `AgentProfileId` parameter without going through one of the
 * constructor helpers below. That one-line lookup makes the identifier's
 * provenance explicit at every call site.
 *
 * Constructor convention:
 *   - `asAgentProfileId(raw)` — the caller has proved via context this
 *     string came from `agent_profiles.id`. Trusted cast.
 *   - `asAuthUserId(raw)` — ditto for `auth.users.id`.
 *   - `lookupAgentProfileId(supabase, authUserId)` — does the DB round-
 *     trip that converts an auth UID into a profile id. The only way to
 *     produce an `AgentProfileId` from an `AuthUserId` at runtime.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type AgentProfileId = string & { readonly __brand: 'AgentProfileId' };
export type AuthUserId = string & { readonly __brand: 'AuthUserId' };

/**
 * Trusted cast — tag a string you already know is an `agent_profiles.id`.
 * Use only where the surrounding code proves the provenance (e.g. an
 * `agent_profiles.id` column just read out of the DB).
 */
export function asAgentProfileId(s: string): AgentProfileId {
  return s as AgentProfileId;
}

/**
 * Trusted cast — tag a string you already know is an `auth.users.id`.
 * Use only where the surrounding code proves the provenance (e.g.
 * `supabase.auth.getUser()` output).
 */
export function asAuthUserId(s: string): AuthUserId {
  return s as AuthUserId;
}

/**
 * Resolve an auth user id to its agent_profiles.id. This is the DB
 * round-trip that converts one identifier class to the other — the
 * only function in the codebase allowed to promote an `AuthUserId`
 * into an `AgentProfileId` without an explicit trusted cast.
 *
 * Returns null when no profile row matches. Caller must handle that
 * before passing the result anywhere.
 */
export async function lookupAgentProfileId(
  supabase: SupabaseClient,
  authUserId: AuthUserId,
): Promise<AgentProfileId | null> {
  const { data, error } = await supabase
    .from('agent_profiles')
    .select('id')
    .eq('user_id', authUserId)
    .maybeSingle();
  if (error) {
    console.error('[ids] lookupAgentProfileId error', {
      authUserId,
      code: error.code,
      message: error.message,
    });
    return null;
  }
  return data?.id ? (data.id as AgentProfileId) : null;
}
