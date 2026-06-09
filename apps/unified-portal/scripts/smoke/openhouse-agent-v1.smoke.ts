/**
 * OpenHouse Assistant v1 — smoke test (Sprint 2).
 *
 * Plain TypeScript, no test runner. Mocks the OpenAI client (no network, no API
 * key) and exercises callAgent() against eight calibration cases, asserting both
 * the parsed response and the request wiring (model, json_schema, the v1 system
 * prompt, the USER TYPE tag, image inputs, prior-message replay, and that
 * houseContext is threaded into the system messages).
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
import { sendMultimodal } from '../../lib/assistant/multimodal-client';

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

// Extract the prior turns the service inserted between the system messages and
// the final (current) user message, and assert they match the expected history
// in order. The last non-system message is the current turn.
function assertPriorMessages(
  calls: Array<Record<string, any>>,
  expected: Array<{ role: string; content: string }>,
): void {
  const messages = calls[0]?.messages ?? [];
  const nonSystem = messages.filter((m: any) => m?.role !== 'system');
  const history = nonSystem.slice(0, -1);
  check(
    `history carries ${expected.length} prior message(s)`,
    history.length === expected.length,
    `got ${history.length}`,
  );
  for (let i = 0; i < expected.length; i++) {
    check(
      `history[${i}] role is ${expected[i].role}`,
      history[i]?.role === expected[i].role,
      String(history[i]?.role),
    );
    check(
      `history[${i}] content matches`,
      history[i]?.content === expected[i].content,
      String(history[i]?.content),
    );
  }
  const current = nonSystem[nonSystem.length - 1];
  check('current user turn is last', current?.role === 'user', String(current?.role));
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

  // --- Case 6: text-only request (no images), a recipe question ---
  // The agent path now answers text-only turns. Expect a message, no issue, no
  // image block, and (since none was passed) no prior messages in the request.
  {
    console.log('Case 6: homeowner — text-only "what can I batch cook on Sunday?"');
    const canned: OpenhouseAgentResult = {
      message:
        'A big pot of chilli stretches across the week and freezes well. Want a version that reheats without drying out?',
      issue_report: null,
    };
    const { client, calls } = mockClient(canned);
    const result = await callAgent(
      { userType: 'homeowner', text: 'what can I batch cook on Sunday?', images: [] },
      { client },
    );
    check('message is populated', result.message.length > 0);
    check('no issue_report', result.issue_report == null, JSON.stringify(result.issue_report));
    assertWiring(calls, 'HOMEOWNER', false);
    assertPriorMessages(calls, []);
  }

  // --- Case 7: multi-turn — two prior exchanges replayed before the new turn ---
  // Expect callAgent to build the messages array with the full history in order,
  // between the system messages and the current user message.
  {
    console.log('Case 7: homeowner — multi-turn, prior history replayed in order');
    const priorMessages = [
      { role: 'user' as const, content: 'one of my radiators is cold at the top' },
      {
        role: 'assistant' as const,
        content:
          'Sounds like trapped air. You can bleed it with a radiator key. Want me to talk you through it?',
      },
      { role: 'user' as const, content: 'yes please' },
      {
        role: 'assistant' as const,
        content:
          'Turn the heating off, hold a cloth under the valve, and turn the key a quarter until the hissing stops and water appears.',
      },
    ];
    const canned: OpenhouseAgentResult = {
      message:
        'Same trick on the other one. If it stays cold after bleeding, the balancing might need a look. Did water come out when you bled the first one?',
      issue_report: null,
    };
    const { client, calls } = mockClient(canned);
    const result = await callAgent(
      {
        userType: 'homeowner',
        text: 'the other one is cold too now',
        images: [],
        priorMessages,
      },
      { client },
    );
    check('message is populated', result.message.length > 0);
    assertPriorMessages(calls, priorMessages);
    const messages = calls[0]?.messages ?? [];
    const nonSystem = messages.filter((m: any) => m?.role !== 'system');
    const current = nonSystem[nonSystem.length - 1];
    const currentText = Array.isArray(current?.content)
      ? current.content.map((p: any) => p?.text ?? '').join(' ')
      : String(current?.content ?? '');
    check(
      'current user message carries the new text',
      currentText.includes('the other one is cold too now'),
      currentText,
    );
  }

  // --- Case 8: issue-creation bias — text-only leak description, no photo ---
  // "I think the radiator is leaking" (hedged, no image). Expect issue_report to
  // come back populated (v1.1 biases toward logging tentative defect language).
  {
    console.log('Case 8: homeowner — text-only "I think the radiator is leaking"');
    const canned: OpenhouseAgentResult = {
      message:
        "I've logged that for the site team to take a look. In the meantime put a towel down and check whether the water is at the valve or the body of the radiator. Can you see where it's wet?",
      issue_report: {
        title: 'Investigate reported radiator leak',
        area: 'living room',
        severity: 'moderate',
        category: 'plumbing',
        description: 'Homeowner reports a suspected leak from a radiator. No photo provided.',
        status: 'open',
      },
    };
    const { client, calls } = mockClient(canned);
    const result = await callAgent(
      { userType: 'homeowner', text: 'I think the radiator is leaking', images: [] },
      { client },
    );
    check('message is populated', result.message.length > 0);
    check('issue_report is populated', result.issue_report != null);
    check(
      'category is plumbing',
      result.issue_report?.category === 'plumbing',
      result.issue_report?.category,
    );
    assertWiring(calls, 'HOMEOWNER', false);
  }

  // --- Case 9: text-only routing (bug 1) ---
  // Unit test of the routing logic: with no attachments, sendMultimodal must
  // skip the media-upload step and POST to /api/assistant/chat/multimodal with
  // empty media_ids — i.e. a text-only turn reaches the agent route, not the RAG
  // /api/chat endpoint. PurchaserChatTab takes this path when the agent flag is
  // on (isOpenhouseAgentV1Enabled); the React component's flag branch itself is
  // not unit-testable here, so this validates the routing target + the empty-
  // media contract that the relaxed route guard depends on.
  {
    console.log('Case 9: text-only routing — sendMultimodal skips upload, posts to the multimodal route');
    const calls: Array<{ url: string; body: any }> = [];
    const originalFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = async (url: any, init: any) => {
      let body: any = null;
      try {
        body = init?.body ? JSON.parse(init.body) : null;
      } catch {
        body = init?.body ?? null;
      }
      calls.push({ url: String(url), body });
      return {
        ok: true,
        json: async () => ({
          message: 'Your main stopcock is usually under the kitchen sink.',
          analysis_id: null,
          action: 'answer_only',
          message_id: 'mid-1',
          conversation_id: 'conv-1',
        }),
      };
    };
    try {
      const result = await sendMultimodal({
        conversationId: 'conv-1',
        unitId: 'unit-1',
        qrToken: 'qr-token',
        messageText: 'How do I shut off the water?',
        selections: [],
      });
      check('exactly one fetch call (upload step skipped)', calls.length === 1, `got ${calls.length}`);
      check(
        'posts to the multimodal agent route',
        calls.some((c) => c.url.includes('/api/assistant/chat/multimodal')),
        calls.map((c) => c.url).join(', '),
      );
      check(
        'never calls the media-upload endpoint',
        !calls.some((c) => c.url.includes('/api/assistant/media/upload')),
        'upload endpoint was hit',
      );
      check(
        'never calls the RAG /api/chat endpoint',
        !calls.some((c) => c.url.endsWith('/api/chat')),
        '/api/chat was hit',
      );
      const body = calls[0]?.body;
      check(
        'media_ids sent as empty array',
        Array.isArray(body?.media_ids) && body.media_ids.length === 0,
        JSON.stringify(body?.media_ids),
      );
      check('assistant message returned', result.assistantMessage.length > 0, result.assistantMessage);
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  }

  // --- Case 10: clarify-before-logging (prompt v1.3) ---
  // Ambiguous defect ("there's a crack in one of the rooms upstairs", no photo).
  // Expect clarification_question populated and issue_report null — the agent
  // asks the one decisive question instead of filing a vague ticket. The route
  // maps this to the existing 'ask_for_more_info' action and persists nothing.
  {
    console.log('Case 10: homeowner — ambiguous crack, agent asks one clarifying question');
    const canned: OpenhouseAgentResult = {
      message:
        "Happy to get that looked at properly. Which room is it in, and is the crack hairline or wider — say more than a few millimetres?",
      issue_report: null,
      clarification_question: 'Which room is the crack in, and is it hairline or wider than ~3mm?',
    };
    const { client, calls } = mockClient(canned);
    const result = await callAgent(
      { userType: 'homeowner', text: "there's a crack in one of the rooms upstairs", images: [] },
      { client },
    );
    check('message is populated', result.message.length > 0);
    check('no issue_report on the clarification turn', result.issue_report == null, JSON.stringify(result.issue_report));
    check(
      'clarification_question is populated',
      typeof result.clarification_question === 'string' && result.clarification_question.length > 0,
      JSON.stringify(result.clarification_question),
    );
    assertWiring(calls, 'HOMEOWNER', false);
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
