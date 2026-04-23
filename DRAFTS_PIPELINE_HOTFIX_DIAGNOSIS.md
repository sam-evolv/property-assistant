# Drafts Pipeline Hotfix Diagnosis (Session 6D Hotfix)

## Root cause

The new `draft_buyer_followups` tool added in commit `8332a82` declares
`targets` as `type: 'array'` with no `items` schema. OpenAI's function-calling
JSON Schema validator rejects this with a 400 before any tool is invoked, so
the entire chat completion fails.

## Six-bullet diagnosis

1. **OpenAI 400 signature.** The chat route hits
   `openai.chat.completions.create({ tools, tool_choice: 'auto', ... })` on
   `route.ts:199`. When any tool in the passed-in array has an invalid
   JSON Schema, OpenAI returns 400 with a body like
   `"Invalid schema for function 'draft_buyer_followups': In context=()... 'items' is a required property"`.
   Our route catches the exception and returns a generic 500 — so the
   surface-level symptom hides the schema error.

2. **Malformed tool — `draft_buyer_followups`.**
   `lib/agent-intelligence/tools/registry.ts:247-250`:
   ```ts
   targets: {
     type: 'array',
     description: 'Units to draft emails for. Each item must reference a unit (and optionally the scheme / recipient name).',
   }
   ```
   OpenAI's schema (JSON Schema draft-07) requires any `array` type to
   declare an `items` sub-schema. Without `items` the validator 400s.
   Every other tool in the registry only uses `string`, `number`, or
   `object` leaf types, so this is the only offender.

3. **Type system hid the bug at compile time.** The `ToolDefinition`
   type in `lib/agent-intelligence/types.ts:49-53` typed
   `properties: Record<string, { type: string; description: string; enum?: string[] }>`
   — no `items`, no nested `properties`. Adding an `items` schema
   inline would have been rejected by `tsc`, which is why I shipped the
   array without one. The type was too narrow from the start; tightening
   it now without the full shape only pushes the bug to runtime.

4. **No duplicate `draft_message`.** Grepping the registry turns up
   exactly one `name: 'draft_message'` (line 223). The old
   `write-tools.draftMessage` was removed in the same commit. Not the
   cause.

5. **System prompt length unchanged.** The new drafting-behaviour section
   replaces the old one rather than appending. Prompt token count is
   roughly flat. Not the cause.

6. **All other tools pass validation.** Every other tool in
   `AGENT_TOOL_DEFINITIONS` has either primitive leaves or an `object`
   with explicit `properties`. `chase_aged_contracts`, `draft_message`
   (agentic), `schedule_viewing_draft`, etc. — all fine.

## Fix

- Widen `ToolDefinition.parameters.properties` to allow `items` (with a
  recursive sub-schema) and nested `properties` for object-typed fields.
- Add the missing `items` schema to `targets`: each item is an object
  with `unit_identifier` (required string), `scheme_name` (optional),
  `recipient_name` (optional).
- Keep every other part of Session 6D — anti-hallucination guard,
  envelope merging, `override` SSE frame, new skills — untouched.

Regression guard: the 6D test file already exercises `draftBuyerFollowups`
at runtime. A new assertion verifies every registered tool with
`type: 'array'` fields declares `items`, so this exact shape can't ship
again.
