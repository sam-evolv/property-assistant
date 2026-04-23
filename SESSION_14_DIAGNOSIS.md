# Session 14 Diagnosis — read-side skills still substitute the wrong unit

## Bug A — the "Unit 3 is actually Unit 10" lie

Reproduction (live preview): agent typed "What's the status of Unit 3 in Árdan
View?" after an earlier refusal on "Erdon View". The model called
`get_unit_status({ scheme_name: "Árdan View", unit_identifier: "3" })` and the
tool returned **Unit 10 (Carmen Baumgartner)**. The model then relayed that as
authoritative: "Unit 3 in Árdan View is Unit 10, under contract with Carmen
Baumgartner, kitchen selected…".

Root cause in `lib/agent-intelligence/tools/read-tools.ts`:

```ts
// read-tools.ts:25-31 — getUnitStatus
const { data: units } = await supabase
  .from('units')
  .select('id, unit_uid, unit_number, house_type_code, …')
  .eq('tenant_id', tenantId)
  .eq('development_id', dev.id)
  .or(`unit_number.ilike.%${params.unit_identifier}%,unit_uid.ilike.%${params.unit_identifier}%`);
// …
const unit = units[0];
```

The query stored `unit_number` as bare "3" but we searched with
`unit_number.ilike.%3%`. The PostgREST `or` clause accepts the LHS fine, but
`unit_uid.ilike.%3%` also matches `AV-10`, `AV-13`, `AV-30`, `AV-31`, `AV-23`.
With no `.limit(1).order(…)` or exact filter, PostgREST returns multiple rows
and `units[0]` is whichever happens to be first by internal order — in the
Árdan View data that's **Unit 10**. The tool then calls that "the answer".

The model has no way to know the lookup was wrong. Its response ("Unit 3 is
actually Unit 10…") is grammatical nonsense but carries real data — a real
buyer name, real kitchen status. That's a trust violation of the worst kind:
a stated fact that happens to be false but reads as confident and sourced.

Session 9 shipped `lib/agent-intelligence/unit-resolver.ts` exactly to stop
this pattern. Write-side skills (`draftBuyerFollowups`, `draftMessageSkill`
after Session 13.2) use it. Read-side skills were never migrated.

## Bug B — no yes/no clarification on the most obvious typo

"Reach out to number 3, Erdon View" now (Session 13.2) triggers a refusal
because `resolveSchemeName` returns `not_found`. The chat route surfaces the
refusal verbatim and issues follow-up chips, but the chips re-issue the
failed action instead of asking the clarifying question a human colleague
would: "Did you mean Árdan View?".

`scheme-resolver.ts` already has `suggestClosestScheme` via Levenshtein, but
it's not wired into a yes/no flow. The alias capture from Session 13 (which
self-heals future typos) fires only when the user happens to retype the right
name in their next turn — the UX equivalent of "didn't you hear me the first
time?".

## Skill audit — which skills use strict resolution vs bespoke fuzz

Every skill in the registry that takes a `unit_identifier`, `scheme_name`, or
similar field. `strict` = uses `resolveSchemeName` / `resolveUnitIdentifier`.
`bespoke` = uses `ilike %X%` / `matchAssignedScheme` / ad-hoc.

| Skill | Resolution | Status |
|---|---|---|
| `get_unit_status` (read-tools.ts:5) | bespoke: `.ilike('name', '%X%')` + `.or('unit_number.ilike.%X%,unit_uid.ilike.%X%')`, silent `units[0]` pick | **FIX** — this is the Bug A leak |
| `get_buyer_details` (read-tools.ts:108) | fuzzy on `purchaser_name ilike %X%` — expected behaviour for buyer search, no scheme/unit resolution | out of scope |
| `get_scheme_overview` (read-tools.ts:213) | `matchAssignedScheme` substring then `.ilike('name', '%X%')` fallback | **FIX** — same substring leak class |
| `get_scheme_summary` (read-tools.ts:663) | `matchAssignedScheme` substring | **FIX** |
| `get_outstanding_items` (read-tools.ts:332) | `.ilike('name', '%X%').limit(1)` | **FIX** |
| `get_communication_history` (read-tools.ts:487) | `.ilike('name', '%X%')` scheme + `.or('unit_number.ilike.%X%')` unit | **FIX** |
| `get_viewings` (read-tools.ts:556) | `.ilike('scheme_name', '%X%')` against `agent_viewings.scheme_name` (a free-text column on a viewings table — not a development FK) | keep ilike but note risk — not a resolver bug, it's filtering a string column. Left as-is. |
| `log_communication` (write-tools.ts) | bespoke — same pattern | **FIX** (covered below) |
| `search_knowledge_base` | vector search, no unit/scheme resolution | n/a |
| `schedule_viewing_draft` (agentic-skills.ts:850ish) | bespoke: `.ilike('name', '%X%')` scheme + `.or('unit_number.ilike.X,unit_uid.ilike.%X%')` unit, silent `[0]` | **FIX** |
| `chase_aged_contracts` (agentic-skills.ts:72) | `scheme_filter` applied as JS substring filter post-query; no silent wrong-match (filters OUT, doesn't pick arbitrary in) | low priority — left as-is. Worst case is zero drafts, which the 13.2 guard catches. |
| `draft_viewing_followup` (agentic-skills.ts) | scopes to agent's viewings, no scheme parameter | n/a |
| `weekly_monday_briefing` | no scheme parameter | n/a |
| `draft_lease_renewal` | takes tenancy_id, not scheme | n/a |
| `natural_query` (agentic-skills.ts:686) | `.ilike('tenant_name', '%X%')` for tenant — that's a name search, expected | out of scope |
| `draft_message` (agentic-skills.ts:1049) | strict resolver (Session 13.2) | ok |
| `draft_buyer_followups` (agentic-skills.ts:1394) | strict resolver (Session 9) | ok |
| `get_candidate_units` | lists by intent, no user-supplied identifier | n/a |
| `create_task`, `generate_developer_report` | no unit/scheme ref to resolve | n/a |

Six read-side skills + one write-side (`log_communication`) + one agentic
(`schedule_viewing_draft`) need migrating to the strict resolver pair.

## Where the chat route currently surfaces "did you mean?"

It doesn't — not as an interactive flow. It surfaces `not_found` reasons
verbatim (Session 13.2 injection) and logs the failed alias via
`captureInferredAlias` on the next turn IF the user happens to retype the
right name. The route has no `pending_clarification` state. The conversation
state is just the `history` array passed in by the client.

Adding a yes/no hook needs one of:
1. Server-side per-session state (new table or in-memory cache keyed by
   `sessionId`) — durable across page refresh but costs a round-trip.
2. Piggyback on the assistant message content so the NEXT user turn's
   `history` carries the pending clarification. The chat route inspects
   the last assistant turn for a specific marker string.

Option 2 wins — zero new tables, zero TTL management, survives hot reload.
The marker is a JSON blob embedded in a `<!--PENDING_CLARIFICATION:…-->`
comment at the end of the assistant message. The server parses it on the
next turn, the client renders the visible part only. Expiry is structural:
if it's not in the LAST assistant turn, it's gone.

## Chat model is gpt-4o-mini — cannot be trusted to refuse

`intelligence_interactions.model_used = 'gpt-4o-mini'`. Mini weaves real
fragments into invented claims (the "Unit 3 is Unit 10" pattern is
characteristic). The system prompt already forbids fabrication, but on mini
that's a strong suggestion, not a guarantee. The fix has to block the bad
data at the tool layer — if the tool returns a wrong row, the model WILL
relay it.

Session 14 therefore layers:
1. Strict resolver on every read-side skill → tool returns `null + reason`
   on no match, NEVER a silent first row.
2. System prompt extension → "null from a read tool means say 'I couldn't
   find that', not 'Unit 3 is actually Unit 10'".
3. Yes/no disambiguation → when exactly one scheme is within Levenshtein
   3 of the typed scheme, ask instead of refusing.

## Fix summary shipping with this commit

1. **read-tools.ts** — `getUnitStatus`, `getSchemeOverview`,
   `getSchemeSummary`, `getOutstandingItems`, `getCommunicationHistory`
   rewritten to call `resolveSchemeName` and `resolveUnitIdentifier`. On
   any non-ok outcome, return
   `{ data: null, summary: '<reason>', error: 'not_found'|'ambiguous'|'not_assigned' }`.
   The model reads `data === null` as "no result" and must say so.

2. **write-tools.ts** — `logCommunication` migrated the same way.

3. **agentic-skills.ts** — `scheduleViewingDraft` scheme + unit resolution
   migrated. On non-ok: returns envelope with empty drafts + skipped reason
   (matches the Session 13.2 contract).

4. **scheme-resolver.ts** — `SchemeResolution` for `not_found` now carries
   a `top_candidate?: { name: string; developmentId: string; distance: number }`
   field. Populated when exactly one assigned scheme is within Levenshtein
   distance ≤ 3 of the normalised input AND no other assigned scheme is
   within that distance.

5. **chat/route.ts** — new `pending_clarification` plumbing:
   - On this turn, if any envelope has `meta.top_candidate`, the final
     assistant message is replaced with "Did you mean **Árdan View**? (yes/no)"
     and a hidden `<!--PENDING_CLARIFICATION:{"originalMessage":"…","topCandidateName":"…","topCandidateDevId":"…"}-->`
     marker is appended.
   - On the NEXT turn, before running tools, the route reads the last
     assistant message from `history`. If it carries the marker AND the
     user's message matches `/^(yes|y|yeah|yep|correct|that's it|aye)\b/i`:
     substitute `topCandidateName` for the original scheme name in the
     original message and re-run. Also call `captureInferredAlias`
     (originalInput → topCandidateDevId) so future Erdon View resolves
     automatically.
   - On any other reply, the marker is discarded and the fresh message
     runs normally.

6. **system-prompt.ts** — new paragraph under ABSOLUTE RULES forbidding
   substitution of data from a different unit when the requested unit
   doesn't exist. Explicit reference to "Unit 3 is actually Unit 10" as
   the forbidden pattern.

## Acceptance matrix the repro tests pin

| Input | Expected |
|---|---|
| "What's the status of Unit 3 in Árdan View?" | Real Unit 3 (Foley family). Not Unit 10. |
| "What's the status of Unit 99 in Árdan View?" | "Unit 99 doesn't exist in Árdan View." No substitution. |
| "Reach out to number 3, Erdon View" | "Did you mean Árdan View? (yes/no)" |
| Reply "yes" | Drafts Foley-family email. New row in `development_aliases` with `alias='Erdon View'` `source='inferred'`. |
| Reply "no" | "Got it. Your assigned schemes are: …". No draft. Marker cleared. |

## Out of scope

- Whisper prompt biasing
- Send-memory (Session 10 deferred)
- Buyer-name fuzzy search in `get_buyer_details` — legitimate partial-match
- `agent_viewings.scheme_name` filtering — filtering a free-text string, not
  resolving a development
- `chase_aged_contracts` `scheme_filter` — post-query JS filter, cannot
  silently substitute
