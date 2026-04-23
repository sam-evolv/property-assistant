# Session 14.3 Diagnosis — identifier-class ambiguity and leaked marker

## The identifier bug the user reported

Per the task brief:
- Vercel runtime logs show the Session 14.2 `[agent-context] resolveAgentContext: profile loaded but ZERO assigned schemes` CRITICAL line firing.
- `fetchAssignments` ran, did NOT throw (so the Supabase call succeeded), and returned an empty array.
- Database check: `WHERE agent_id = 'cfaae4e0-…'` (the auth UID) → 0 rows; `WHERE agent_id = '0f9210e0-…'` (agent_profiles.id) → 5 rows.

That combination is diagnostic: the query ran with `cfaae4e0-…` (auth UID) in the
`agent_id` position. `agent_scheme_assignments.agent_id` references
`agent_profiles.id`, not `auth.users.id`. The row set is empty because the
foreign-key domain was wrong.

## Where that identifier swap could be happening

Honest audit of the repo at `eb8df5c8`:

- `fetchAssignments` at `agent-context.ts:152` is called in exactly one
  place — `resolveAgentContext` at `agent-context.ts:62`, with
  `profile.id`. `profile` is the row returned by `fetchProfileByUserId`,
  whose `id` column is `agent_profiles.id`. That call looks correct.
- `draftBuyerFollowups` / `chaseAgedContracts` / every agentic skill
  re-queries `agent_scheme_assignments` themselves using
  `agentContext.agentId`. The chat route constructs `AgentContext` with
  `agentId: resolved.agentProfileId`, so those calls also pass
  `agent_profiles.id`.
- Read-side skills never re-query assignments — they read
  `agentContext.assignedDevelopmentIds` which is populated at the chat
  route boundary.

**None of the static call sites obviously pass `authUserId` where
`agent_profiles.id` is required.** The symptom must therefore be coming
from either:

1. A transient, environment-specific condition (stale client,
   outdated deploy artefact, environment variable swap) that the code
   at `eb8df5c8` doesn't reproduce.
2. A runtime path where `agentContext.agentId` got overwritten with the
   auth UID — likeliest candidate is an upstream builder reaching for
   `userId` and storing it in the `agentId` slot. The fields are both
   typed `string`, so the compiler cannot catch this class of swap.
3. `fetchProfileByUserId` returning a row whose `id` column is (for
   some reason) the auth UID — would indicate DB corruption; not
   observed.

**Regardless of which specific mechanism bit this time, the failure
pattern repeats.** It has regressed three times (6A → 14 → 14.2).
Pattern recognition says it will regress again. The fix has to be
structural, not another runtime log.

## Why runtime instrumentation alone isn't enough

Session 14.2 added:
- `fetchAssignments` throws on error.
- `resolveAgentContext` `console.error` when profile loaded with zero
  assignments.
- `resolveSchemeName` `console.error` when agent context has empty
  assignedDevelopmentIds.
- Chat route trip-wire `console.error` after context construction.

Every one of those fired. The ERROR lines all tell us the symptom
(empty arrays). None tell us the proximate cause (wrong id passed
upstream), because at the log-site the id is already a plain `string`
with no type annotation proving it's the right KIND of id.

Adding more logs would be more of the same. What stops this class of
bug is making it uncompile-able.

## The leaked PENDING_CLARIFICATION marker

Separate, smaller bug observed in preview: when Session 14's yes/no
disambiguation fires, the SSE stream emits:

```ts
fullContent = `${promptText}\n${marker}`;
controller.enqueue(JSON.stringify({ type: 'token', content: fullContent }));
```

where `marker = <!--PENDING_CLARIFICATION:base64json-->`.

The chat UI renders tokens through a markdown pipeline that escapes
`<` to `&lt;`, so what was meant as an HTML comment (invisible) renders
as visible text below the prompt. Screenshot-confirmed by the user.

Fix: emit the clarification state as a SEPARATE SSE frame so the
marker never enters user-visible text. Current `type: 'token'` frame
carries only the visible prompt. New `type: 'pending_clarification'`
frame carries the structured payload for the client to stash (or for
the server to look up from `intelligence_conversations` on the next
turn).

## Fix plan

### Fix 1 — Branded identifier types

New module `lib/agent-intelligence/ids.ts`:

```ts
export type AgentProfileId = string & { readonly __brand: 'AgentProfileId' };
export type AuthUserId = string & { readonly __brand: 'AuthUserId' };
export const asAgentProfileId = (s: string) => s as AgentProfileId;
export const asAuthUserId = (s: string) => s as AuthUserId;
```

TypeScript treats these as distinct types even though they're strings
at runtime. Passing a raw `string` or the wrong brand to a function
typed `(_: AgentProfileId)` is a compile error.

### Fix 2 — Every identifier-typed parameter uses the brand

- `fetchAssignments(supabase, agentProfileId: AgentProfileId)`
- `ResolvedAgentContext.authUserId: AuthUserId`, `agentProfileId: AgentProfileId`
- `AgentContext.authUserId: AuthUserId`, `agentProfileId: AgentProfileId`
- `fetchProfileByUserId(supabase, authUserId: AuthUserId)`

The existing `AgentContext.userId` field gets renamed to `authUserId` so
the naming matches the branded type. `agentId` (a looser "agent"
handle) is renamed to `agentProfileId` so it's obvious what it points
at.

### Fix 3 — All consumers updated

`grep -rn "agentContext\.\(userId\|agentId\)"` gives the call set.
Each `.userId` becomes `.authUserId`; each `.agentId` becomes
`.agentProfileId`. SkillAgentContext likewise.

Chat route is the one construction site that decodes from
`resolveAgentContext`. It pulls `resolved.authUserId` and
`resolved.agentProfileId` and assigns them to the branded fields.

### Fix 4 — Marker leak

Chat route, in the `topCandidateForPrompt` short-circuit:

```ts
// Before
fullContent = promptText + '\n' + marker;
controller.enqueue(...{ type: 'token', content: fullContent });

// After
fullContent = promptText;
controller.enqueue(...{ type: 'token', content: promptText });
controller.enqueue(...{ type: 'pending_clarification', payload: {
  originalMessage, typedScheme, topCandidateName, topCandidateDevId,
}});
```

The marker still lands server-side via `storeConversationMemory`
(so the NEXT turn's history-based detector still works) but never hits
the displayed token stream.

`storeConversationMemory` is amended to append the marker to the
stored `fullContent` only for the clarification case, so the DB row
carries the control payload. A new helper
`extractPendingClarificationFromDb(supabase, sessionId)` queries the
latest assistant row from `intelligence_conversations` for the given
session and parses the marker if present. This is the primary lookup
on the next turn; the history-based `extractPendingClarification` stays
as a fallback for clients that do round-trip the full assistant message.

### Fix 5 — Smoke tests

`test-agent-context-loader.ts`: extend to assert both `authUserId` and
`agentProfileId` fields are populated on the resolved context and have
distinct values (auth UID vs profile id).

`test-read-tool-contract.ts` (new): construct `AgentContext` for Orla,
call `getUnitStatus({scheme_name: 'Árdan View', unit_identifier: '3'})`,
assert result contains `Foley` and does NOT contain `Assigned: (none)`.
This is the test that would have caught today's symptom.

## Acceptance matrix

| Input | Expected |
|---|---|
| "What's the status of Unit 3 in Árdan View?" | Foley family data. No "(none)". |
| "Reach out to number 3, Erdon View" | "Did you mean Árdan View? (yes/no)" with NO visible base64 blob. |
| Reply "yes" | Draft persisted for Foleys at Unit 3. |

## Out of scope

- `tesseract.js` build error
- Any new functionality
- Whisper / voice
