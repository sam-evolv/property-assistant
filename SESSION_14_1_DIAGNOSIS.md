# Session 14.1 Diagnosis — over-defensive prompt made the model stop calling tools

## What happened on preview

Three queries all returned "doesn't exist" responses WITHOUT any tool call:

| Query | Model said | `intelligence_interactions.tools_called` |
|---|---|---|
| "What's the status of Unit 3 in Árdan View?" | "No units in Árdan View with the identifier 'Unit 3.'" | `[]` |
| "What's outstanding on Unit 99 in Árdan View?" | "No units in Árdan View with the identifier 'Unit 99.'" | `[]` |
| "Reach out to number 3, Erdon View. Ask if they've picked their kitchen" | "No units in Erdon View with the identifier 'Unit 3.'" | `[]` |

Database reality (verified via Supabase MCP):

- Unit 3 in Árdan View: `id=37e08366-…`, `unit_uid=AV-003-CFA4`, purchaser
  "Robert and Cordelia Foley" — **exists**.
- Unit 99 in Árdan View: `id=3ac10562-…`, `unit_uid=AV-099-4146`, purchaser
  "Rebecca Burke and Craig O'Callaghan" — **exists**.
- "Erdon View": alias DOES resolve via Levenshtein 2 neighbour. Should
  surface `top_candidate = Árdan View` → "Did you mean Árdan View?".

Tools were NOT called. Empty array. The model never consulted the database.

## Resolver isolation check

Resolver logic is fine. Verified:

- `development_aliases` has canonical `ardan view` and phonetic seeds
  `adan`, `addon`, `arden`, `ardawn`, `ardhan`, `adden`, `add-on`. No
  `erdon` seed — so `resolveSchemeName('Erdon View')` falls through the
  alias lookup, the substring fallback fails (`erdon view` ∉ any assigned
  scheme name), and the `not_found` branch computes
  `findUniqueTopCandidate` on `erdon view` against `ardan view`. Edit
  distance is 2 (positions 0 and 3). 2 ≤ TOP_CANDIDATE_MAX_DISTANCE (3).
  Only Árdan View is inside the radius → `top_candidate` is populated.
- `resolveUnitIdentifier('3', developmentIds: [ardan_view_id])` runs an
  exact `unit_number = '3'` match. The row exists. Returns `ok`.

Session 9/14's resolver code is correct. The data is correct. The skills
still never run because **the model doesn't call the tool in the first place**.

## Root cause — cumulative defensive prompt pressure

`system-prompt.ts` places this block FIRST, at the top of `basePrompt`:

```
ABSOLUTE RULES — NEVER VIOLATE THESE UNDER ANY CIRCUMSTANCES:
1. NEVER state that a communication happened…
2. NEVER invent dates, phone calls, emails…
3. If a tool returns no data or empty results, say so clearly.
4. Distinguish between what the DATA shows and what you are SUGGESTING.
5. NEVER fabricate buyer names, unit numbers, dates, prices…
6. If a tool search returns no match for a buyer or unit, say exactly that.
7. NEVER substitute data from a different unit when the requested unit
   doesn't exist. When a read tool (get_unit_status, …) returns `data:
   null` or any summary containing "doesn't exist" / "couldn't find" /
   "not in your assigned", you MUST tell the user that exact fact. You
   MUST NOT say "Unit 3 is actually Unit 10"… If asked about a unit that
   doesn't exist, the truthful answer is that it doesn't exist, followed
   by the assigned scheme list if you have it. Never "helpfully" surface
   data from an adjacent unit number.
```

Rule 7 is what Session 14 added. It's correct when a tool HAS been called
and returned null. Read as a standalone directive by a small model,
though, it's easily compressed to: "if unsure about a unit, say it
doesn't exist." That's the opposite of the intended "verify before
answering" stance.

Permission to call tools appears 16 lines later:

```
(A) READ tools — retrieve information. You may call these freely.
```

"May call freely" is permissive, not mandatory. It does not out-weigh
seven numbered ABSOLUTE RULES introduced with "NEVER VIOLATE THESE UNDER
ANY CIRCUMSTANCES." On gpt-4o-mini the emotional weighting is
unmistakable — the negative block is 7 rules of capitalised "NEVER" and
"MUST NOT", the positive block is one casual sentence.

Empirically gpt-4o-mini becomes tool-shy when a prompt stacks
consequences of tool misuse without equal weight on consequences of
non-use. We triggered that pattern.

Knock-on: the yes/no disambiguation hook from Session 14 is gated on an
envelope surfacing `top_candidate`. An envelope requires a tool call. No
tool call → no envelope → no disambiguation prompt. The whole feature is
dead code until the model starts calling tools again.

## Why Session 13's repro ("Erdon View") worked then but not now

Session 13.2's repro pre-dates Rule 7. At that point the model was calling
`draft_message`, getting a placeholder draft persisted, and the 13.2 fix
blocked the placeholder at persistence. The model WAS calling the tool.

Session 14 added Rule 7. After that, on the repro turn the model evaluated
"Erdon View" against its own knowledge, decided it didn't know Erdon View,
applied Rule 7's "if it doesn't exist, say so" logic, and skipped the
tool call entirely. We removed the ability of the defence-in-depth
persistence guard from 13.2 to fire — because the skill is never invoked.

## Fix plan

### Fix 1 — Positive mandate, placed above the defensive rules

A new block `TOOL-USE MANDATE — READ BEFORE YOU ANSWER`, placed before
ABSOLUTE RULES, carrying the same capitalised weight. Key language:

- "You MUST call a read tool whenever the user asks about a specific
  unit, scheme, buyer, or property."
- "You MUST NOT answer from your own assumptions about which units
  exist."
- "Refusing to call a read tool when the user asks for unit/scheme
  information is a SEVERE failure — equivalent to fabricating data."
- "The ABSOLUTE RULES below apply AFTER the tool result comes back. They
  are NOT permission to skip the tool call."
- Specific worked example: "User asks about Unit 3 in Árdan View → call
  `get_unit_status`. Do NOT decide from memory whether Unit 3 exists."

This rebalances the prompt. The negative rules are still correct; the
positive rule gives them context.

### Fix 2 — Verify disambiguation fires once tools are back

Once Fix 1 unsticks tool-calling, "Reach out to number 3, Erdon View"
should call `draft_message`, which already (Session 14) threads
`top_candidate` through `meta.top_candidate`. The chat route
(`pickSingleTopCandidate` → bypass LLM → emit marker) is already wired.
No code change expected. If the end-to-end trace still fails, the bug
will be in one of:

- Skill doesn't thread top_candidate — check `draftMessageSkill` at
  `agentic-skills.ts:1135-1144` (threading exists post-14).
- Chat route doesn't pick it up — check
  `pickSingleTopCandidate` in `chat/route.ts` (exists post-14).
- Marker round-trips broken — check `extractPendingClarification` on
  next turn (exists post-14).

Nothing obviously broken in the code. The fix is to unstick the upstream
tool call.

### Fix 3 — Smoke test against the regression

Add an integration-style script that:

1. Instantiates an OpenAI mock (or hits the real endpoint with a stubbed
   model response) threaded through the chat route's tool-call loop.
2. Sends "What's the status of Unit 3 in Árdan View?" as a test user
   with a context that mirrors Orla's (assigned to Árdan View and
   Tullamore Manor).
3. Asserts that the tool-calling loop produces at least one tool call
   with `name === 'get_unit_status'` AND `params.unit_identifier === '3'`.

Because the real chat route calls OpenAI at runtime, the test has two
viable shapes:

(a) **Snapshot of the non-tool-call branch**: inspect system prompt
string for the new `TOOL-USE MANDATE` block. Cheap; deterministic;
catches accidental deletion of the mandate.

(b) **End-to-end against a real model**: requires API key + rate budget.
Too expensive for CI.

We ship (a). A unit-level assertion on the prompt text is the best
we get without paying for a real model invocation per run. If the
mandate string is removed or weakened, the test fails.

## Out of scope

- Whisper / voice
- Send-memory (Session 10)
- `tesseract.js` build blocker (pre-existing)
- Rewriting the resolver (no bug there)
- OpenAI model upgrade (gpt-4o-mini is a cost constraint, not a bug)
