/**
 * Housing Reasoning v0.1 — multimodal media analysis service (Sprint 1b).
 *
 * Source of truth for the prompt and behavioural contract:
 *   docs/prompts/housing-reasoning-v1.md
 *
 * Calls OpenAI gpt-4o with the locked v0.1 prompt and a strict json_schema
 * response_format. This matches the existing OpenAI vision pattern in
 * packages/api/src/extractors/vision.ts and the structured-output pattern in
 * packages/api/src/train/floorplan-vision.ts. Single provider, no Anthropic.
 *
 * This module is PURE. It does not touch the database, storage, or the HTTP
 * request. Image loading (signed URLs from assistant_media) and the mapping to
 * the existing issue_reports shape both live at the route boundary
 * (app/api/assistant/chat/multimodal/route.ts), not here.
 *
 * Gated behind FEATURE_HOUSING_REASONING_V1 (isHousingReasoningV1Enabled() in
 * lib/feature-flags.ts). The flag is read per-request in the route handler.
 *
 * SMOKE TEST (mocked OpenAI client — no network, no API key):
 *   npx tsx apps/unified-portal/scripts/smoke/housing-reasoning-v1.smoke.ts
 *   Exit 0 = all pass, exit 1 = a case failed.
 *
 * ROLLBACK PLAN:
 *   Set FEATURE_HOUSING_REASONING_V1=false in Vercel and redeploy. Because the
 *   flag is read per-request, the next request falls back to the unchanged
 *   placeholder mediaAnalysisService. No code revert is required.
 */

import OpenAI from 'openai';
import { HOUSING_REASONING_V1_PROMPT } from './prompt';
import type { AnalyseMessageInput, HousingReasoningResult } from './types';

const MODEL = 'gpt-4o';

// Strict JSON schema. Mirrors the types in types.ts so the model output is
// shaped correctly without free-form parsing. issue_report is nullable for
// ANSWER_ONLY (and any case where no issue is logged).
const RESULT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ['ANSWER_ONLY', 'CREATE_ISSUE_REPORT', 'ESCALATE_IMMEDIATELY', 'REFER_TO_WARRANTY'],
    },
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
  required: ['action', 'message', 'issue_report'],
  additionalProperties: false,
};

export interface AnalyseMessageOptions {
  /** Inject a client for tests. Defaults to a real OpenAI client. */
  client?: OpenAI;
}

export async function analyseMessage(
  input: AnalyseMessageInput,
  options: AnalyseMessageOptions = {},
): Promise<HousingReasoningResult> {
  const client = options.client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // The v0.1 prompt references a "system tag" telling it which user type it is
  // speaking to. We supply it as a second system message rather than editing
  // the locked prompt body.
  const userTypeTag = input.userType === 'site_team' ? 'SITE TEAM' : 'HOMEOWNER';

  const imageBlocks: OpenAI.Chat.Completions.ChatCompletionContentPart[] = input.images.map(
    (url) => ({
      type: 'image_url',
      image_url: { url, detail: 'high' },
    }),
  );

  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    ...imageBlocks,
    { type: 'text', text: input.text?.trim() || '(no text provided)' },
  ];

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: HOUSING_REASONING_V1_PROMPT },
      { role: 'system', content: `USER TYPE: ${userTypeTag}` },
      { role: 'user', content: userContent },
    ],
    max_tokens: 1500,
    temperature: 0.2,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'housing_reasoning_v1',
        strict: true,
        schema: RESULT_JSON_SCHEMA,
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('[housing-reasoning-v1] OpenAI returned no content');
  }

  const parsed = JSON.parse(content) as HousingReasoningResult;
  // Attach token usage for analytics. Not part of the model JSON; comes from
  // response.usage (absent when the client is mocked, hence the ?? null).
  parsed.usage = {
    input_tokens: response.usage?.prompt_tokens ?? null,
    output_tokens: response.usage?.completion_tokens ?? null,
  };
  return parsed;
}
