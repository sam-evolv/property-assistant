# Session 14.2 Diagnosis — agent context empty at tool-invocation time

## Symptom vs reality

Preview `intelligence_interactions` row at `2026-04-23 17:50:45`:

```
query_text:      "What's the status of Unit 3 in Árdan View?"
tools_called[0]: {
  tool_name: "get_unit_status",
  params:    { scheme_name: "Árdan View", unit_identifier: "3" },
  result_summary: '"Árdan View" is not in your assigned schemes. Assigned: (none).'
}
response_text: "Unit 3 in Árdan View doesn't exist — you currently have no schemes assigned."
```

Database truth (all via Supabase MCP):

- `agent_profiles.id = 0f9210e0-342d-4f98-9be1-95decb6f507a` exists with
  `user_id=cfaae4e0-894a-43cf-af9b-a74e9ce0532d`, tenant `4cee69c6-…`.
- `agent_scheme_assignments` has **five** `is_active=true` rows keyed off
  that agent id, covering Árdan View, Harbour View Apartments, Longview
  Park, Rathárd Lawn, Rathárd Park.
- `agent_profiles` policies: `authenticated` SELECT + `service_role` ALL.
- `agent_scheme_assignments` policies: `authenticated` SELECT +
  `service_role` ALL.
- `agent_profiles` has exactly one row — Orla. `fetchEarliestProfile` is
  indistinguishable from `fetchProfileByUserId` here.

Data is present. Resolver should find all five.

## Where "(none)" comes from

`lib/agent-intelligence/tools/read-tools.ts:62` (Session 14):

```ts
const assignedList = agentContext.assignedDevelopmentNames.join(', ') || '(none)';
// …
summary = `"${schemeName}" is not in your assigned schemes. Assigned: ${assignedList}.`;
```

That summary fires when `resolveSchemeName` returns `{ ok: false, reason:
'not_assigned', … }`. `not_assigned` fires at
`scheme-resolver.ts:143` when the alias lookup finds a real
`development_id` but that id is NOT in
`agentContext.assignedDevelopmentIds`:

```ts
const idx = agentContext.assignedDevelopmentIds.indexOf(developmentId);
if (idx === -1) return { ok: false, reason: 'not_assigned', … };
```

So at the moment of the tool call, `agentContext.assignedDevelopmentIds`
was an empty array — AND the alias table successfully resolved Árdan
View to its canonical `developmentId`. The one end of the pipeline
works; the other is starved.

## Code-path comparison — write side (working) vs read side (broken)

| Stage | Write side (`draftMessageSkill`) | Read side (`getUnitStatus`) |
|---|---|---|
| Chat route calls `resolveAgentContext(supabase, user?.id ?? null, {activeDevelopmentId})` | ✓ | ✓ (same call) |
| `const agentContext: AgentContext = { …resolved.assignedDevelopmentIds, …resolved.assignedDevelopmentNames }` | ✓ | ✓ (same object) |
| Registry adapter `runAgenticSkill` strips AgentContext into `SkillAgentContext` then the skill **re-queries** `agent_scheme_assignments` by `agentId` | ✓ (lines 1104-1113 re-query) | n/a — read tools receive the full AgentContext |
| Reads `agentContext.assignedDevelopmentIds` directly? | No — re-queries `agent_scheme_assignments` for its own scope list | Yes — trusts the passed-in AgentContext |

**This is the structural asymmetry.** Write-side skills (Session 9,
Session 13, Session 13.2) ignore the passed-in AgentContext for scheme
scope and re-query `agent_scheme_assignments` themselves with the agent
profile id. When the AgentContext is empty, they don't notice — their
own query runs fine and populates the scope list. Read-side skills
trust the AgentContext object. When the AgentContext is empty, read
skills see no schemes.

Both paths call `resolveAgentContext`. The profile loads. The
assignments query in `resolveAgentContext` is the failing step — it
returns zero rows in production despite five existing. Because
`fetchAssignments` swallows its error (`const { data } = await …;
return data ?? []`), no log line tells us which.

Why does the write side still work? Because the write-side skills ALSO
re-run the same `agent_scheme_assignments` query themselves inside the
skill body. The second query succeeds. Write side papers over the
failure; read side exposes it.

## The single source of truth is already single — the problem is silence

`grep -rn "agent_scheme_assignments" lib/agent-intelligence/` returns
these call sites:

- `agent-context.ts:152` — `fetchAssignments` inside `resolveAgentContext`
- `tools/agentic-skills.ts:{84, 290, 743, 868, 1104, 1170, 1499, 1705}` —
  write-side skills re-building their scope list on each skill call

The write-side re-queries are duplicative but not bugs; they're the
reason writes kept working. Plan: leave them in place (don't widen
blast radius), but harden `resolveAgentContext` so a silent miss
becomes a loud one.

`loadAgentContext` in `context.ts:87` exists but zero callers reference
it (`grep -rn "loadAgentContext" apps/unified-portal/` returns the
definition only). Dead code; can be deleted.

## Fix plan

1. **`fetchAssignments`**: capture the error object and log when it's
   non-null, and log when data comes back empty for an agent profile
   that DID load. Either signal is a latent bug.
2. **`resolveAgentContext`**: log `console.error` when a profile loads
   but assignments come back empty (and no `activeDevelopmentId`
   fallback was applied). That's the exact silent state producing
   "Assigned: (none)".
3. **`resolveSchemeName`**: precondition log at the top — if
   `agentContext.assignedDevelopmentIds.length === 0` it's a
   near-certainty the call will return `not_assigned` against a real
   scheme. Log `console.error` with the caller's agentId/userId so the
   chat route trace tells us in one line.
4. **Chat route**: after building `agentContext`, if `assignedDevelopmentIds`
   is empty despite a resolved profile, log `console.error` —
   a second redundant trip-wire because the next time this regresses,
   it'll regress for a DIFFERENT reason and we need the logs to
   converge on the truth.
5. **Delete `loadAgentContext`** in `context.ts`. Dead code removed.
6. **Smoke test** `scripts/hardening/test-agent-context-loader.ts`:
   calls `resolveAgentContext` against a known agent profile (Orla's,
   configured via env vars so it can run anywhere Supabase is reachable)
   and asserts `assignedDevelopmentIds.length === 5`. Runnable via
   `npm run hardening:agent-context`.

## Acceptance matrix the repro pins

| Input | Expected |
|---|---|
| "What's the status of Unit 3 in Árdan View?" | Real Foley-family data. Tool summary contains the unit number and buyer name, not "(none)". |
| "What's outstanding on Unit 99 in Árdan View?" | Tool result for Unit 99. Data-driven, not a no-schemes bail. |
| "Reach out to number 3, Erdon View" | "Did you mean Árdan View? (yes/no)" — disambiguation now reachable because the resolver finds Árdan View in the agent's assigned list. |
| Reply "yes" | Draft for Unit 3 Foleys persisted; alias `Erdon View` captured. |

## Out of scope

- Whisper / voice
- `tesseract.js` build error
- Rewriting the write-side skills to stop re-querying `agent_scheme_assignments`
- Any prompt changes
