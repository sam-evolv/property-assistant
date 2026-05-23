/**
 * OpenHouse Assistant v1 — general home agent service (Sprint 2).
 *
 * Source of truth for the prompt and behavioural contract:
 *   docs/prompts/openhouse-assistant-v1.md
 *
 * Calls OpenAI gpt-4o with the locked v1 prompt and a strict json_schema
 * response_format. Same OpenAI SDK pattern as the housing-reasoning service
 * (lib/housing-reasoning/v1/service.ts): single provider, no Anthropic,
 * injectable client for tests.
 *
 * This module is PURE. It does not touch the database, storage, or the HTTP
 * request. Image loading (signed URLs from assistant_media) and voice-note
 * transcription both happen UPSTREAM at the route boundary; this service
 * receives ready image URLs and a ready transcript string. Transcription
 * reuses lib/agent-intelligence/transcription.ts (the existing OpenHouse Agent
 * Deepgram->Whisper helper), so no audio bytes reach this module and no new
 * dependency is added. The mapping to the existing issue_reports shape also
 * lives at the route boundary, not here.
 *
 * Gated behind FEATURE_OPENHOUSE_AGENT_V1 (isOpenhouseAgentV1Enabled() in
 * lib/feature-flags.ts). The flag is read per-request in the route handler.
 *
 * SMOKE TEST (mocked OpenAI client — no network, no API key):
 *   npx tsx apps/unified-portal/scripts/smoke/openhouse-agent-v1.smoke.ts
 *   Exit 0 = all pass, exit 1 = a case failed.
 *
 * ROLLBACK PLAN:
 *   - Roll back the new agent only:
 *       FEATURE_OPENHOUSE_AGENT_V1=false  (or unset) in Vercel, redeploy.
 *       Because the flag is read per-request, the route falls back to the
 *       housing-reasoning-v1 path, still flag-gated on
 *       FEATURE_HOUSING_REASONING_V1. No code revert required.
 *   - Roll back both paths:
 *       Unset BOTH FEATURE_OPENHOUSE_AGENT_V1 and FEATURE_HOUSING_REASONING_V1.
 *       The route runs the unchanged Sprint 1 placeholder mediaAnalysisService.
 */

import OpenAI from 'openai';
import { OPENHOUSE_AGENT_V1_PROMPT } from './prompt';
import type { CallAgentInput, OpenhouseAgentResult } from './types';

const MODEL = 'gpt-4o';

// Strict JSON schema. Mirrors types.ts so the model output is shaped correctly
// without free-form parsing. issue_report is required-but-nullable (null for an
// ordinary chat turn, populated only when something should be logged). The
// severity and category enums match the housing-reasoning enums verbatim.
const RESULT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    issue_report: {
      type: ['object', 'null'],
      properties: {
        title: { type: 'string' },
        area: { type: ['string', 'null'] },
        severity: { type: 'string', enum: ['minor', 'moderate', 'major'] },
        category: {
          type: 'string',
          enum: [
            'cosmetic',
            'cleaning',
            'joinery',
            'plumbing',
            'electrical',
            'external',
            'landscape',
            'compliance',
            'appliance',
            'other',
          ],
        },
        description: { type: 'string' },
        status: { type: 'string', enum: ['open', 'closed'] },
      },
      required: ['title', 'area', 'severity', 'category', 'description', 'status'],
      additionalProperties: false,
    },
  },
  required: ['message', 'issue_report'],
  additionalProperties: false,
};

export interface CallAgentOptions {
  /** Inject a client for tests. Defaults to a real OpenAI client. */
  client?: OpenAI;
}

export async function callAgent(
  input: CallAgentInput,
  options: CallAgentOptions = {},
): Promise<OpenhouseAgentResult> {
  const client = options.client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // The prompt references which user type it is speaking to. Supplied as a
  // second system message rather than editing the locked prompt body, matching
  // the housing-reasoning service.
  const userTypeTag = input.userType === 'site_team' ? 'SITE TEAM' : 'HOMEOWNER';

  const imageBlocks: OpenAI.Chat.Completions.ChatCompletionContentPart[] = input.images.map(
    (url) => ({
      type: 'image_url',
      image_url: { url, detail: 'high' },
    }),
  );

  // Voice notes arrive already transcribed (see types.ts). The prompt is told
  // it "reads transcripts of voice notes", so we surface the transcript as a
  // labelled text part alongside the typed text.
  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [...imageBlocks];
  const transcript = input.audio?.trim();
  if (transcript) {
    userContent.push({ type: 'text', text: `Voice note transcript: ${transcript}` });
  }
  userContent.push({ type: 'text', text: input.text?.trim() || '(no text provided)' });

  // House context is real data the agent should reason against (dimensions,
  // floor plan, snag history). Supplied as a system message so the prompt's
  // "USE WHAT YOU HAVE" instruction has something to use. Omitted entirely when
  // the route has nothing to pass, so the model is never handed an empty shell.
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: OPENHOUSE_AGENT_V1_PROMPT },
    { role: 'system', content: `USER TYPE: ${userTypeTag}` },
  ];
  if (input.houseContext && Object.keys(input.houseContext).length > 0) {
    messages.push({
      role: 'system',
      content: `HOUSE CONTEXT (JSON — this homeowner's specific home):\n${JSON.stringify(
        input.houseContext,
      )}`,
    });
  }
  messages.push({ role: 'user', content: userContent });

  const response = await client.chat.completions.create({
    model: MODEL,
    messages,
    max_tokens: 1500,
    temperature: 0.4,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'openhouse_assistant_v1',
        strict: true,
        schema: RESULT_JSON_SCHEMA,
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('[openhouse-agent-v1] OpenAI returned no content');
  }

  const parsed = JSON.parse(content) as OpenhouseAgentResult;
  // Attach token usage for analytics. Not part of the model JSON; comes from
  // response.usage (absent when the client is mocked, hence the ?? null).
  parsed.usage = {
    input_tokens: response.usage?.prompt_tokens ?? null,
    output_tokens: response.usage?.completion_tokens ?? null,
  };
  return parsed;
}
