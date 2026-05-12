# OpenHouse Care — Parts 2 & 3: Stress-Test Findings

Working branch: `claude/stress-test-audit-6amPY`
Date: 2026-05-12
Method: static analysis + targeted code review (no live browser, no live Supabase access). `npm run typecheck` passes (exit 0). P0 claims spot-checked against source before publishing.

## How to read this document

Findings are scenario-led, not file-led, because the user impact is what matters. Each finding gives: what was tried, what the code does (with `file:line` citations and verbatim snippets where they earn their space), expected vs actual behaviour, severity, and a concrete fix direction. Some agent-derived fix snippets assume helper tables or middleware that may not exist in the repo (e.g. an `installation_access` table); take those as direction, not drop-in code.

Severity: P0 erodes trust on day one or breaches data, P1 ships-stopper, P2 polish, P3 nice-to-have.

---

# Part 2 — Installer dashboard

## 2.1 Cross-tenant installation read and update (P0) — verified

**Scenario.** Logged in as SE Systems, guess or otherwise obtain a Solas Renewables installation ID and hit `GET /api/care/installations/{id}`.

**Code.** `apps/unified-portal/app/api/care/installations/[id]/route.ts:22-156`. The handler imports `getSupabaseAdmin()` (service role), accepts the `id` from the URL, and runs `select('*').eq('id', installationId).single()` with no session check and no `tenant_id` filter. The PUT handler is structurally identical — `allowedFields` are limited to `adoption_status`, `adopted_at`, `notes`, `homeowner_email`, `component_specs`, but the row scoping is the same: any caller with the UUID can change another tenant's installation.

**Expected vs actual.** Cross-tenant access should 404 (preferred to 403 to avoid existence enumeration). Today, the row is returned in full plus its alerts and a SolarEdge telemetry blob.

**Severity.** **P0**. Reads customer PII (name, email, full address, telemetry credentials structure) across tenant boundaries. Writes mutate adoption state.

**Fix direction.** Wrap both handlers in `requireSession()` and add `.eq('tenant_id', session.tenantId)` to the WHERE. Same pattern for PUT. Consider returning 404 (not 403) on tenant mismatch.

## 2.2 Unauthed support-queries endpoint leaks all tenants (P0)

**Scenario.** Any caller, authenticated or not, hits `GET /api/care/support-queries`.

**Code.** `apps/unified-portal/app/api/care/support-queries/route.ts:14-59` (per Part 2 agent inventory). Service-role client, no `tenant_id` filter on the WHERE, no session check.

**Expected vs actual.** Should return only the caller's tenant's tickets. Today it returns every installer's support queue.

**Severity.** **P0**. Multi-tenant breach of customer issue text. The fact that the support queue UI page is the consumer doesn't matter — the API is the boundary.

**Fix direction.** Same as 2.1: `requireSession()` plus `tenant_id` filter on the query.

## 2.3 Seed endpoint accessible without auth or env gating (P0)

**Scenario.** `POST /api/care/seed` from any client.

**Code.** `apps/unified-portal/app/api/care/seed/route.ts:72`. No `requireRole`, no `process.env.NODE_ENV` check.

**Expected vs actual.** Demo seed should be unreachable in production and admin-only in any environment. Today it can be invoked by anyone with network access to the Vercel deployment, mass-inserting demo installations.

**Severity.** **P0** if it ever runs in production. Even in staging, the lack of an audit row for who triggered it is a problem.

**Fix direction.** Guard with `if (process.env.NODE_ENV === 'production') return 403` plus `requireRole(['admin'])`. Log every invocation to `audit_log` (or similar) with the caller identity.

## 2.4 Archive upload accepts files with empty MIME (P0)

**Scenario.** Upload a binary with no Content-Type header.

**Code.** `apps/unified-portal/app/api/care-dashboard/archive/upload/route.ts:13-77`. MIME allowlist exists but the check is `if (file.type && !ALLOWED_MIME.has(file.type))` — when `file.type` is empty string, the check is skipped and the file is stored under the tenant/installation path. The filename is sanitised (`replace(/[^a-z0-9._-]/gi, '-')`) so storage-path traversal is not an issue, but the file content is not validated.

**Expected vs actual.** Empty MIME should be rejected (or magic-bytes verified). Today an `.exe` or `.sh` masquerading as a no-MIME upload is stored in the bucket.

**Severity.** **P0** if the bucket is public or fetched without `Content-Disposition: attachment`. **P1** if the bucket is private and only fetched via signed URLs that force download.

**Fix direction.** `if (!file.type || !ALLOWED_MIME.has(file.type)) return bad('File type required')`. Optionally validate the first four bytes against PDF/JPEG/PNG magic numbers.

## 2.5 No role gating on routes (P1)

**Scenario.** A technician in an installer tenant calls a privileged endpoint (seed, brand update, installation deletion if added later).

**Code.** Session does include `role` (`lib/supabase-server.ts:181` per Part 2 agent). But no route handler in `app/api/care/*` calls `requireRole(['admin'])`. Every authenticated user on a tenant has full access to every Care endpoint scoped to that tenant.

**Expected vs actual.** Brand updates, seed, telemetry credential edits, installation archiving should be admin-only. Today they are tenant-wide.

**Severity.** **P1**. Privilege escalation within a tenant. Not a cross-tenant breach, but a real problem once SE Systems has a field tech account that should be view-only.

**Fix direction.** Audit each route. The minimum cut: gate `POST /api/care/seed`, `POST/PUT /api/care-dashboard/brand`, and any mutating endpoint that touches credentials or branding.

## 2.6 No input validation on installation onboarding (P1)

**Scenario.** Direct API POST with: future `install_date`, negative `warranty_years`, malformed Eircode, `warranty_expiry` before `install_date`.

**Code.** `apps/unified-portal/app/api/care/installations/onboard/route.ts:41-46` checks only for empty required fields. The frontend form enforces `min/max` on `warranty_years` but the API does not.

**Expected vs actual.** Reject impossible dates, validate Eircode pattern (Irish routing key `[ACDEFHKNPRTVWXY][0-9]{2}` plus space plus four chars), reject negative warranty.

**Severity.** **P1**. Data integrity. Dashboards will show negative warranty expiries and future installs; intelligence chat will reason over nonsense.

**Fix direction.** Add server-side validation: install_date in the past, warranty_expiry > install_date, warranty_years in [1, 25], optional Eircode regex.

## 2.7 No pagination on `installations-all` (P1)

**Scenario.** SE Systems hits 2,000 installations.

**Code.** `apps/unified-portal/app/api/care/installations-all/route.ts:33-47` does `select('*')` with no `range()`. PostgREST hard-caps at 1,000 rows by default.

**Expected vs actual.** Pagination with `limit` + `offset`, returning `total` count for UI. Today rows past 1,000 silently disappear or the request errors.

**Severity.** **P1**. Quiet truncation is worse than a loud error.

**Fix direction.** Wrap in `range(offset, offset + limit - 1)` with `count: 'exact'`. Cap `limit` at 500.

## 2.8 No audit trail on installation updates (P1)

**Scenario.** Two admins both edit `adoption_status` on the same installation in different tabs.

**Code.** `apps/unified-portal/app/api/care/installations/[id]/route.ts:117-156`. The PUT writes filtered fields with no `updated_by`, no version check, no concurrency protection.

**Expected vs actual.** Last-write-wins is acceptable, but the absence of an audit row (who, when, what fields changed, previous values) is not. Conflict detection (etag or `updated_at` version) would be a nice-to-have but the audit trail is the hard requirement.

**Severity.** **P1**. Once SE Systems has more than one admin user, blame analysis is impossible.

**Fix direction.** Insert into an `installation_audit_log` table on every successful update with `installation_id`, `updated_by`, `updated_at`, JSON `changes`. Optional: include the previous values for delta inspection.

## 2.9 PII in `intelligence_interactions` logging (P1)

**Scenario.** An installer asks "Show me John Smith's contact details for job SE-2025-001" in the intelligence chat. Both the query and the response (with customer name, address, phone, email) are written to the `intelligence_interactions` table.

**Code.** `apps/unified-portal/app/api/care/intelligence/chat/route.ts:625-633`. `query_text: message` and `response_text: fullResponse` are stored as-is.

**Expected vs actual.** Either redact PII before insert, or store only the tool call summary plus a hash of the response, or move this table to a tighter access ring.

**Severity.** **P1**. The log is a secondary store of customer PII with no clear retention or access controls visible from the code.

**Fix direction.** At minimum, do not store `response_text`. Better: store tool name + args summary, time, model, latency, tokens.

## 2.10 Public `lookup-job` endpoint shape risks enumeration (P2)

**Scenario.** Iterate `jobReference` values against `POST /api/care/third-party/lookup-job`.

**Code.** `apps/unified-portal/app/api/care/third-party/lookup-job/route.ts:13-26`. Currently a stub that always returns `{ matched: false }`. Real lookup is not wired yet.

**Expected vs actual.** Once real lookup lands, timing or response shape will leak which references exist. Even today, the public endpoint should be rate-limited.

**Severity.** **P2** today, becomes **P1** when real lookup is wired without timing-safe response.

**Fix direction.** Constant-time response with a fixed delay floor (200 ms). Per-IP rate limit on the endpoint. If the real lookup needs to be public for installer-side use, consider replacing it with a magic-link-style flow.

## 2.11 Filter state not in URL (P2)

**Scenario.** Filter the fleet list, click into a detail, click back.

**Code.** `app/care-dashboard/installations/page.tsx:63-109`. Filter state is `useState` only; no `useSearchParams` rehydration. Deep links lose state.

**Severity.** **P2**.

**Fix direction.** Persist filters via `router.push('?statusFilter=...&typeFilter=...')` and rehydrate from `searchParams` on mount.

## 2.12 Intelligence chat streaming has no client-disconnect detection (P2)

**Scenario.** Installer closes the tab mid-response.

**Code.** `apps/unified-portal/app/api/care/intelligence/chat/route.ts:554-652`. The ReadableStream controller does not check abort signal; OpenAI stream consumes the full response and burns tokens.

**Severity.** **P2**. Cost rather than security.

**Fix direction.** Pipe the `AbortSignal` from `request.signal` into the OpenAI stream and `break` the loop when aborted.

## 2.13 `installer_name` hardcode is a future scaling trap (P2)

**Code.** `apps/unified-portal/app/api/care/intelligence/chat/route.ts:22`. `const INSTALLER_NAME = 'SE Systems'`. The Part 2 agent verified every tool implementation applies this filter, so the boundary is consistent today. The risk is the day a second installer lands and someone forgets to update one of the seven tool queries. Worse, the filter is a string match against a free-text column, not a tenant ID — typos in the seed data ("Se Systems", "SESystems") would silently include or exclude rows.

**Severity.** **P2** today, **P1** the moment a second installer onboards.

**Fix direction.** Resolve the installer from `session.tenantId` and filter `installations.tenant_id = session.tenantId` in every tool. Drop `installer_name` as a security boundary.

---

# Part 3 — Homeowner Care assistant

## 3.1 Cross-installation chat history leak (P0) — verified

**Scenario.** Authenticated as homeowner A, POST to `/api/care/chat` with `installationId: A` and `conversation_id: B` (a conversation belonging to installation B).

**Code.** `apps/unified-portal/app/api/care/chat/route.ts:357-441`. Service-role client. The history-load coroutine at lines 429-441 does `eq('conversation_id', conversation_id)` only — there is no check that the conversation belongs to the installation, no check that the caller owns either, and no auth check at the top of the handler. The history is then loaded into `contextMessages` and fed to the model.

**Expected vs actual.** Should 403 if the conversation does not belong to the installation. Today the victim's prior chat is injected into A's model context. A could ask "what did we discuss?" and the model would reproduce B's history.

**Severity.** **P0**. Direct cross-tenant PII path through a model rather than a database read, which is harder to detect in logs.

**Fix direction.**
```
const { data: convo } = await supabase
  .from('care_conversations')
  .select('id, installation_id')
  .eq('id', conversation_id)
  .eq('installation_id', installationId)
  .single();
if (!convo) return 403;
```
Also add a session check at the top of the route and verify the session owns `installationId`.

## 3.2 No ownership check on installationId in chat (P0)

**Scenario.** Same route, more general case. The handler accepts `installationId` from the request body with no proof the caller owns it.

**Code.** Same file as 3.1, lines 357-382. No `requireSession()`, no JWT check, no row-level check.

**Expected vs actual.** Should require an authenticated session and verify the session principal has access to `installationId`. Today an attacker who knows or guesses an installation UUID can query the model in that installation's context.

**Severity.** **P0**.

**Fix direction.** Same pattern as the schema/RLS recommendations in Part 1 plus the cross-installation guard in 3.1.

## 3.3 Telemetry route has no ownership check (P0)

**Scenario.** `GET /api/care/telemetry/{any-installation-id}`.

**Code.** `apps/unified-portal/app/api/care/telemetry/[installationId]/route.ts:15-30`. Service-role client. No session check. Returns full telemetry plus a leaked view of `telemetry_api_key` presence (existence inferred via response shape if the upstream is reached vs mock returns).

**Severity.** **P0**. Telemetry includes generation, status, possibly inverter serial and recent alerts.

**Fix direction.** Session check plus tenant scoping.

## 3.4 Access-code endpoint has no rate limit and no logging (P0) — verified

**Scenario.** Brute-force `access_code` against `POST /api/care/access`.

**Code.** `apps/unified-portal/app/api/care/access/route.ts:14-35`. Verbatim:
```
const { code } = await req.json();
if (!code || typeof code !== 'string') return 400;
const { data: installation, error } = await supabase
  .from('installations')
  .select('id, system_type, system_model')
  .eq('access_code', code.trim().toUpperCase())
  .eq('is_active', true)
  .single();
if (error || !installation) return 404;
return { installationId: installation.id };
```
No rate limit. No IP throttle. No logging. The access code length and entropy are not enforced anywhere visible — they appear to be set in seed data.

**Expected vs actual.** Per-IP and per-code rate limiting. Log failed attempts. Treat the code as a bearer secret with cooldown on misses.

**Severity.** **P0**. Whole-fleet enumeration risk depending on code entropy.

**Fix direction.** Rate-limit module keyed by IP (and by code prefix to prevent per-IP rotation attacks). Log to `audit_log`. Long-term: replace bare access code with magic-link plus a second factor.

## 3.5 Honest intent routing — backend is OK, UI has a gap (P1)

**Scenario.** Homeowner says "Log a fault with my inverter, E3 error, red light."

**Code.**
- Tool definition `apps/unified-portal/app/api/care/chat/route.ts:120-122`: name is `draft_service_request`, description says "Always show the draft first before confirming it is sent."
- Tool implementation lines 332-345: returns `{ service_request_draft: { ... sent: false } }`. The route streams a structured rich-message back to the client.
- System prompt lines 522-561: includes the "show draft first" rule.

The naming and structure are correct: the model is told it produced a draft, not a sent message. The Part 3 agent traced the AssistantScreen render path and found no dedicated handler for `message_type: 'service_request_draft'` — the draft arrives in `richMessages` (route.ts:625-632) but is not rendered with an editable form or a confirm-and-send button (`AssistantScreen.tsx:289-293` falls through to the default text bubble).

**Expected vs actual.** Homeowner sees an editable draft card with a "Confirm and send" button. Today the draft is rendered as plain assistant text or dropped, depending on which branch of the render takes over, and there is no send action.

**Severity.** **P1**. The backend is correct, the UI is incomplete. The user will type "yes send it" and the model may comply by claiming it was sent without any action being taken — exactly the anti-pattern flagged in the task description.

**Fix direction.** Add a `DraftServiceRequestCard` component keyed off `message_type === 'service_request_draft'`. Add a separate `send_service_request` tool that the UI triggers by sending a new structured message back. Persist the draft state to a `service_request_drafts` table so the model can reference a draft ID rather than the prose.

## 3.6 Partial assistant message persists on stream interruption (P1)

**Scenario.** Network drops mid-stream.

**Code.**
- Backend `apps/unified-portal/app/api/care/chat/route.ts:680-696`: fire-and-forget `care_messages.insert` writes `assistantContent` (the accumulated text so far) on stream completion. There is no distinction between clean completion and abort.
- Frontend `app/care/[installationId]/screens/AssistantScreen.tsx:253-307`: reads `done` from the stream and pushes whatever `fullText` accumulated into the message list. The `else` branch only fires on completely empty content.

**Expected vs actual.** Should detect partial completion, either rolling back the DB write or marking it `is_partial: true`, and surface a "connection dropped" indicator in the UI. Today the homeowner sees the half-sentence as if it were a complete answer, and so does the next session that loads conversation history.

**Severity.** **P1**. Trust erodes the first time someone tries to act on a truncated instruction.

**Fix direction.** Track a `streamCompleted` flag, only insert on completion, emit an `error` SSE event on `catch`, and clear the buffer in the client when the error event arrives.

## 3.7 SolarEdge fetch has no timeout (P1)

**Code.** `apps/unified-portal/lib/care/solarEdgeApi.ts:43-74`. Two sequential `fetch` calls with no `AbortController` or timeout.

**Severity.** **P1**. If SolarEdge slows to 30s, every homeowner chat that calls `get_system_status` on a solar install blocks for 30s. Vercel's 60s function ceiling catches it eventually, but the UX is broken long before.

**Fix direction.** Wrap both fetches in `Promise.race([fetch, timeout(5000)])`. On timeout, fall through to the mock generator with `isMockData: true` so downstream tools can disclaim.

## 3.8 Conversations list endpoint allows installation enumeration (P1)

**Code.** `apps/unified-portal/app/api/care/conversations/route.ts:14-28`. Accepts `installation_id` from query string, no session check, returns the conversation list. Iterating UUIDs gives an attacker a who-has-active-conversations map.

**Severity.** **P1**.

**Fix direction.** Session check plus ownership check.

## 3.9 System prompt allows fallback to model training data (P2)

**Code.** Last bullet of the rules block, `app/api/care/chat/route.ts:556-561`: "If the KB doesn't cover it, use your own knowledge but be clear it's general guidance." Combined with the "Never answer troubleshooting from training data" rule earlier, the wording is internally contradictory. The model will resolve the contradiction by leaning on training data for anything not flagged "fault" or "error code".

**Expected vs actual.** Strict KB-only mode for system-specific questions, with an explicit "contact your installer" exit when the KB doesn't cover it. Today the model can confidently fabricate cost figures, COP norms, or tariff numbers.

**Severity.** **P2**. The damage is trust erosion when a homeowner repeats an invented figure to their installer.

**Fix direction.** Reword the rule to forbid training-data answers for any system-specific or commercial figures, and give the model a clean exit phrase ("I'm not sure, best to ask SE Systems on 01 234 5678").

## 3.10 Rate-limit 429 surfaces as generic error (P2)

**Code.** `app/care/[installationId]/screens/AssistantScreen.tsx:240-249`. The fetch catch block always renders "Sorry, something went wrong." The backend at `app/api/care/chat/route.ts:34-45` does return a clear 429 JSON, the client just doesn't read the status.

**Severity.** **P2**.

**Fix direction.** Check `res.status === 429` before throwing and surface a specific "you're sending messages too quickly" message.

## 3.11 Demo data fallback masks data-quality bugs (P2)

**Code.** `app/api/care/chat/route.ts:384-409`. If `dbInstallation` is null, the route falls back to a hardcoded Mary Murphy installation with specific specs, a real-looking job reference, and SE Systems as the installer. Any real installation lookup that fails silently (RLS denial, typo in id, missing row) yields this fallback rather than an error.

**Severity.** **P2**. Hides bugs and lets the assistant answer for an installation that doesn't exist.

**Fix direction.** In non-demo paths, return 404. Gate the demo fallback behind an explicit `demo=true` query param or `installationId === 'demo'` literal.

## 3.12 Em dashes everywhere in homeowner-visible text (P3)

**Count.** 24 instances in `app/api/care/chat/route.ts` (system prompt and tool descriptions), 112+ in `lib/care/care-knowledge.ts`. Brand guideline says no em dashes.

**Severity.** **P3**, but cumulative — the assistant reads as AI-generated.

**Fix direction.** Find-replace pass on the KB and system prompt: em dash to comma, semicolon, or full stop depending on context. Re-read for cadence; do not just sed.

## 3.13 Clinical / textbook tone in KB (P3)

**Examples.**
- `lib/care/care-knowledge.ts:31-40`: "Solar panels (photovoltaic or PV) convert sunlight into direct current (DC) electricity. An inverter converts this to alternating current (AC)..." reads as a textbook.
- `lib/care/care-knowledge.ts:250-251`: "Heat pumps are significantly cheaper to run than gas boilers for well-insulated homes, despite using electricity (which costs more per unit than gas)" is awkward parenthetical-heavy phrasing.
- `app/api/care/chat/route.ts:532` system prompt line: "Homeowners may be anxious about technical issues" is clinical.

**Severity.** **P3**.

**Fix direction.** Pass the KB through a copy-editor with a clear brief: Irish, understated, written for a homeowner not a colleague. Cut the parentheticals.

---

# Combined top-10 issues across Parts 2 and 3

| # | Severity | Area | Issue | Where |
|---|---|---|---|---|
| 1 | P0 | Access | Chat route accepts `installationId` from body with no session check or ownership verification | `api/care/chat/route.ts:357-382` |
| 2 | P0 | Access | Conversation history loads by `conversation_id` only — cross-installation history bleed into model context | `api/care/chat/route.ts:429-441` |
| 3 | P0 | Access | Installation detail and update endpoints have no auth, no tenant filter, service-role client | `api/care/installations/[id]/route.ts:22-156` |
| 4 | P0 | Access | Telemetry endpoint has no ownership check | `api/care/telemetry/[installationId]/route.ts:15-30` |
| 5 | P0 | Access | Support-queries endpoint returns all tenants' tickets | `api/care/support-queries/route.ts:14-59` |
| 6 | P0 | Brute force | Access-code endpoint has no rate limit, no logging | `api/care/access/route.ts:14-35` |
| 7 | P0 | Operations | Seed endpoint unauthed and not gated to non-prod | `api/care/seed/route.ts:72` |
| 8 | P0 | Upload | Archive upload accepts files with empty MIME | `api/care-dashboard/archive/upload/route.ts:13-77` |
| 9 | P1 | Intent | Service-request draft has no UI confirmation form, no separate `send` tool | `api/care/chat/route.ts:120-345` + `screens/AssistantScreen.tsx:289-293` |
| 10 | P1 | Resilience | Partial assistant messages persist on stream cut without error to user | `api/care/chat/route.ts:680-696` + `screens/AssistantScreen.tsx:253-307` |

There are seven P0s. The unifying theme is that Care relies almost entirely on the service-role Supabase client and never re-verifies the session principal at the route boundary. A single shared `requireCareSession(installationId)` helper that returns the session and the installation row already scoped by tenant would close most of them in one change.

---

# Build / typecheck

`npm run typecheck` on `apps/unified-portal` exits 0. No new TS errors introduced by reading. Build was not run (typecheck is the cheaper signal for this audit and the user did not ask for a full Next build).

---

# Caveats on the agent-derived fix snippets

The two stress-test agents proposed specific fix snippets that reference helpers I did not verify exist in this repo:

- `requireSession()`, `requireRole(...)`, `getServerSessionWithStatus()` — referenced as if standard. They probably exist in `lib/supabase-server.ts` based on the inventory but I have not cross-checked every signature.
- `installation_access` table for homeowner-to-installation ownership — referenced in fix snippets but not in the schema audit. Likely needs to be designed before any of the homeowner ownership checks can be wired.
- `installation_audit_log` table — proposed but not present.

Treat the fix snippets as direction. The structural recommendation (auth at the route boundary plus row-level tenant scoping) is what matters; the helpers and tables will need design choices.

---

Pausing here for Part 4 direction.
