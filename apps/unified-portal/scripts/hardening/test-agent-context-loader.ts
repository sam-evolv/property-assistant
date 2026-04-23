/**
 * Session 14.2 — Agent context loader smoke test.
 *
 * Background: preview regression where `resolveAgentContext` silently
 * returned zero assigned schemes for Orla, who has five active
 * assignments in the database. Every read tool then replied "Assigned:
 * (none)" against every query. Root cause was `fetchAssignments`
 * swallowing Supabase errors — the query errored, we returned `[]`,
 * nothing reached logs.
 *
 * This smoke test pins the single source of truth: for a known agent
 * profile id, `resolveAgentContext` MUST return the expected
 * assignedDevelopmentIds. If the list is empty, short, or mismatched,
 * something between the profile id and the assignments table broke —
 * which is exactly the class of bug Session 6A first fixed and Session
 * 14 re-surfaced.
 *
 * Usage:
 *   ORLA_AGENT_PROFILE_ID=<uuid> npx tsx scripts/hardening/test-agent-context-loader.ts
 *
 * Environment:
 *   NEXT_PUBLIC_SUPABASE_URL       — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY      — service-role key (RLS bypass)
 *   ORLA_AGENT_PROFILE_ID          — optional override; defaults to the
 *                                    production Orla profile id
 *   ORLA_EXPECTED_SCHEME_COUNT     — optional override; defaults to 5
 */

import { createClient } from '@supabase/supabase-js';
import { resolveAgentContext } from '../../lib/agent-intelligence/agent-context';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function check(name: string, passed: boolean, message: string) {
  results.push({ name, passed, message });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env. Cannot run smoke test.',
  );
  process.exit(2);
}

// Defaults match production Orla — override with env when running
// against a different environment / seeded agent.
const AGENT_PROFILE_ID =
  process.env.ORLA_AGENT_PROFILE_ID || '0f9210e0-342d-4f98-9be1-95decb6f507a';
const EXPECTED_COUNT = Number(process.env.ORLA_EXPECTED_SCHEME_COUNT ?? '5');

const supabase = createClient(url, serviceKey);

async function main() {
  // Look up Orla's auth user_id by profile id so resolveAgentContext's
  // primary lookup path runs exactly the way the chat route runs it.
  const { data: profile, error: profileErr } = await supabase
    .from('agent_profiles')
    .select('id, user_id, display_name')
    .eq('id', AGENT_PROFILE_ID)
    .maybeSingle();

  check(
    'agent profile row exists',
    !profileErr && !!profile,
    profileErr ? `error: ${profileErr.message}` : profile ? `display_name=${profile.display_name}` : 'no row',
  );

  if (!profile) {
    finish();
    return;
  }

  const resolved = await resolveAgentContext(supabase as any, profile.user_id);

  check(
    'resolveAgentContext returned non-null',
    resolved !== null,
    resolved ? 'ok' : 'returned null',
  );

  if (!resolved) {
    finish();
    return;
  }

  check(
    'agentProfileId matches input',
    resolved.agentProfileId === AGENT_PROFILE_ID,
    `expected ${AGENT_PROFILE_ID}, got ${resolved.agentProfileId}`,
  );

  // Session 14.3 — authUserId must be a DIFFERENT id than agentProfileId.
  // That's the whole point of the brand. If they're equal, the resolver
  // is returning the profile id in the auth slot (regression vector).
  check(
    'authUserId field populated',
    typeof resolved.authUserId === 'string' && resolved.authUserId.length > 0,
    `authUserId="${resolved.authUserId}"`,
  );
  check(
    'authUserId distinct from agentProfileId',
    resolved.authUserId !== resolved.agentProfileId,
    `authUserId=${resolved.authUserId}, agentProfileId=${resolved.agentProfileId}`,
  );
  check(
    'authUserId matches profile.user_id',
    resolved.authUserId === profile.user_id,
    `expected ${profile.user_id}, got ${resolved.authUserId}`,
  );

  check(
    `assignedDevelopmentIds.length === ${EXPECTED_COUNT}`,
    resolved.assignedDevelopmentIds.length === EXPECTED_COUNT,
    `got ${resolved.assignedDevelopmentIds.length} (${resolved.assignedDevelopmentIds.join(', ')})`,
  );

  check(
    'assignedDevelopmentNames has matching length',
    resolved.assignedDevelopmentNames.length === resolved.assignedDevelopmentIds.length,
    `ids=${resolved.assignedDevelopmentIds.length}, names=${resolved.assignedDevelopmentNames.length}`,
  );

  // Cross-check against the raw table — the fix only sticks if the loader
  // agrees with what a plain SQL query says.
  const { data: rows, error: rowsErr } = await supabase
    .from('agent_scheme_assignments')
    .select('development_id')
    .eq('agent_id', AGENT_PROFILE_ID)
    .eq('is_active', true);

  const rawIds = new Set((rows ?? []).map((r: any) => r.development_id));
  check(
    'raw SQL count matches resolver count',
    !rowsErr && rawIds.size === resolved.assignedDevelopmentIds.length,
    rowsErr
      ? `sql error: ${rowsErr.message}`
      : `raw=${rawIds.size}, resolver=${resolved.assignedDevelopmentIds.length}`,
  );

  const resolverIds = new Set(resolved.assignedDevelopmentIds);
  const missingFromResolver = [...rawIds].filter((id) => !resolverIds.has(id));
  const extraInResolver = [...resolverIds].filter((id) => !rawIds.has(id));
  check(
    'resolver set matches raw set',
    missingFromResolver.length === 0 && extraInResolver.length === 0,
    `missing=${missingFromResolver.length}, extra=${extraInResolver.length}`,
  );

  finish();
}

function finish() {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\nAgent context loader smoke test\n');
  for (const r of results) {
    const mark = r.passed ? '  PASS' : '  FAIL';
    console.log(`${mark}  ${r.name}  —  ${r.message}`);
  }
  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    console.error(
      'Agent context loader has regressed. Read-side tools will reply "Assigned: (none)". See SESSION_14_2_DIAGNOSIS.md.',
    );
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Smoke test threw:', err?.message || err);
  process.exit(2);
});
