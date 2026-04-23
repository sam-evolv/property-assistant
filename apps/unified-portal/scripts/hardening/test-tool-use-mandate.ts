/**
 * Session 14.1 — Tool-use mandate smoke test.
 *
 * Background: the preview deployment regressed when the cumulative
 * defensive system prompt (Sessions 13, 13.2, 14) made the model
 * refuse to call read tools. Queries like "What's the status of Unit 3
 * in Árdan View?" returned "doesn't exist" without any tool call,
 * even though the unit existed and the resolver was correct.
 *
 * The fix was a new `TOOL-USE MANDATE` block at the top of the system
 * prompt, above the ABSOLUTE RULES. This smoke test asserts that the
 * block still exists and contains the non-negotiable language. If
 * someone re-orders the prompt or deletes the mandate, this test
 * catches it before it ships.
 *
 * Why prompt-string assertion instead of end-to-end: hitting the
 * chat route with a real OpenAI invocation per CI run is expensive
 * and flaky. A prompt-string regression IS the regression — the model
 * behaviour is downstream of the prompt. Catching prompt drift is the
 * highest-leverage check.
 *
 * Usage:
 *   npx tsx scripts/hardening/test-tool-use-mandate.ts
 */

import { buildAgentSystemPrompt } from '../../lib/agent-intelligence/system-prompt';
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

// Orla's real agent shape — assigned to two developments, same as
// production. Keeps the generated prompt as close to the live one as
// we can get without mocking resolveAgentContext.
const ORLA_CONTEXT: AgentContext = {
  agentId: 'agent-orla',
  userId: 'user-orla',
  tenantId: 'tenant-openhouse',
  displayName: 'Orla Flynn',
  agencyName: 'OpenHouse Estates',
  agentType: 'scheme',
  assignedSchemes: [
    { developmentId: 'dev-ardan', schemeName: 'Árdan View', unitCount: 100 },
    { developmentId: 'dev-tullamore', schemeName: 'Tullamore Manor', unitCount: 40 },
  ],
  assignedDevelopmentIds: ['dev-ardan', 'dev-tullamore'],
  assignedDevelopmentNames: ['Árdan View', 'Tullamore Manor'],
  activeDevelopmentId: null,
};

const prompt = buildAgentSystemPrompt(
  ORLA_CONTEXT,
  'mock recent activity',
  'mock deadlines',
  '',
  '',
  undefined,
  'mock viewings summary',
  'mock live context',
);

// --- Mandate block is present and placed BEFORE the ABSOLUTE RULES ---

const mandateHeader = 'TOOL-USE MANDATE — READ BEFORE YOU ANSWER';
const mandateIndex = prompt.indexOf(mandateHeader);
const absoluteRulesHeader = 'ABSOLUTE RULES — NEVER VIOLATE';
const absoluteIndex = prompt.indexOf(absoluteRulesHeader);

check(
  'mandate block exists in prompt',
  mandateIndex !== -1,
  mandateIndex === -1
    ? `'${mandateHeader}' missing from system prompt`
    : `found at character ${mandateIndex}`,
);

check(
  'mandate placed before ABSOLUTE RULES',
  mandateIndex !== -1 && absoluteIndex !== -1 && mandateIndex < absoluteIndex,
  mandateIndex === -1 || absoluteIndex === -1
    ? 'one or both headers missing'
    : mandateIndex < absoluteIndex
      ? `mandate at ${mandateIndex}, rules at ${absoluteIndex}`
      : `mandate at ${mandateIndex} is AFTER rules at ${absoluteIndex} — weight inverted`,
);

// --- Specific non-negotiable phrases must appear verbatim ---

const requiredPhrases: Array<{ label: string; snippet: string }> = [
  {
    label: 'MUST call a read tool',
    snippet: 'MUST call a read tool',
  },
  {
    label: 'get_unit_status named as example',
    snippet: 'get_unit_status',
  },
  {
    label: 'Refusing tool-call language',
    snippet: 'Refusing to call a read tool',
  },
  {
    label: 'Severe failure framing',
    snippet: 'SEVERE failure',
  },
  {
    label: 'ABSOLUTE RULES apply AFTER language',
    snippet: 'apply AFTER the tool result',
  },
  {
    label: 'Worked example — Unit 3 Árdan View',
    snippet: 'Unit 3 in Árdan View',
  },
  {
    label: 'Worked example — Erdon View typo',
    snippet: 'Erdon View',
  },
];

for (const { label, snippet } of requiredPhrases) {
  check(
    label,
    prompt.includes(snippet),
    prompt.includes(snippet) ? `ok` : `missing: "${snippet}"`,
  );
}

// --- Summary + exit code ---

const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;

console.log('\nTool-use mandate smoke test\n');
for (const r of results) {
  const mark = r.passed ? '  PASS' : '  FAIL';
  console.log(`${mark}  ${r.name}  —  ${r.message}`);
}
console.log(`\n${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.error(
    'Tool-use mandate has regressed. The model will stop calling read tools. See SESSION_14_1_DIAGNOSIS.md.',
  );
  process.exit(1);
}
process.exit(0);
