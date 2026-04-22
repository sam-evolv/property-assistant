# Scheme Context Diagnosis (Session 6A)

## TL;DR

The "No schemes are currently assigned to you" reply is a **prompt-level hallucination**
driven by an empty `agentContext.assignedSchemes`. The system prompt renders
`Assigned Schemes: (none assigned)` and the model paraphrases that back at the
user. The *scope resolver* in `lib/agent-intelligence/context.ts → loadAgentContext`
is the single point that populates that list, and it returns empty because of
one redundant filter and one bug in the tool adapter. Every downstream agentic
skill that re-queries `agent_scheme_assignments` does so with the right
identifier (`agent_profiles.id`) — so the contracts skill is not working "by
accident"; it is just more resilient than the scope resolver it bypasses.

The fix is to (a) make scope resolution a first-class single-source-of-truth
helper, (b) thread the resolved ids through the agent context object, and (c)
put the assigned-development list into the system prompt explicitly so the
model can see the scope even when a downstream tool short-circuits.

## 1. Agentic skills that read `agent_scheme_assignments`

| Skill / tool | Handler | File |
|---|---|---|
| Scope resolver (shared) | `loadAgentContext()` | `lib/agent-intelligence/context.ts:81` |
| `chase_aged_contracts` | `chaseAgedContracts()` | `lib/agent-intelligence/tools/agentic-skills.ts:63` |
| `weekly_monday_briefing` (aged-contracts slice) | `loadAgedForBriefing()` | `lib/agent-intelligence/tools/agentic-skills.ts:278` |
| `natural_query` (intent `for_sale_count`) | `naturalQuery()` | `lib/agent-intelligence/tools/agentic-skills.ts:735` |

Everything else scope-scoped (renewals, arrears, viewings, lettings) reads via
`agent_id` on the skill's own table (`agent_tenancies`, `agent_viewings`,
`agent_letting_properties`), not via `agent_scheme_assignments`. Those joins
use the agent profile id already and are not the source of this bug.

## 2. Which identifier each caller uses

| Caller | Identifier used | Correct? |
|---|---|---|
| `loadAgentContext` | `profile.id` (agent_profiles.id) **+ `.eq('tenant_id', tenantId)`** | ID correct, but the redundant `tenant_id` filter silently excludes rows whose stored `tenant_id` is null or differs from the profile's tenant (the case for Orla — see §5 below). |
| `chaseAgedContracts` | `agentContext.agentId` (agent_profiles.id via `SkillAgentContext`) | Correct. |
| `loadAgedForBriefing` | `agentId` (agent_profiles.id) | Correct. |
| `naturalQuery` `for_sale_count` | `agentContext.agentId` | Correct. |
| `getViewings` (read tool) | Re-resolves `agent_profiles.id` via `user_id` | Correct but redundant. |
| `scheduleViewing` (legacy write) | Re-resolves `agent_profiles.id` via `user_id` | Correct but redundant. |

The skills already use `agent_profiles.id` correctly. Only `loadAgentContext`
is strict enough to miss rows — and it is the one whose output the system
prompt renders.

## 3. Is there a shared "resolve current agent's assigned developments" helper?

Not really. `loadAgentContext` populates the full `AgentContext` (profile,
assigned schemes with unit counts) for the chat route, but the agentic skills
each re-query `agent_scheme_assignments` in-line (three times, in
`agentic-skills.ts`). Every re-query uses the correct identifier, but the
pattern is duplicated. Adding a true "resolve current agent scope" helper lets
every call site go through one place and lets us unit-test it once.

## 4. Where is agent identity established in the chat route?

`app/api/agent-intelligence/chat/route.ts` lines 44–86:

1. Service-role client via `getSupabaseAdmin()`.
2. Route-handler client fetches `auth.getUser()` → `auth.uid()`.
3. First `agent_profiles` row for that `user_id` is pulled. Fallback picks the
   earliest profile in the tenant (dev/preview mode).
4. `loadAgentContext(supabase, authUserId, tenantId)` runs once and its output
   is passed through to every tool via the `AgentContext` object. Tools do not
   re-run auth.

So identity threading is structurally right — the chat route does resolve
`agent_profiles.id` once and pass it to the tool context. The bug is inside
`loadAgentContext` (the strict filter) and the absence of the assigned
development list in the *system prompt itself* (so when the model sees
`assignedSchemes = []` it replies "no schemes assigned" instead of reaching
for a tool).

## 5. Failure trace for Orla's "scheme summary" query

1. Orla sends `"Give me a scheme summary"`.
2. Chat route resolves `auth.uid() = cfaae4e0…` → `agent_profiles.id = 0f9210e0…`
   and `tenant_id = <tenant_T>`.
3. `loadAgentContext` runs:
   ```ts
   supabase.from('agent_scheme_assignments')
     .select('development_id')
     .eq('agent_id', profile.id)
     .eq('tenant_id', tenantId)   // <-- strict
     .eq('is_active', true);
   ```
   For Orla's production assignment row (agent_id = `0f9210e0…`, development_id
   = Árdan View, is_active = true, role = lead_agent), the `tenant_id` column
   is either null or differs from the profile's stored tenant. The row is
   filtered out. `assignedSchemes` returns `[]`.
4. `buildAgentSystemPrompt` renders `Assigned Schemes: (none assigned)` in the
   fallback-context block.
5. Model sees `(none assigned)` with no tool that lists schemes without a name
   argument, paraphrases back: "I don't have that data in the system. No
   schemes are currently assigned to you."

Intelligence references "21 outstanding contracts" correctly elsewhere because
`chase_aged_contracts` drops the `tenant_id` filter on
`agent_scheme_assignments`. It sees the row, resolves Árdan View, queries
`unit_sales_pipeline` by `development_id`, and returns the real list. That
path does not need the agent context to have populated `assignedSchemes`. So
the contracts skill works in spite of, not because of, the scope resolver.

## 6. Other tools with the same latent pattern

- `get_scheme_overview` (`read-tools.ts`) ignores `agentContext.assignedSchemes`
  entirely and searches the full `developments` table by name (tenant-scoped
  only). Works when a name is given, but answers nothing when the user asks
  the general "scheme summary" prompt because the LLM cannot pick a name.
- `get_outstanding_items` correctly falls back to
  `agentContext.assignedSchemes.map(s => s.developmentId)` when no scheme is
  named. This means it goes silent for Orla too — empty assignedSchemes →
  empty `agentDevIds` → empty pipeline query.
- `generate_developer_report` scopes by `tenant_id` only, so it would return
  developments belonging to other agents too. Not this session's fix, but
  worth flagging.
- `registry.ts` line 51 passes `agentContext.userId` to
  `getAgentProfileExtras(agentId)` — wrong identifier, the agency name is
  always resolved against the auth uuid and comes back null. Cosmetic (skill
  signatures just lose agency) but it's the same `auth.uid()` vs
  `agent_profiles.id` mixup that caused this whole session.

## Fix taken in this commit

1. New `lib/agent-intelligence/agent-context.ts` exports
   `resolveAgentContext(supabase, authUserId)` — single source of truth.
   Returns `authUserId`, `agentProfileId`, `tenantId`, `displayName`,
   `assignedDevelopmentIds`, `assignedDevelopmentNames`. Drops the strict
   `tenant_id` filter on `agent_scheme_assignments` (the `agent_id → profile
   → tenant` chain already guarantees tenant scope, and the service-role
   client is not subject to RLS).
2. `AgentContext` now carries `assignedDevelopmentIds` and
   `assignedDevelopmentNames` directly so skills can use the list without
   re-querying.
3. `loadAgentContext` delegates to the new helper so every legacy call site
   still works.
4. `chat/route.ts` calls `resolveAgentContext` once, threads it through, and
   appends a "Current agent context" block to the system prompt with the
   agent name, assigned developments, and active scheme.
5. `registry.ts` now passes `agentContext.agentId` (not `userId`) into
   `getAgentProfileExtras`.
6. A new `get_scheme_summary` tool returns real numbers against the agent's
   assigned developments (or a named one, if given). Output matches the
   session brief: total units, status breakdown, total committed revenue,
   average price, overdue-contract count, and suggested next actions.
7. A smoke test (`tests/agent-intelligence/scheme-context.test.ts`) pins the
   behaviour so the `auth.uid()` shortcut cannot regress into this code path
   again.
