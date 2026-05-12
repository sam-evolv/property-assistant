# OpenHouse Care: Audit and Opportunity Map

Working branch: `claude/stress-test-audit-6amPY`
Date: 2026-05-12
Author: Claude (audit), with verification of every P0 against source.

This is the consolidated deliverable. The intermediate per-part working files (`CARE_AUDIT_PART1.md`, `CARE_AUDIT_PART2_3.md`) stay on disk as receipts. This document is the canonical output.

Method: static analysis, schema and RLS read, targeted source review of the routes that matter, plus `npm run typecheck` (exit 0). No live browser, no live Supabase. Where a finding depended on an agent reading I did not redo, the file path and line range are cited so anyone can verify.

Tone constraint applied: Irish, understated. No em dashes.

---

## 1. Executive summary

OpenHouse Care has a coherent product shape: an installer dashboard with a fleet view, intelligence chat, smart archive and support queue, and a homeowner portal with a competent renewable energy assistant ("Mary Murphy") backed by curated knowledge bases for solar PV, heat pumps, Ireland-specific context, and SE Systems specifics. The typecheck passes. The UI structure, the system prompts, and the tool definitions are thoughtful. The intent of the product is correct.

What is broken is the boundary. Every Care API route uses the Supabase service role and almost none re-verify the session principal or the row-level tenant. The route handlers behave as if they were internal microservices, but they are exposed at the public edge. The result is a set of cross-tenant and cross-installation read paths that would not survive a determined first user, never mind a security review.

Seven P0 findings. The unifying root cause is one missing helper: a `requireCareSession(installationId)` that returns the session and the installation row already scoped by tenant. Add that helper, route every Care endpoint through it, and most of the P0s collapse into one change.

What is solid: tool definitions, knowledge bases, the streaming machinery, the date and currency formatting, the absence of admin-shaped tools in the homeowner chat, the basic shape of the schema, the typecheck.

What is broken on day one: cross-installation chat history bleed through the model, unauthenticated installation reads, brute-forceable access codes, an unprotected demo seed endpoint, an upload path that accepts files with empty MIME, telemetry keys stored in plaintext, three tables with RLS on and zero policies.

The single biggest opportunity sits outside the audit: Care is currently a chatbot on top of a static knowledge base. The version that wins is the one that integrates Huawei FusionSolar, Daikin ONECTA, and SolarEdge so the assistant can answer "why is my generation down" with telemetry rather than troubleshooting prose. Everything else is downstream of that.

---

## 2. Issues log

Severity convention: P0 erodes trust on day one or breaches data, P1 ships-stopper, P2 polish, P3 nice-to-have. Effort: S (under a day), M (one to three days), L (more than three days).

| ID | Area | Sev | User impact | Where | Effort |
|---|---|---|---|---|---|
| C001 | Auth | P0 | Anyone with an installation UUID can read a customer's name, address, telemetry and alerts | `app/api/care/installations/[id]/route.ts:22-156` GET and PUT use service role with no session check and no `tenant_id` filter | S |
| C002 | Auth | P0 | A homeowner's chat reads another homeowner's prior conversation as if it were their own | `app/api/care/chat/route.ts:357-441` loads history by `conversation_id` only, with no link to `installationId` and no session check | S |
| C003 | Auth | P0 | Any caller can fetch the support queue for every installer, not just their own | `app/api/care/support-queries/route.ts:14-59` no session check, no tenant filter | S |
| C004 | Auth | P0 | Any caller can fetch live or mock telemetry for any installation by guessing the id | `app/api/care/telemetry/[installationId]/route.ts:15-30` service role, no ownership check | S |
| C005 | Brute force | P0 | Access codes (the homeowner's only credential today) are guessable in hours | `app/api/care/access/route.ts:14-35` no rate limit, no IP throttle, no failure logging | S |
| C006 | Operations | P0 | Demo seed endpoint can be invoked in production by an unauthenticated request and rewrite the demo data | `app/api/care/seed/route.ts:72` no env gate, no role check | S |
| C007 | Upload | P0 | An attacker can upload an executable masquerading as a no-MIME file into the archive bucket | `app/api/care-dashboard/archive/upload/route.ts:13-77` MIME check uses `file.type && ...` so empty string falls through | S |
| C008 | Security | P0 | Vendor monitoring credentials sit in plaintext in the DB; a backup leak burns every installer's SolarEdge / Fronius / FusionSolar access | `installations.telemetry_api_key` per `apps/unified-portal/migrations/007_telemetry_tables.sql`; CLAUDE.md mandates `lib/integrations/security/token-encryption.ts` and it is not used | M |
| C009 | Schema | P0 | Three Care tables have RLS on and zero policies; any feature that ever leaves service role returns empty arrays | `apps/unified-portal/migrations/009_heat_pump_fields.sql` enables RLS on `service_records`, `safety_alerts`, `service_bookings` with no `CREATE POLICY` | S |
| C010 | Intent routing | P1 | Homeowner says "send it" after a draft and there is no UI confirmation form or send action; the model may claim it was sent when nothing happened | `app/api/care/chat/route.ts:120-345` produces a `service_request_draft` rich message but `screens/AssistantScreen.tsx:289-293` has no handler for that `message_type` | M |
| C011 | Resilience | P1 | Network drop mid-stream persists a half-finished assistant message to the DB and to the chat list, with no error indicator | `app/api/care/chat/route.ts:680-696` (fire-and-forget insert) + `screens/AssistantScreen.tsx:253-307` | M |
| C012 | Resilience | P1 | When SolarEdge slows, every homeowner chat that calls `get_system_status` blocks for the upstream timeout | `lib/care/solarEdgeApi.ts:43-74` no `AbortController`, no timeout | S |
| C013 | Auth | P1 | Conversation list endpoint allows installation enumeration | `app/api/care/conversations/route.ts:14-28` no session check | S |
| C014 | Schema | P1 | `care_third_party_uploads.installer_tenant_id` is a bare UUID column with no FK to `tenants(id)` | `apps/unified-portal/migrations/039_care_third_party_uploads.sql` | S |
| C015 | Schema | P1 | All Care tables rely on service-role only; no authenticated-user policies exist, so any future direct DB access from the user JWT silently returns nothing | every Care table per Part 1 schema audit | M |
| C016 | Privacy | P1 | Installer intelligence chat logs customer PII in `intelligence_interactions.query_text` and `response_text` | `app/api/care/intelligence/chat/route.ts:625-633` | S |
| C017 | Validation | P1 | Installation onboarding accepts future install dates, negative warranty, malformed Eircode | `app/api/care/installations/onboard/route.ts:41-46` | S |
| C018 | Scaling | P1 | `installations-all` pages past 1,000 rows silently truncate at the PostgREST cap | `app/api/care/installations-all/route.ts:33-47` | S |
| C019 | Audit | P1 | PUT on installations has no audit row; the second admin's changes overwrite the first with no trace | `app/api/care/installations/[id]/route.ts:117-156` | M |
| C020 | Schema | P1 | Duplicate Care schema across two migration directories (root `0005/0006_*` vs unified-portal `006_*`) with diverging columns and a missing `updated_at` trigger in the unified-portal version | both directories | S |
| C021 | Roles | P1 | No role gating inside an installer tenant; a technician can run the seed endpoint, change branding, or edit credentials | every Care mutation route | M |
| C022 | Permissions | P1 | The `installer_name = 'SE Systems'` literal at `intelligence/chat/route.ts:22` is the security boundary for the intelligence chat; the moment a second installer onboards, the boundary moves | every tool function in `intelligence/chat/route.ts` | M |
| C023 | KB trust | P2 | System prompt allows fallback to model training data for non-troubleshooting questions, contradicting the earlier rule | `app/api/care/chat/route.ts:556-561` | S |
| C024 | UX | P2 | Rate limit (20 req/min) surfaces as a generic "Sorry, something went wrong" in the homeowner chat | `screens/AssistantScreen.tsx:240-249` does not branch on `res.status === 429` | S |
| C025 | UX | P2 | Filter state on the fleet list lives in `useState` only; deep links and back-navigation lose filters | `app/care-dashboard/installations/page.tsx:63-109` | S |
| C026 | Cost | P2 | Intelligence stream ignores client disconnect and burns the full OpenAI completion | `app/api/care/intelligence/chat/route.ts:554-652` | S |
| C027 | Hygiene | P2 | Demo fallback in homeowner chat returns a Mary Murphy installation any time a real lookup fails, masking RLS denials and missing rows | `app/api/care/chat/route.ts:384-409` | S |
| C028 | Enumeration | P2 | Public `lookup-job` endpoint is a stub today; once real lookup is wired the timing channel needs care | `app/api/care/third-party/lookup-job/route.ts:13-26` | S |
| C029 | Schema | P2 | `support_queries.tenant_id`, `diagnostic_flows.tenant_id` references have no `ON DELETE` clause | `apps/unified-portal/migrations/008_care_dashboard_upgrade.sql` | S |
| C030 | Tone | P3 | 24 em dashes in the homeowner chat route, 112+ in the KB; brand guideline says none | `lib/care/care-knowledge.ts`, `app/api/care/chat/route.ts` | S |
| C031 | Tone | P3 | KB entries read as textbook in places ("photovoltaic or PV", parenthetical-heavy phrasing) | `lib/care/care-knowledge.ts:31-40` and similar | M |

---

## 3. Schema and security findings

The full schema walk is in `CARE_AUDIT_PART1.md`. Salient items:

**Tables that exist.** `installations`, `care_conversations`, `care_messages`, `installation_telemetry`, `installation_alerts`, `support_queries`, `diagnostic_flows`, `service_records`, `safety_alerts`, `service_bookings`, `care_third_party_uploads`.

**Tenancy.** Only `installations`, `support_queries`, `diagnostic_flows`, and `care_third_party_uploads` carry a tenant column. Every other table reaches tenancy through `installation_id`, which means any future authenticated-user RLS needs a JOIN.

**RLS state.** Every Care table has `ENABLE ROW LEVEL SECURITY`. None has a policy for authenticated users. Service-role-only policies are the norm, with three exceptions that have RLS on and no policies at all (C009: `service_records`, `safety_alerts`, `service_bookings`). Authenticated-user access to Care today is impossible by definition; everything is API-mediated through service role. A leaked service-role key is total compromise.

**Stored credentials.** `installations.telemetry_api_key` is plaintext (C008). CLAUDE.md requires `lib/integrations/security/token-encryption.ts`; it is not used here. The comment "decrypted in production" at `app/api/care/installations/[id]/route.ts:62` confirms the team's intent but not the implementation.

**Duplicate migrations.** Root `migrations/0005_care_installations.sql` and `migrations/0006_care_conversations.sql` define the same tables as unified-portal `006_care_tables.sql`, with divergent columns and a missing `updated_at` trigger in the unified-portal version (C020). Both files use `CREATE TABLE IF NOT EXISTS` so whichever runs first wins silently.

**Shared dependencies.** `tenants`, `admins`, `developments`, `documents` are properly RLS'd in `packages/db/policies.sql` and downstream migrations. Care depends on `admins` for its third-party-upload policy join, which assumes a 1:1 between auth user and admin row with non-null `tenant_id`.

**Cascade behaviour.** Most child tables cascade on `installation_id` delete. Hard-delete is not exposed in the API today, so this is a latent risk only.

**Storage buckets.** No bucket policies in repo migrations. The third-party upload flow uses signed URLs via `lib/care/third-party.ts`. Bucket policies need a direct Supabase Studio inspection.

---

## 4. AI assistant findings

Two LLM call sites, both `gpt-4o-mini`. The homeowner assistant ("Mary Murphy") and the installer intelligence chat. No `match_document_sections` RAG call from Care; the homeowner KB is curated, not embedded.

### Homeowner assistant

**Honest intent routing.** Backend is correct. The tool `draft_service_request` is named and described as a draft; the system prompt at `app/api/care/chat/route.ts:540-541` reinforces "show it first before confirming it's sent." The model's response carries `sent: false`. The break is on the UI side (C010): there is no dedicated handler for `message_type === 'service_request_draft'` in `screens/AssistantScreen.tsx`, so the draft renders as plain text or is dropped. A homeowner who types "yes send it" enters a one-step gap between the draft and any actual send, with the model the only thing in the middle. The model will sometimes claim it was sent.

**Knowledge boundaries.** The system prompt has two contradictory rules at lines 537 ("Never answer from training data") and 559-561 ("If the KB doesn't cover it, use your own knowledge but be clear it's general guidance"). The model resolves contradictions by leaning on training data for anything not framed as fault or error code. The risk is confident fabrication of cost figures and COP norms. Sev P2 because the consequences are trust erosion rather than data leakage.

**Cross-installation reasoning (C002).** Critical. `installationId` and `conversation_id` are both attacker-controlled body fields. The conversation history loader at lines 429-441 filters by `conversation_id` only. A POST with a foreign `conversation_id` injects the victim's history into the model context, and the assistant will reason over it as if it were the caller's own.

**Adversarial prompts.** System prompt is positioned first, which limits but does not prevent ignore-previous-instructions. No defence against system-prompt extraction; standard for the model class. No admin-shaped tools exposed to the homeowner chat, so confused deputy is not an attack here.

**Resilience.** Streams persist partial assistant messages on disconnect (C011). SolarEdge fetch has no timeout (C012). Rate-limit response surfaces as a generic error (C024). Demo data fallback masks real lookup failures (C027).

**Tone.** Em dashes scattered through the KB and the system prompt (C030). KB has textbook phrasing in places (C031). Date and currency formatting use `en-IE` consistently; no issues found there.

### Installer intelligence chat

**Tools.** Seven, all read-only or summary: `search_installations`, `get_diagnostics_summary`, `get_warranty_status`, `get_support_queue`, `get_customer_communications`, `get_performance_metrics`, `get_attention_required`. Every tool's WHERE clause filters by `installer_name = 'SE Systems'` per the agent walk-through of `app/api/care/intelligence/chat/route.ts`. Today the boundary is consistent. Tomorrow, when a second installer onboards, the boundary moves from a hardcoded literal to whatever the team writes next, with seven places to update (C022).

**Privacy.** `query_text` and `response_text` are persisted to `intelligence_interactions` (C016). A query "show me John Smith's contact details for SE-2025-001" persists both the question and the answer with full PII.

**Streaming.** NDJSON with `token`, `sources`, `followups`, `done`, `error` events. Client disconnect is not propagated to the OpenAI request, so cost burn is real (C026). Not a security finding.

**Audit.** Logging shape is otherwise reasonable: tool calls listed, model identified, role recorded. Once PII is redacted (C016), the table becomes useful for both billing and behaviour analysis.

---

## 5. Installer dashboard findings

Full detail in `CARE_AUDIT_PART2_3.md` section "Part 2". Salient:

**Cross-tenant read and write (C001).** `installations/[id]` GET and PUT both accept the id from the URL, query by id only, and use service role. No session check, no tenant filter. Verified against source.

**Support queue (C003).** Same shape, applied to support_queries. Returns every tenant's tickets.

**Seed endpoint (C006).** No env check, no role check. Verified against source. The single most embarrassing finding in this audit: a public POST endpoint that rewrites demo data, present in the production app.

**Archive upload (C007).** MIME allowlist exists, but the guard is `if (file.type && !ALLOWED_MIME.has(file.type))` which lets empty MIME through. Filename sanitisation is correct; path traversal is not possible. Content validation is not.

**Validation gaps (C017).** Onboarding accepts future installs and negative warranty. Frontend form min/max is bypassed by direct API calls.

**Pagination (C018).** `installations-all` does an unbounded `select('*')`. PostgREST will quietly stop at 1,000 rows. SE Systems is unlikely to hit this in 2026; will hit it in 2027.

**Audit and concurrency (C019).** No audit row on installation updates. Last-write-wins is acceptable for a tenant of two admins; the absence of "who changed what when" is not.

**Filter state (C025).** `useState`-only, no `useSearchParams`. Deep links lose filters.

**Intelligence chat dispatch (C022).** Hardcoded installer string. Today consistent across all tools, tomorrow a footgun.

---

## 6. Homeowner assistant findings

Full detail in `CARE_AUDIT_PART2_3.md` section "Part 3". The most consequential ones repeat from the AI section above; the rest:

**Telemetry endpoint (C004).** Service role, no ownership check. Verified against source.

**Access-code endpoint (C005).** Unauthenticated POST, no rate limit, no logging. Verified against source. The access code is a bearer credential and is treated like a public form field.

**Conversation list (C013).** No session check, no ownership check. Iterating UUIDs gives an attacker a map of which installations have active homeowners.

**Draft confirmation UI (C010).** Backend produces structured drafts correctly. The UI does not render them as actionable cards. The product needs either a `DraftServiceRequestCard` component plus a `send_service_request` tool, or a clear text-based confirmation step that surfaces a draft id back to the model on the next message.

**Stream resilience (C011).** Detect partial completion server-side; do not insert on abort; surface "connection lost" in the UI.

---

## 7. Opportunity backlog

Ranked by combined user value, build cost, and strategic fit. Strategic fit categories: T = trust on day one, F = flywheel (installer to developer intro), M = data moat or AI-native angle, I = integration revenue. The ranking is by my read; the final ordering should reflect business priorities you can see and I cannot.

### For the homeowner

| ID | Opportunity | User value | Build | Fit | Notes |
|---|---|---|---|---|---|
| O1 | Live device telemetry in the assistant (Huawei FusionSolar, Daikin ONECTA, SolarEdge Site API) | High. The assistant can answer "why is my generation down" with the actual numbers instead of a troubleshooting tree | L (per integration: 5 to 10 days incl. credential vault, retry, mock) | M, I | Today the homeowner chat falls back to mock generation data when no key is present. Once real telemetry lands, the assistant's answers become trustworthy and falsifiable. This is the single biggest credibility upgrade. |
| O2 | Proactive nudges instead of pull-only chat | High. Weather-adjusted underperformance alerts ("your panels produced 30 percent under forecast this month, possible fault") are the moment a homeowner says "this is useful" | M (2 to 3 days for the rules engine plus a daily cron and a `installation_nudges` table) | M, T | Needs O1 to be useful. The bones exist in `installation_alerts` already; add a writer that takes (telemetry, weather, baseline) and writes an alert plus a push. |
| O3 | Push notifications via the PWA-Capacitor shell | Medium. The shell exists; the capability is unwired | S (one to two days to add the Capacitor Push Notifications plugin and wire to a `device_tokens` table) | T | The notification design matters more than the plumbing. Three categories at most: fault, performance dip, service due. Anything more and the homeowner mutes the app. |
| O4 | RAG over homeowner-uploaded docs | Medium. "What does page 3 of my manual say" is a real homeowner question | M (3 to 5 days: ingest pipeline, pgvector index, a new tool on the chat) | M | The plumbing for documents exists in the Data Hub. The Care chat does not yet have a `search_my_documents` tool. |
| O5 | SEAI grant and home renovation tax credit status | Medium. The grant is the main commercial event around a heat pump install; the homeowner wants visibility | M (2 to 3 days: a `seai_grant_status` column already exists, surface it in the assistant) | T | Already partly modelled in the schema. The data is mostly absent. |
| O6 | Tariff awareness (Electric Ireland, Bord Gáis, Energia) | Medium. "Should I run the dryer now or wait for cheap rate" is a question only an integrated assistant can answer | L (each provider is bespoke; start with Electric Ireland's smart tariff API if available) | M | Long-term moat. Short-term, a manual `tariff_schedule` per homeowner gets you 80 percent of the value at 20 percent of the cost. |
| O7 | Year 2 to 5 lifecycle nudges | Medium. F-Gas service due at year 1, BER cert anniversary, warranty expiry, post-install survey | S (a service-due model + a cron) | T, F | Cheap. The kind of thing that makes a homeowner forward Care to a neighbour. |
| O8 | "Share with a neighbour" moment | Medium. Built into the post-install milestone (first month's report, year 1 anniversary) | S | F | The natural place to mint an installer referral is when the homeowner is most pleased. Year 1 anniversary report with a one-click neighbour referral is the right shape. |

### For the installer

| ID | Opportunity | User value | Build | Fit | Notes |
|---|---|---|---|---|---|
| I1 | Huawei FusionSolar Northbound integration | High. SE Systems' fleet is Huawei. Without this, the intelligence chat answers fleet questions from stale `installations` rows | L (8 to 12 days incl. credential vault, retry, fleet sync cron) | I, M | This is the integration. It is the gating dependency for almost every other installer-side opportunity. |
| I2 | Daikin ONECTA developer tier | High. Heat pump telemetry is the second leg | L | I, M | Same shape as I1, second priority because Huawei volume is higher. |
| I3 | Fleet-wide fault-pattern view | High. "Which inverter model has the highest fault rate this quarter" is a question the principal asks; the technician benefits from the answer | M (3 to 5 days, sits on top of I1 / I2) | M | Existing `get_diagnostics_summary` tool does this in chat. The dashboard surfacing is missing. |
| I4 | Mobile-first technician flow | High. Today's dashboard is desktop-first. A technician in a van wants schedule, today's jobs, capture photos, mark complete | M (4 to 6 days: a `/care-dashboard/today` route with job, address, contact, capture, complete) | T | The Capacitor shell could host this. The data shape mostly exists in `service_bookings` and `service_records`. |
| I5 | SEAI grant administration | Medium. SE Systems handles all grant applications via One Stop Shop today; the paperwork loop is real manual work | M (3 to 5 days: a workflow inside Smart Archive; SEAI does not have an API so this is intake plus tracking) | T, F | Removes pain. The flywheel angle: a developer who sees Care handling grant admin for SE Systems wants the same for their post-completion handover. |
| I6 | Warranty claim workflow | Medium. Currently spreadsheet plus email | M (3 to 5 days: state machine on top of existing tables) | T | The `service_records.warranty_validated` flag is there waiting. |
| I7 | Monthly principal report | Medium. Jason Collins, Derrick Enright want a one-page monthly view today | S (1 to 2 days: a fixed Markdown template + a job that emails it) | T | Easy win. The data exists. |
| I8 | Stripe / SumUp invoicing | Medium. Removes the "log into another app to bill" step | M | I | Most installers already have an accounts package; the value is a one-click "convert this job to an invoice" not a full invoicing module. |
| I9 | Xero / Bullet sync | Medium. Same logic | M | I | Pair with I8. |
| I10 | Twilio SMS for service reminders | Medium. SMS hits 98 percent open rates in Ireland; email hits 25 percent | S | T | Cheap. Needs O3-style category discipline so SMS doesn't become noise. |
| I11 | The installer-to-developer introduction moment | High strategically | M (a "refer a developer" tile on the dashboard that only appears after a positive net-promoter signal, e.g. after a homeowner gives 5/5 on a service visit, or after a milestone like 50 installs adopted into Care) | F | The ask has to feel earned. The mechanism is not a button on the dashboard, it is a context-aware tile that appears when the installer is mid-flow on something that proves Care is working for them. |

### Cross-cutting

| ID | Opportunity | Notes |
|---|---|---|
| X1 | Shared document Q&A service (Care homeowner docs, Agent compliance docs, Developer scheme docs) | Same RAG plumbing, different scopes. Today only Agent has it. Care, Developer, and Care should share one ingestion pipeline and one `match_document_sections` RPC. |
| X2 | Shared comms drawer pattern | Agent has a draft-first comms drawer. Care's draft-first model is the same shape but the UI is missing (C010). Lift the Agent pattern into Care. |
| X3 | Shared compliance scoring | Once Care has BER, F-Gas, and SEAI in one place per installation, a "compliance score" per install is a natural derived view. The same shape works for the Developer scheme. |
| X4 | Aggregate fleet insights as a data product | At 100 installs per installer, fault patterns by inverter model become noisy. At 10,000 across the platform, they are the most useful number in the Irish renewable industry. This is the data moat. The product is a benchmarking report shown only inside the installer dashboard; the asset is the underlying dataset and the editorial that gives it Irish context (BER bands, county, install year). |
| X5 | An AI-native version of the product | The version a competitor cannot copy is the one where the assistant has read every install document, every service record, every telemetry stream, and proactively writes the next service appointment into the technician's calendar. Today Care has the bones for this. The missing piece is integration depth (O1, I1, I2) plus the proactive nudge engine (O2). The chatbot framing is the entry point; the moat is the data and the proactivity. |

---

## 8. Recommended next sprint

Care launch readiness, Batch 1. Eight items, ranked. Each one has a drop-in Claude Code prompt at the end.

The first six items are the P0 closure. The remaining two address the P1s that most directly erode trust on a homeowner's first session.

### Batch 1.1: Build the shared route helper and apply it to the P0 endpoints
Closes C001, C002, C003, C004, C013, C022 by structural change.

Add a helper at `apps/unified-portal/lib/care/require-care-session.ts`:
- `requireCareSession(installationId)` returns `{ session, installation }` with `installation.tenant_id === session.tenantId` enforced.
- For homeowner endpoints, the helper also accepts an access-code-resolved installation id and resolves the session from a homeowner JWT (design decision: do homeowners get a tenant claim, or a per-installation claim).
- Apply the helper to: `installations/[id]/route.ts` GET and PUT, `chat/route.ts` POST, `conversations/route.ts` GET, `telemetry/[installationId]/route.ts` GET, `support-queries/route.ts` GET. Remove the `INSTALLER_NAME = 'SE Systems'` literal at `intelligence/chat/route.ts:22` and use `session.tenantId` instead in every tool's WHERE.

Effort: M. Risk: medium, but the right risk to take; closes six P0/P1s with one design choice.

Claude Code prompt:
```
Create apps/unified-portal/lib/care/require-care-session.ts that exports
requireCareSession(installationId: string): Promise<{ session, installation }>.
The helper must:
- Call requireSession() from lib/supabase-server to obtain the authenticated session.
- Fetch the installation row using the service-role client, filtered by both
  id = installationId AND tenant_id = session.tenantId.
- Return 404-equivalent (throw a typed error the route handlers catch as a 404)
  if the installation does not exist or does not belong to the session tenant.
- Return the installation row plus the session.

Then update every route in this list to use the helper at the top of the handler
and remove their direct .from('installations').select(...).eq('id', ...) calls:
- app/api/care/installations/[id]/route.ts (GET and PUT)
- app/api/care/chat/route.ts (POST)
- app/api/care/conversations/route.ts (GET)
- app/api/care/telemetry/[installationId]/route.ts (GET)
- app/api/care/support-queries/route.ts (GET)

In app/api/care/intelligence/chat/route.ts:
- Remove the INSTALLER_NAME = 'SE Systems' literal at line 22.
- In every tool implementation that filters .eq('installer_name', INSTALLER_NAME),
  change to .eq('tenant_id', session.tenantId). The helper is not directly
  applicable here because there is no installationId scope; resolve the session
  at the top of the route and pass session.tenantId into the tool executor.

Run npm run typecheck after each file change and fix any errors before moving on.
Do not commit until all routes are updated and typecheck passes.
```

### Batch 1.2: Cross-installation conversation guard (C002)
This is partly covered by 1.1, but the conversation_id check is its own line. In `chat/route.ts:429-441`, before loading history, verify the conversation belongs to the installation.

Claude Code prompt:
```
In apps/unified-portal/app/api/care/chat/route.ts, before the history-loading
coroutine at line 429, add a verification step:

const { data: convo } = await supabase
  .from('care_conversations')
  .select('id')
  .eq('id', conversation_id)
  .eq('installation_id', installationId)
  .maybeSingle();

if (conversation_id && !convo) {
  return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
}

Then in the history-loading branch, use convo.id rather than the raw
conversation_id from the request body.

Run npm run typecheck and verify the route still streams correctly on a clean
request path.
```

### Batch 1.3: Lock down the access-code endpoint (C005)
Add per-IP rate limiting and structured logging.

Claude Code prompt:
```
In apps/unified-portal/app/api/care/access/route.ts:

1. Add a per-IP rate limit map (max 5 attempts per minute). Use the same
   shape as the rate limiter in app/api/care/chat/route.ts so we have one
   pattern in the codebase.
2. Extract the client IP from x-forwarded-for or x-real-ip.
3. On a failed lookup, log the IP and the first two characters of the
   attempted code (full code is sensitive) to console.warn with a stable
   tag like [ACCESS_CODE_FAILURE].
4. On a successful lookup, log [ACCESS_CODE_SUCCESS] with the IP and the
   installation id.
5. Return 429 with a friendly message after the rate limit is exceeded.

Open a follow-up issue (not part of this change) to migrate the access-code
mechanism to a magic-link plus SMS second factor.
```

### Batch 1.4: Gate the seed endpoint (C006)
Smallest possible patch.

Claude Code prompt:
```
In apps/unified-portal/app/api/care/seed/route.ts:

1. At the very top of POST, return 403 if process.env.NODE_ENV === 'production'.
2. Then call requireRole(['admin']) (the same helper used elsewhere in the
   codebase) and return 403 if it throws.
3. After the seed completes, insert an audit row with the caller's email and
   the timestamp. Use audit_log if it exists, otherwise console.info with a
   stable tag.

Verify in dev that the endpoint still seeds the demo data when called with an
admin session.
```

### Batch 1.5: Plug the upload MIME bypass (C007)
One-line guard plus a magic-bytes check.

Claude Code prompt:
```
In apps/unified-portal/app/api/care-dashboard/archive/upload/route.ts at line 57:

Replace:
  if (file.type && !ALLOWED_MIME.has(file.type)) return bad('Type not allowed');

With:
  if (!file.type || !ALLOWED_MIME.has(file.type)) return bad('File type required');

Then add a magic-bytes check on the first four bytes of the file content.
Accept only:
- %PDF (0x25 0x50 0x44 0x46) for application/pdf
- 0xFF 0xD8 0xFF for image/jpeg
- 0x89 PNG (0x89 0x50 0x4E 0x47) for image/png

If the declared MIME does not match the magic bytes, reject with 400.

Apply the same fix to app/api/care/third-party/upload-init and
upload-complete if they also accept files (verify by reading both files).
```

### Batch 1.6: Add policies to the orphan-RLS tables and encrypt telemetry keys (C008, C009)
Two SQL migrations.

Claude Code prompt:
```
Create apps/unified-portal/migrations/042_care_rls_and_secrets.sql with:

1. CREATE POLICY service_records_service_role ON service_records FOR ALL
   TO service_role USING (true) WITH CHECK (true);
   (and the same for safety_alerts and service_bookings)

2. A column rename in two steps to encrypt installations.telemetry_api_key:
   - ALTER TABLE installations ADD COLUMN telemetry_api_key_encrypted text;
   - Document (in the migration comments) that a follow-up script must
     iterate the existing plaintext keys, encrypt them via
     lib/integrations/security/token-encryption.ts, and write into
     telemetry_api_key_encrypted, then drop the plaintext column in 043.

Do not drop the plaintext column in this migration. Once 043 ships, update
app/api/care/installations/[id]/route.ts to read the encrypted column,
decrypt at the route, and the comment "decrypted in production" at line 62
becomes load-bearing rather than aspirational.
```

Also worth doing in this batch: drop the FK gap (C014) by adding `REFERENCES tenants(id) ON DELETE CASCADE` to `care_third_party_uploads.installer_tenant_id`. Cheap and easy.

### Batch 1.7: Draft confirmation UI for service requests (C010)
The highest-leverage trust fix on the homeowner side.

Claude Code prompt:
```
This change touches both backend and frontend.

Backend (apps/unified-portal/app/api/care/chat/route.ts):

1. Add a new tool definition `send_service_request` with one parameter
   `draft_id: string`. Its description must say: "Call this only after the
   homeowner has confirmed they want to send the draft. The UI surfaces a
   Send button; the homeowner presses it; you receive a follow-up user
   message including the draft_id."
2. Implement the tool: validate the draft id belongs to the current
   installation (use the requireCareSession helper from Batch 1.1), then
   transition the draft to status='sent' and call the existing notification
   path (or stub it if not present).
3. Persist drafts to a new table `service_request_drafts` (id, installation_id,
   subject, description, urgency, created_at, status, sent_at). Add the
   migration.

Frontend (apps/unified-portal/app/care/[installationId]/screens/AssistantScreen.tsx):

1. Add a DraftServiceRequestCard component. Inputs are the draft's structured
   data; outputs are an editable subject, description, and urgency, plus a
   "Confirm and send" button.
2. In the message rendering loop, branch on msg.message_type ===
   'service_request_draft' and render the card.
3. The Send button posts a follow-up message to /api/care/chat with text
   like "send service request &lt;draft_id&gt;". The model then calls
   send_service_request with that id.

Run npm run typecheck and verify the round trip in a dev environment if
possible.
```

### Batch 1.8: Stream resilience + SolarEdge timeout (C011, C012)
Two related fixes, one batch.

Claude Code prompt:
```
1. In apps/unified-portal/lib/care/solarEdgeApi.ts, wrap both fetch calls in
   Promise.race([fetch, timeout(5000)]). On timeout, throw a typed error.
   The caller in installations/[id]/route.ts already falls back to mock data
   on error; verify the fall-through still works.

2. In apps/unified-portal/app/api/care/chat/route.ts, change the
   fire-and-forget care_messages insert at lines 680-696 to:
   - Track a streamCompleted flag set to true only on clean completion.
   - Move the insert into the success branch; do not insert on abort.
   - On abort, emit an SSE event of type 'error' with payload {
     incomplete: true } and close the controller.

3. In apps/unified-portal/app/care/[installationId]/screens/AssistantScreen.tsx,
   handle the 'error' SSE event with incomplete: true by clearing the
   stream buffer and pushing a one-line message: "Connection lost. Your
   message was not saved. Please retry." Do not push the partial text into
   the assistant message list.

Run npm run typecheck and verify with a manual network interruption if
possible.
```

---

## Appendix: methodology notes

- `npm install` was run in this session; took several minutes; one Vercel-specific dependency printed deprecation warnings but resolved.
- `npm run typecheck` (which runs `tsc --noEmit` in `apps/unified-portal`) exits 0.
- `npm run build` was not run. The user did not ask for it and the typecheck is the cheaper signal for an audit.
- Three P0 claims were verified by direct source read (`installations/[id]/route.ts`, `access/route.ts`, `chat/route.ts`). The other four P0s rely on the Part 2 stress-test agent's reading and are cited with file:line so anyone can cross-check.
- The agent-derived fix snippets in `CARE_AUDIT_PART2_3.md` reference helpers and tables that may not exist in the repo (`installation_access`, `requireRole`, `installation_audit_log`). Treat them as direction, not drop-in. The Batch 1 prompts above are written to use helpers I have either confirmed exist or am explicitly creating.

End of consolidated audit.
