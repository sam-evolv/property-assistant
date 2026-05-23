/**
 * OpenHouse Assistant v1 — smoke test (Sprint 2).
 *
 * Plain TypeScript, no test runner. Mocks the OpenAI client (no network, no API
 * key) and exercises callAgent() against five calibration cases, asserting both
 * the parsed response and the request wiring (model, json_schema, the v1 system
 * prompt, the USER TYPE tag, image inputs, and that houseContext is threaded
 * into the system messages).
 *
 * Run:
 *   npx tsx apps/unified-portal/scripts/smoke/openhouse-agent-v1.smoke.ts
 *
 * Exit 0 = all cases pass. Exit 1 = a case failed.
 *
 * Real-photo smoke testing (live OpenAI) is a separate ticket; this file never
 * calls the real API.
 */

import type OpenAI from 'openai';
import { callAgent } from '../../lib/openhouse-agent/v1/service';
import type {
  OpenhouseAgentResult,
  OpenhouseAgentHouseContext,
} from '../../lib/openhouse-agent/v1/types';

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
function mockClient(canned: OpenhouseAgentResult): {
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
    'response_format is openhouse_assistant_v1 json_schema',
    req?.response_format?.type === 'json_schema' &&
      req?.response_format?.json_schema?.name === 'openhouse_assistant_v1',
    String(req?.response_format?.json_schema?.name),
  );
  const messages = req?.messages ?? [];
  const systemPrompt = messages[0]?.content ?? '';
  check(
    'v1 system prompt is sent verbatim',
    typeof systemPrompt === 'string' &&
      systemPrompt.startsWith('You are the OpenHouse Assistant,'),
  );
  check(
    `USER TYPE tag is "${expectedUserTag}"`,
    messages[1]?.content === `USER TYPE: ${expectedUserTag}`,
    String(messages[1]?.content),
  );
  const userMsg = messages.find((m: any) => m?.role === 'user');
  const userParts = Array.isArray(userMsg?.content) ? userMsg.content : [];
  const hasImage = userParts.some((p: any) => p?.type === 'image_url');
  check(
    expectImages ? 'user message includes an image_url block' : 'user message has no image block',
    hasImage === expectImages,
  );
}

// Assert each needle appears somewhere in the system messages, proving the
// service threaded houseContext (and any other system content) into the call.
function assertHouseContextSent(calls: Array<Record<string, any>>, needles: string[]): void {
  const messages = calls[0]?.messages ?? [];
  const systemBlob = messages
    .filter((m: any) => m?.role === 'system')
    .map((m: any) => (typeof m.content === 'string' ? m.content : ''))
    .join('\n');
  for (const needle of needles) {
    check(`house context carries "${needle}"`, systemBlob.includes(needle), 'not in system messages');
  }
}

async function run(): Promise<void> {
  // --- Case 1: photo of the fridge + "what can I make with this" ---
  // General help. Expect a message, no issue report.
  {
    console.log('Case 1: homeowner — fridge photo + "what can I make with this"');
    const canned: OpenhouseAgentResult = {
      message:
        "Looks like you've got the makings of a carbonara there. Want the proportions for two?",
      issue_report: null,
    };
    const { client, calls } = mockClient(canned);
    const result = await callAgent(
      {
        userType: 'homeowner',
        text: 'what can I make with this',
        images: ['https://signed.example/fridge.jpg'],
      },
      { client },
    );
    check('message is populated', result.message.length > 0);
    check('no issue_report', result.issue_report == null, JSON.stringify(result.issue_report));
    assertWiring(calls, 'HOMEOWNER', true);
  }

  // --- Case 2: "How do I shut off the water?" (text only) ---
  // Practical help. Expect a message, no issue report.
  {
    console.log('Case 2: homeowner — "How do I shut off the water?"');
    const canned: OpenhouseAgentResult = {
      message:
        'Your main stopcock is usually under the kitchen sink. Turn it clockwise to shut off the water. Want me to talk you through finding it?',
      issue_report: null,
    };
    const { client, calls } = mockClient(canned);
    const result = await callAgent(
      { userType: 'homeowner', text: 'How do I shut off the water?', images: [] },
      { client },
    );
    check('message is populated', result.message.length > 0);
    check('no issue_report', result.issue_report == null, JSON.stringify(result.issue_report));
    assertWiring(calls, 'HOMEOWNER', false);
  }

  // --- Case 3: photo of a leak under the sink + "this is leaking" ---
  // Real defect. Expect a message AND a populated issue_report (major, plumbing).
  {
    console.log('Case 3: homeowner — leak photo + "this is leaking"');
    const canned: OpenhouseAgentResult = {
      message:
        "That's an active leak at the trap under the sink. I'll log this for the site team to take a look. In the meantime put a bowl under it and shut the isolation valve if you can reach it.",
      issue_report: {
        title: 'Investigate active leak under kitchen sink',
        area: 'kitchen',
        severity: 'major',
        category: 'plumbing',
        description: 'Active water leak at the waste trap under the kitchen sink, reported by homeowner.',
        status: 'open',
      },
    };
    const { client, calls } = mockClient(canned);
    const result = await callAgent(
      {
        userType: 'homeowner',
        text: 'this is leaking',
        images: ['https://signed.example/leak.jpg'],
      },
      { client },
    );
    check('message is populated', result.message.length > 0);
    check('issue_report is populated', result.issue_report != null);
    check('severity is major', result.issue_report?.severity === 'major', result.issue_report?.severity);
    check(
      'category is plumbing',
      result.issue_report?.category === 'plumbing',
      result.issue_report?.category,
    );
    assertWiring(calls, 'HOMEOWNER', true);
  }

  // --- Case 4: "What size is my dinette?" with dimensions in houseContext ---
  // House-context reasoning. Expect a message that uses the dimensions, no issue
  // report, and the dimensions threaded into the system messages.
  {
    console.log('Case 4: homeowner — "What size is my dinette?" (uses houseContext)');
    const houseContext: OpenhouseAgentHouseContext = {
      developmentId: 'dev-1111',
      unitId: 'unit-2222',
      rooms: [
        { name: 'dinette', dimensions: '2.4m x 3.1m' },
        { name: 'living room', dimensions: '4.2m x 5.0m' },
      ],
    };
    const canned: OpenhouseAgentResult = {
      message:
        'Your dinette is 2.4m by 3.1m, so a touch over 7 square metres. Plenty for a four-seater table. Want me to suggest a layout?',
      issue_report: null,
    };
    const { client, calls } = mockClient(canned);
    const result = await callAgent(
      { userType: 'homeowner', text: 'What size is my dinette?', images: [], houseContext },
      { client },
    );
    check('message is populated', result.message.length > 0);
    check('message uses the dinette dimensions', result.message.includes('2.4m'), result.message);
    check('no issue_report', result.issue_report == null, JSON.stringify(result.issue_report));
    assertWiring(calls, 'HOMEOWNER', false);
    assertHouseContextSent(calls, ['dinette', '2.4m x 3.1m']);
  }

  // --- Case 5: "How do I change this lightbulb" + photo of a downlight ---
  // DIY guidance. Expect a message, no issue report.
  {
    console.log('Case 5: homeowner — "How do I change this lightbulb" + downlight photo');
    const canned: OpenhouseAgentResult = {
      message:
        "That's a recessed LED downlight. Most twist out anti-clockwise from the trim ring, but some are sealed units. Send a closer photo of the edge and I'll tell you which type you've got.",
      issue_report: null,
    };
    const { client, calls } = mockClient(canned);
    const result = await callAgent(
      {
        userType: 'homeowner',
        text: 'How do I change this lightbulb',
        images: ['https://signed.example/downlight.jpg'],
      },
      { client },
    );
    check('message is populated', result.message.length > 0);
    check('no issue_report', result.issue_report == null, JSON.stringify(result.issue_report));
    assertWiring(calls, 'HOMEOWNER', true);
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
