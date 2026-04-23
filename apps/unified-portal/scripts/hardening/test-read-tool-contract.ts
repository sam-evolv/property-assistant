/**
 * Session 14.3 — read-tool contract smoke test.
 *
 * The test that would have caught "Árdan View is not in your assigned
 * schemes. Assigned: (none)." at commit time.
 *
 * Constructs a real `AgentContext` for Orla via `resolveAgentContext`,
 * then invokes `getUnitStatus` directly against that context. Asserts:
 *   - The result is not null.
 *   - `result_summary` / `result.data` contains the real purchaser for
 *     Unit 3 in Árdan View (Foley family).
 *   - `result_summary` does NOT contain "Assigned: (none)" or
 *     "not in your assigned schemes".
 *
 * Runs end-to-end against live Supabase. Required env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ORLA_AGENT_PROFILE_ID  (default: production Orla)
 *
 * Usage:
 *   npx tsx scripts/hardening/test-read-tool-contract.ts
 */

import { createClient } from '@supabase/supabase-js';
import { resolveAgentContext } from '../../lib/agent-intelligence/agent-context';
import { getUnitStatus } from '../../lib/agent-intelligence/tools/read-tools';
import type { AgentContext } from '../../lib/agent-intelligence/types';

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

const AGENT_PROFILE_ID =
  process.env.ORLA_AGENT_PROFILE_ID || '0f9210e0-342d-4f98-9be1-95decb6f507a';

const supabase = createClient(url, serviceKey);

async function main() {
  // Look up Orla's auth user_id so we can call resolveAgentContext the
  // same way the chat route does.
  const { data: profile } = await supabase
    .from('agent_profiles')
    .select('id, user_id, tenant_id, display_name')
    .eq('id', AGENT_PROFILE_ID)
    .maybeSingle();

  check(
    'agent profile row exists',
    !!profile,
    profile ? `display_name=${profile.display_name}` : 'no row',
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
    'assignedDevelopmentIds is non-empty',
    resolved.assignedDevelopmentIds.length > 0,
    `got ${resolved.assignedDevelopmentIds.length}`,
  );

  // Build the AgentContext shape the tool expects.
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
  };

  const result = await getUnitStatus(
    supabase as any,
    resolved.tenantId ?? '',
    agentContext,
    { scheme_name: 'Árdan View', unit_identifier: '3' },
  );

  // Summary must come from real data — not the "(none)" branch.
  const summary = typeof result.summary === 'string' ? result.summary : '';
  check(
    'summary is not the "(none)" bail',
    !/Assigned:\s*\(none\)/.test(summary) && !/not in your assigned schemes/i.test(summary),
    `summary="${summary}"`,
  );

  check(
    'result.data is non-null (real row returned)',
    result.data !== null && result.data !== undefined,
    result.data ? 'data populated' : `data=${result.data}, summary="${summary}"`,
  );

  // The Foley family is Orla's Unit 3 purchaser in the seeded DB. Any
  // other name means we returned the wrong unit — the exact Bug A
  // symptom Session 14 was supposed to eliminate.
  const buyerName =
    (result.data && typeof result.data === 'object' && (result.data as any).buyer?.name) || '';
  check(
    'Unit 3 buyer name contains "Foley"',
    /Foley/i.test(buyerName),
    `buyer.name="${buyerName}"`,
  );

  // Unit number on the result should be "3" (or unit_uid AV-003-…).
  const unitNumber =
    (result.data && typeof result.data === 'object' && (result.data as any).unit_number) || '';
  check(
    'Unit number is "3" or AV-003-*',
    unitNumber === '3' || /^AV-003/.test(unitNumber),
    `unit_number="${unitNumber}"`,
  );

  finish();
}

function finish() {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\nRead-tool contract smoke test\n');
  for (const r of results) {
    const mark = r.passed ? '  PASS' : '  FAIL';
    console.log(`${mark}  ${r.name}  —  ${r.message}`);
  }
  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    console.error(
      'Read-tool contract regressed. See SESSION_14_3_DIAGNOSIS.md.',
    );
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Smoke test threw:', err?.message || err);
  process.exit(2);
});
