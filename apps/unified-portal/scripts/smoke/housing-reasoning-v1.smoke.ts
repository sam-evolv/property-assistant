/**
 * Housing Reasoning v0.1 — smoke test (Sprint 1b).
 *
 * Plain TypeScript, no test runner. Mocks the OpenAI client (no network, no API
 * key) and exercises analyseMessage() against three calibration cases, asserting
 * the structured response and the request wiring (model, json_schema, the v0.1
 * system prompt, the USER TYPE tag, and image inputs).
 *
 * Run:
 *   npx tsx apps/unified-portal/scripts/smoke/housing-reasoning-v1.smoke.ts
 *
 * Exit 0 = all cases pass. Exit 1 = a case failed.
 *
 * Real-photo smoke testing (live OpenAI) is a separate ticket; this file never
 * calls the real API.
 */

import type OpenAI from 'openai';
import { analyseMessage } from '../../lib/housing-reasoning/v1/service';
import type { HousingReasoningResult } from '../../lib/housing-reasoning/v1/types';

let failures = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// A mock OpenAI client that returns canned JSON and records the request it was
// given, so we can assert both the parsed result and the wiring.
function mockClient(canned: HousingReasoningResult): {
  client: OpenAI;
  calls: Array<Record<string, any>>;
} {
  const calls: Array<Record<string, any>> = [];
  const client = {
    chat: {
      completions: {
        create: async (args: Record<string, any>) => {
          calls.push(args);
          return { choices: [{ message: { content: JSON.stringify(canned) } }] };
        },
      },
    },
  } as unknown as OpenAI;
  return { client, calls };
}

function assertWiring(
  calls: Array<Record<string, any>>,
  expectedUserTag: string,
  expectImages: boolean,
): void {
  const req = calls[0];
  check('one OpenAI call made', calls.length === 1, `got ${calls.length}`);
  check('model is gpt-4o', req?.model === 'gpt-4o', String(req?.model));
  check(
    'response_format is json_schema',
    req?.response_format?.type === 'json_schema',
    String(req?.response_format?.type),
  );
  const messages = req?.messages ?? [];
  const systemPrompt = messages[0]?.content ?? '';
  check(
    'v0.1 system prompt is sent verbatim',
    typeof systemPrompt === 'string' &&
      systemPrompt.startsWith('You are the OpenHouse property assistant.'),
  );
  check(
    `USER TYPE tag is "${expectedUserTag}"`,
    messages[1]?.content === `USER TYPE: ${expectedUserTag}`,
    String(messages[1]?.content),
  );
  const userParts = Array.isArray(messages[2]?.content) ? messages[2].content : [];
  const hasImage = userParts.some((p: any) => p?.type === 'image_url');
  check(
    expectImages ? 'user message includes an image_url block' : 'user message has no image block',
    hasImage === expectImages,
  );
}

async function run(): Promise<void> {
  // --- Case 1: homeowner asks "is this normal?" about a hairline crack ---
  // Expect ANSWER_ONLY, no issue report.
  {
    console.log('Case 1: homeowner — "is this normal?" (hairline crack)');
    const canned: HousingReasoningResult = {
      action: 'ANSWER_ONLY',
      message:
        "Hairline crack above the door frame. Normal settlement in a new-build during the first year.",
      issue_report: null,
    };
    const { client, calls } = mockClient(canned);
    const result = await analyseMessage(
      { userType: 'homeowner', text: 'is this normal?', images: ['https://signed.example/crack.jpg'] },
      { client },
    );
    check('action is ANSWER_ONLY', result.action === 'ANSWER_ONLY', result.action);
    check('no issue_report', result.issue_report === null);
    assertWiring(calls, 'HOMEOWNER', true);
  }

  // --- Case 2: snagger "touch up paint at hall reveal" ---
  // Expect CREATE_ISSUE_REPORT, category cosmetic, severity minor.
  {
    console.log('Case 2: site team — "touch up paint at hall reveal"');
    const canned: HousingReasoningResult = {
      action: 'CREATE_ISSUE_REPORT',
      message: 'Logged a touch-up for the site team.',
      issue_report: {
        title: 'Touch up paint at hall reveal',
        area: 'hall',
        severity: 'minor',
        category: 'cosmetic',
        description: 'Paint touch-up required at the hall reveal.',
        status: 'open',
      },
    };
    const { client, calls } = mockClient(canned);
    const result = await analyseMessage(
      { userType: 'site_team', text: 'touch up paint at hall reveal', images: [] },
      { client },
    );
    check('action is CREATE_ISSUE_REPORT', result.action === 'CREATE_ISSUE_REPORT', result.action);
    check(
      'category is cosmetic',
      result.issue_report?.category === 'cosmetic',
      result.issue_report?.category,
    );
    check('severity is minor', result.issue_report?.severity === 'minor', result.issue_report?.severity);
    assertWiring(calls, 'SITE TEAM', false);
  }

  // --- Case 3: snagger "exposed wiring across utility floor, make safe" ---
  // Expect CREATE_ISSUE_REPORT, severity major.
  {
    console.log('Case 3: site team — "exposed wiring across utility floor, make safe"');
    const canned: HousingReasoningResult = {
      action: 'CREATE_ISSUE_REPORT',
      message: 'Logged for the site team to make safe.',
      issue_report: {
        title: 'Make safe exposed wiring in utility',
        area: 'utility',
        severity: 'major',
        category: 'electrical',
        description: 'Exposed wiring across the utility floor. Make safe.',
        status: 'open',
      },
    };
    const { client, calls } = mockClient(canned);
    const result = await analyseMessage(
      {
        userType: 'site_team',
        text: 'exposed wiring across utility floor, make safe',
        images: ['https://signed.example/utility.jpg'],
      },
      { client },
    );
    check('action is CREATE_ISSUE_REPORT', result.action === 'CREATE_ISSUE_REPORT', result.action);
    check('severity is major', result.issue_report?.severity === 'major', result.issue_report?.severity);
    assertWiring(calls, 'SITE TEAM', true);
  }

  console.log('');
  if (failures > 0) {
    console.log(`SMOKE FAILED — ${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log('SMOKE PASSED — all cases green.');
  process.exit(0);
}

run().catch((err) => {
  console.error('SMOKE ERRORED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
