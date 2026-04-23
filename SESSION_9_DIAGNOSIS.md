# Session 9 Diagnosis — intent-aware resolution + identifier bug

Main still sits at Session 7 (commit `f70af6d`); Session 8's `purpose`
parameter, joint-purchaser parsing and hardened unit resolution never
landed. Session 9 picks up all three bugs on top of the Session 8 skill
surface, so this commit carries the Session 8 additions through as well
as the Session 9 fixes.

## Bug A — Clarification ignores intent

**Where.** `lib/agent-intelligence/system-prompt.ts` only instructs
Intelligence to ask "Which N units?" when a count is specified without
unit identifiers. It does not constrain the candidate set by the intent
of the request. There is no tool the model can call to get "units that
have actually been handed over" as a filtered candidate list, so when
the model generates an example set it picks the first three unit numbers
by incidence ("Unit 1, Unit 2, Unit 3") regardless of handover status.

**Why it's failing.** No `get_candidate_units(intent='handover')` tool
exists. The clarification is text-level only; the model improvises the
example set from conversational context.

**Fix approach.** New `get_candidate_units` tool that takes `intent` +
optional `scheme_name` + optional `limit`. For
`intent='handover'`: filter to `handover_date IS NOT NULL` (or
`unit_status = 'handed_over'`), ordered by `handover_date DESC`.
System prompt updated so "congratulate on keys / handover" requests
must call this tool first, then branch on count-vs-candidate comparison
(fewer → propose the smaller set; same → draft them all; more → ask
which N; zero → refuse honestly).

## Bug B — Unit identifier resolves to wrong unit

**Where.**
`lib/agent-intelligence/tools/agentic-skills.ts:1235-1241` builds this
Supabase query:

```ts
.or(`unit_number.ilike.%${unitRef}%,
     unit_uid.ilike.%${unitRef}%,
     purchaser_name.ilike.%${target.recipient_name || unitRef}%`)
.limit(1);
```

**Why it's failing.** Three separate problems stacked:
1. `ilike.%3%` matches unit_number '3', '13', '23', '30', '31', '33',
   etc. The DB returns the first row in whatever order PostgREST picked;
   with no `.order()` that's effectively arbitrary. Unit 10 isn't even
   `%3%` — so the more likely failure is that "Unit 3" verbatim (with
   the word "Unit ") hit none of the three branches (unit_number is
   stored as "3", not "Unit 3"), the OR reduced to false, and PostgREST
   returned the first row in the table → Unit 10 (whichever unit has
   the lowest primary key).
2. The `.or(…purchaser_name.ilike.%${unitRef}…)` branch is wide open —
   any unitRef that happens to be a substring of someone's name yields
   a match with no relation to the unit identifier.
3. No `.eq('development_id', devId)` pre-filter inside the query — the
   scheme scope is only established when the model passes
   `scheme_name`. If it doesn't, we search the whole agent's estate.

**Fix approach.** New `resolveUnitIdentifier(supabase, ref, {devIds})`
helper that:
- Normalises the ref: strips "unit", "#", whitespace, leaves the core
  identifier (digits or alphanumeric code).
- First tries exact `unit_number = <normalised>` with the devIds scope.
- Falls back to exact `unit_uid = <normalised>` (e.g. "AV-3") and
  `unit_uid` ending with `-<normalised>`.
- NEVER wildcards on purchaser_name. NEVER `ilike.%<ref>%` on the
  unit columns — "Unit 30" does not match Unit 3.
- Returns `{ status: 'ok', unit }`, `{ status: 'not_found' }`, or
  `{ status: 'ambiguous', candidates }` when multiple units match
  across different developments.
- `draft_buyer_followups` fails the draft for `not_found` / `ambiguous`,
  surfacing a structured warning in the envelope so the 6D
  anti-hallucination guard catches the "model claimed success" lie.

## Bug C — No purpose-criterion validation against resolved unit

**Where.** `draft_buyer_followups` (same file, ~line 1262) inserts a
draft for whatever unit resolved, regardless of whether the email's
purpose matches the unit's state.

**Why it's failing.** The `purpose` field was never introduced (Session
8 work that didn't land), and even with it introduced there was no
precondition check — the skill would happily draft
"Welcome to your new home — Unit 10" for a unit in `sale_agreed` that
has never been handed over.

**Fix approach.** Define `PURPOSE_PRECONDITIONS` at skill level — one
predicate per purpose against the resolved unit row:

```ts
const PURPOSE_PRECONDITIONS: Record<DraftBuyerFollowupPurpose, (u: UnitRow) => boolean> = {
  congratulate_handover: (u) => Boolean(u.handover_date) || u.unit_status === 'handed_over',
  chase: (u) => !!u.contracts_issued_date && !u.signed_contracts_date,
  introduce: (u) => !!u.purchaser_name,
  update: () => true,
  custom: () => true,
};
```

Before persisting each draft, the skill runs the predicate. On failure
the unit is skipped, a structured warning is appended to the envelope's
summary and `meta.skipped` list, and the model is told the reason so it
can surface it to the user ("Unit 10 hasn't been handed over yet — did
you mean a different one?"). The precondition belongs at the skill
level because it needs live DB fields; tool-call-time validation (at
the registry or system-prompt level) can't see the same data.

## Bug D — Tool description tightening

The registry description for `draft_buyer_followups` only named the
tool's purpose. New description in this commit:

> Use this tool to draft follow-up emails for one or more buyers.
> CRITICAL RULES:
> 1. Each target's `unit_identifier` must be a unit number explicitly
>    mentioned by the user OR returned by a previous tool. Do NOT guess.
> 2. The `purpose` parameter must match what the user is asking for.
>    "Congratulate on keys" → `congratulate_handover` ONLY for units
>    that have actually been handed over.
> 3. If you're unsure which units the user means, call
>    `get_candidate_units` with the intent first; do not pick units
>    silently.

## Summary of fixes shipping with this commit

1. New `get_candidate_units` tool (intent-aware filtering for
   clarification).
2. `draft_buyer_followups` gains `purpose` + `custom_instruction`
   params, joint-purchaser greeting, per-target unit-id dedupe, strict
   unit resolution, purpose-precondition gating, and skipped-unit
   telemetry in the envelope meta.
3. `resolveUnitIdentifier` helper used by both skills.
4. System prompt updated: intent-aware clarification, strict unit
   resolution rules, purpose-precondition note.
5. Tests: strict resolver (`Unit 3` ≠ Unit 30, Unit 300 fails,
   cross-scheme ambiguity), joint purchasers, purpose precondition
   (cannot congratulate Unit 10, can congratulate Unit 3 with a
   handover_date).
