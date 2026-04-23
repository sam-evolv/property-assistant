# Drafts Pipeline Regression Diagnosis (Session 6D)

## TL;DR

Root cause is **hypothesis 2**: the user's phrasing ("draft an email to
those 3 units") does not match any envelope-producing skill. The closest
tool the model reaches for — `draft_message` — is *not* an agentic skill.
It's a template helper that returns an `instruction` string telling the
model to "Generate the COMPLETE email now" inline. It produces no envelope,
no `pending_drafts` row, and no drawer signal, yet the model takes the
successful tool response as evidence the work is done and confidently
writes "drafts are ready for your review".

No amount of prompt tuning fixes a missing tool. The fix is to convert
`draft_message` into a real envelope-producing agentic skill and add a
hallucination guard as the last line of defence.

## Six-point diagnosis

### 1. Tool registry inventory

From `lib/agent-intelligence/tools/registry.ts`. Every tool marked "Ⓔ"
returns an `AgenticSkillEnvelope`, routes through
`runAgenticSkill()` → `persistSkillEnvelope()` → `persistDraftsForEnvelope()`,
and therefore writes rows into `pending_drafts`.

| Tool | Produces drafts? | Writes pending_drafts? | Emits envelope? |
|---|---|---|---|
| `get_unit_status` | no | no | no |
| `get_buyer_details` | no | no | no |
| `get_scheme_overview` | no | no | no |
| `get_scheme_summary` | no | no | no |
| `get_outstanding_items` | no | no | no |
| `get_communication_history` | no | no | no |
| `get_viewings` | no | no | no |
| `search_knowledge_base` | no | no | no |
| `create_task` | no (writes agent_tasks) | no | no |
| `log_communication` | no (writes communication_events) | no | no |
| **`draft_message`** | **claims to** | **NO** — returns `instruction` for inline LLM generation | **NO** |
| `generate_developer_report` | no (returns report data) | no | no |
| `chase_aged_contracts` Ⓔ | yes | yes | yes |
| `draft_viewing_followup` Ⓔ | yes | yes | yes |
| `weekly_monday_briefing` Ⓔ | yes (single report draft) | yes | yes |
| `draft_lease_renewal` Ⓔ | yes | yes | yes |
| `natural_query` Ⓔ | yes (single answer-as-draft) | yes | yes |
| `schedule_viewing_draft` Ⓔ | yes | yes | yes |

**`draft_message` is the odd one out.** It was written as a "give the model
rich context so it writes the email inline in its streamed response"
helper. Every other draft-producing tool returns an envelope. `draft_message`
does not. This is the regression.

### 2. Trace of "can you draft an email to those 3 units…"

The model's tool-choice is governed by the descriptions in the registry.
When the user just saw a `get_outstanding_items` result listing 3 units and
then asks "draft an email to those 3 units", the model has these options:

- `chase_aged_contracts` — description says "Find contracts issued over 6
  weeks ago and draft solicitor chase emails for each". Inputs:
  `threshold_days`, `scheme_filter`. No way to target a specific subset of
  units — if the model picks this it drafts for ALL 21 overdue contracts.
  The user wouldn't have seen "only 3 drafts" so this wasn't what fired.

- `draft_message` — description says "Draft an email or message for the
  agent to review and send." Inputs: `recipient_type`, `recipient_name`,
  `context`, `tone`, `related_unit`, `related_scheme`. Single recipient per
  call, but parallel tool-calls are supported by gpt-4o-mini. The model
  picks this for "draft an email to X" queries.

gpt-4o-mini called `draft_message` three times in parallel (once per unit).
Each call hit `draftMessage()` in `lib/agent-intelligence/tools/write-tools.ts:216`
which:
1. Resolves the unit / scheme context (lookup on `developments` + `units`).
2. Returns `{ data: { draft_ready: true, recipient_first_name, recipient_email,
   unit_context, instruction: "Generate the COMPLETE email now..." }, summary: "..." }`.

That `data` is **not an `AgenticSkillEnvelope`** (fails the
`isAgenticSkillEnvelope` shape check in `chat/route.ts:390`), so
`extractEnvelope()` returns `null` and no envelope is collected. The tool
call succeeds, the model reads `draft_ready: true` + the `instruction`, and
dutifully writes out the full email body inline in its streamed response.

But zero rows are written to `pending_drafts`. Zero envelopes reach the
client. The drawer never opens. The inbox is unchanged.

And the model, quite reasonably, summarises the successful tool calls as
"Drafted follow-up emails for the three units are ready for your review."
From the model's POV every tool call returned `draft_ready: true`. It has
no way to know the tool is a template that doesn't actually persist.

### 3. Is there a "follow-up emails to specific units" skill?

**No.** `chase_aged_contracts` is bulk-over-the-overdue-list, fixed
threshold-based. There is no "draft emails for units X, Y, Z" skill that
returns an envelope. This is the gap.

### 4. Multi-tool envelope emission

The chat route (`app/api/agent-intelligence/chat/route.ts:216–249`) loops
over every tool call in every round and pushes every envelope into
`envelopes[]`. The final SSE emission (line 273–278) iterates that array
and emits one `envelope` frame per populated envelope. So multi-tool
rounds are handled correctly in terms of emission.

**However** — the drawer store (`drawer-store.tsx:74–86`) REPLACES state
on each `openApprovalDrawer()` call. If the server emitted 3 envelopes in
sequence for 3 `draft_message` calls (had they been envelope-producing),
only the last would end up visible. So there is a latent bug here that
would surface the moment `draft_message` starts producing envelopes. This
session's fix needs to either merge envelopes server-side into one, or
teach the drawer store to append.

Server-side merge is simpler and closer to how the user thinks about a
turn — "I asked for 3 drafts, I see 3 drafts in one drawer". Fix goes in
the chat route.

### 5. `persistDraftsForEnvelope` idempotency

Each draft is a separate `INSERT` — no deduplication. If the model re-runs
a skill within a turn (rare), rows double up. The envelope rewrite replaces
the in-memory draft id with the DB id, so the drawer talks to real rows.
If a single insert fails (line 102), the draft keeps its in-memory UUID
and the drawer Approve button will 404 against `/send-draft`, but the
drawer still opens. Partial failures do not silently swallow drafts — they
leave them visible but un-sendable.

The regression symptom ("0 drafts written") is NOT a persistence failure.
It's a "we never tried to persist" failure — `draft_message` never reaches
`persistDraftsForEnvelope` at all.

### 6. Vercel runtime logs

No runtime errors on `/api/agent-intelligence/chat` over the last hour
that would indicate a crash or rejected insert. Logs show successful 200
responses on the affected turns, consistent with the "tools called, no
envelope emitted" path described above. This rules out hypothesis 3
(envelope emission broken) definitively.

## Fix taken in this commit

1. **Convert `draft_message` into a real agentic skill.** New
   `draftMessageSkill()` in `lib/agent-intelligence/tools/agentic-skills.ts`
   returns an `AgenticSkillEnvelope` with one draft. Registered via
   `runAgenticSkill()` so it funnels through `persistDraftsForEnvelope()`
   and writes a `pending_drafts` row. Template-based body generation
   server-side (tone-aware, Irish conversational English) — no more
   "instruct the model to inline the email" dance.

2. **New `draft_buyer_followups` skill** for explicit multi-recipient
   requests. Takes `targets[]` (`{ unit_identifier, scheme_name, topic }`)
   and produces one draft per target, all in one envelope. Matches the
   "draft emails to those 3 units" pattern directly.

3. **Merge envelopes server-side.** The chat route now concatenates all
   envelopes produced in a turn into one combined envelope before emitting
   the SSE frame. Drawer sees one envelope with N drafts, state is
   consistent.

4. **Anti-hallucination guard.** In the chat route:
   - Pre-stream: if a draft-producing tool was called but no envelope
     with drafts was collected, inject a system message telling the model
     not to claim drafts exist.
   - Post-stream: if the streamed content claims drafts were created and
     no envelope was emitted, emit an `override` SSE frame with an honest
     failure message. Client replaces the assistant content on receipt.
   - Telemetry: every override is logged via
     `logInteraction` with `response_type = 'hallucinated_drafts'`, and
     `console.error` for Vercel log surfacing.

5. **Drawer wiring audit.** Both `/agent/intelligence/page.tsx` and
   `/agent/dashboard/intelligence/page.tsx` already wrap in
   `ApprovalDrawerProvider` and call `openApprovalDrawer(data.envelope)`
   on `envelope` frames. Both now also handle the new `override` frame.
   The rAF-defer pattern in the drawer store survives unchanged.

## What NOT to change

- The working agentic skills (`chase_aged_contracts`,
  `draft_viewing_followup`, `draft_lease_renewal`,
  `weekly_monday_briefing`, `natural_query`, `schedule_viewing_draft`)
  already go through the correct path and need no edits.
- `persistDraftsForEnvelope` is correct — not the bug.
- The SSE frame encoding (`type: 'envelope'`) is correct on both pages.
