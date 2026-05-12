# OpenHouse Care — Part 1: Codebase & Data Audit

Working branch: `claude/stress-test-audit-6amPY`
Date: 2026-05-12
Scope: read-only inventory of the Care product surface area inside the OpenHouse monorepo.

---

## 0. P0 findings surfaced during inventory

Three issues are bad enough that they belong at the top, not buried in the final report.

### P0-1: Three Care tables have RLS enabled but zero policies

In `apps/unified-portal/migrations/009_heat_pump_fields.sql`, the tables `service_records`, `safety_alerts`, and `service_bookings` each get `ENABLE ROW LEVEL SECURITY` with no policy following. Under Postgres semantics this means the tables are inaccessible to every role except service role bypass holders, and even service role is only implicitly allowed because nothing explicitly denies it.

Concretely: if a request ever reaches these tables via the user JWT (which is the long-term goal of moving Care off blanket service-role access), every read and write returns zero rows or a permission error. Any installer dashboard feature that depends on service history, dismissable safety banners, or service bookings is currently fragile in a way the UI will not surface gracefully.

### P0-2: Telemetry API keys stored in plaintext

`installations.telemetry_api_key` (added in `apps/unified-portal/migrations/007_telemetry_tables.sql`) holds vendor API keys for SolarEdge, Fronius, Huawei FusionSolar, etc. in clear text. CLAUDE.md explicitly says to encrypt credentials via `lib/integrations/security/token-encryption.ts`. A DB dump, a logging accident, or a service-role leak exposes every installer's monitoring credentials, which in some vendor portals also include write capability against the fleet.

### P0-3: Duplicate Care schema across two migration directories

`installations` and `care_conversations` are defined in both `migrations/0005_care_installations.sql` and `apps/unified-portal/migrations/006_care_tables.sql`, with diverging columns and triggers. Because both files use `CREATE TABLE IF NOT EXISTS`, whichever runs first wins silently. The unified-portal version is missing the `updated_at` trigger that the root version installs. This means:

- A fresh deploy may not match the current Supabase state, depending on which directory was applied.
- The `updated_at` column on `installations` is not being maintained in production if the unified-portal migration won the race.
- Future schema changes risk being written against the wrong definition.

This is a stability and reproducibility risk, not just a tidy-up issue.

---

## 1. Routes and pages

### Homeowner portal (`/care/*`)

| URL | File |
|---|---|
| `/care` | `app/care/page.tsx` |
| `/care/select` | `app/care/select/page.tsx` |
| `/care/[installationId]` | `app/care/[installationId]/page.tsx` (+ `layout.tsx`, `care-app-provider.tsx`) |
| `/care/[installationId]/screens/HomeScreen` | `app/care/[installationId]/screens/HomeScreen.tsx` |
| `/care/[installationId]/screens/AssistantScreen` | `app/care/[installationId]/screens/AssistantScreen.tsx` — Mary Murphy AI chat |
| `/care/[installationId]/screens/GuidesScreen` | `app/care/[installationId]/screens/GuidesScreen.tsx` |
| `/care/[installationId]/screens/ProfileScreen` | `app/care/[installationId]/screens/ProfileScreen.tsx` |
| `/care/[installationId]/screens/ServiceScreen` | `app/care/[installationId]/screens/ServiceScreen.tsx` |
| `/care/[installationId]/screens/SystemScreen` | `app/care/[installationId]/screens/SystemScreen.tsx` |
| `/care/[installationId]/screens/HeatPumpHomeContent` | `app/care/[installationId]/screens/HeatPumpHomeContent.tsx` |
| `/care/[installationId]/screens/HeatPumpProfileContent` | `app/care/[installationId]/screens/HeatPumpProfileContent.tsx` |
| `/care/sesystems/upload` | `app/care/sesystems/upload/page.tsx` — public third-party upload form |

PWA: `app/care/sw-register.tsx` registers a service worker for the homeowner shell.

### Installer dashboard (`/care-dashboard/*`)

| URL | File |
|---|---|
| `/care-dashboard` | `app/care-dashboard/page.tsx` |
| `/care-dashboard/installations` | `app/care-dashboard/installations/page.tsx` |
| `/care-dashboard/installations/new` | `app/care-dashboard/installations/new/page.tsx` |
| `/care-dashboard/smart-archive/inbox` | `app/care-dashboard/smart-archive/inbox/page.tsx` |
| `/care-dashboard/archive` | `app/care-dashboard/archive/page.tsx` |
| `/care-dashboard/communications` | `app/care-dashboard/communications/page.tsx` |
| `/care-dashboard/diagnostics` | `app/care-dashboard/diagnostics/page.tsx` |
| `/care-dashboard/insights` | `app/care-dashboard/insights/page.tsx` |
| `/care-dashboard/intelligence` | `app/care-dashboard/intelligence/page.tsx` |
| `/care-dashboard/support-queue` | `app/care-dashboard/support-queue/page.tsx` |

---

## 2. API endpoints

### Homeowner-facing (`/api/care/*`)

| Method | URL | Notes |
|---|---|---|
| POST | `/api/care/chat` | Mary Murphy AI. `gpt-4o-mini`, streaming SSE with JSON fallback. Rate-limited 20 req/min per installation. |
| POST | `/api/care/access` | Access code -> installation resolution |
| POST | `/api/care/dismiss-alert` | Dismiss safety/health alerts |
| GET | `/api/care/conversations` | Conversation history |
| GET | `/api/care/content` | Static guides/help |
| GET | `/api/care/service-records` | Service history per install |
| POST | `/api/care/service-booking` | Request service appointment |
| GET | `/api/care/system-types` | Reference list |
| GET | `/api/care/telemetry/[installationId]` | Real-time generation/temps. External API call (SolarEdge). |
| GET | `/api/care/manifest/[id]` | Installation manifest export |
| GET | `/api/care/solar-troubleshooting` | KB lookup by error code |

### Installer-facing (`/api/care/*`, `/api/care-dashboard/*`)

| Method | URL | Notes |
|---|---|---|
| POST | `/api/care/intelligence/chat` | Installer AI. `gpt-4o-mini`, streaming NDJSON. Filtered by hardcoded `installer_name = 'SE Systems'`. |
| GET/POST | `/api/care/installations` | List + create installations |
| GET | `/api/care/installations/[id]` | Detail |
| POST | `/api/care/installations/onboard` | Onboarding flow |
| GET | `/api/care/installations-all` | Unscoped list — review for tenant leakage |
| GET | `/api/care/dashboard-stats` | Fleet KPIs |
| GET | `/api/care/activity-log` | Audit feed |
| GET | `/api/care/diagnostic-flows` | Flow patterns |
| GET | `/api/care/support-queries` | Tickets |
| GET | `/api/care/installer-content` | Branded content |
| POST | `/api/care/seed` | Demo seed — should be locked to non-prod |
| GET/POST | `/api/care-dashboard/brand` | Logo/name |
| GET/POST | `/api/care-dashboard/third-party` | Manage third-party uploads |
| GET/POST | `/api/care-dashboard/third-party/[id]` | Per-upload |
| POST | `/api/care-dashboard/archive/upload` | Authenticated installer upload |

### Third-party upload (Smart Archive)

| Method | URL | Notes |
|---|---|---|
| POST | `/api/care/third-party/upload-init` | Signed URL handshake |
| POST | `/api/care/third-party/upload-complete` | Persist metadata |
| GET | `/api/care/third-party/lookup-job` | Public job search by reference/address — review for enumeration |

---

## 3. Components

All under `components/care/`:

- `QuickUploadModal.tsx` — shared upload dialog
- `archive/` — Smart Archive inbox: `archive-header`, `archive-list`, `archive-list-row`, `filter-bar`, `inbox-pills`, `inbox-share-link`, `inbox-view`, `recently-accessed`, `smart-search-bar`, `submission-card`, `submission-detail`, `approve-confirm-modal`, plus `mock-data.ts`

There is no dedicated Care hooks directory; the homeowner portal relies on a single context provider, `app/care/[installationId]/care-app-provider.tsx`, with the rest using stock React + `next/navigation` + `@supabase/auth-helpers-nextjs`.

---

## 4. Server-side logic (`lib/care/`)

- `care-knowledge.ts` — generic renewable KB (~300 entries), injected into homeowner system prompt.
- `seSystemsKnowledge.ts` — installer-specific facts (Huawei SUN2000, FusionSolar, Mitsubishi heat pumps, Horizon Renewables contact). Overrides generic KB when `isSeSystemsInstallation()` matches.
- `irelandRenewableKnowledge.ts` — Irish baseline figures, SEAI grants, BER, F-Gas, MSS export tariffs.
- `solarTroubleshooting.ts` — error code + symptom matching across SolarEdge/Fronius/Huawei.
- `heatPumpTroubleshooting.ts` — E-codes, defrost, COP, flow temp.
- `solarEdgeApi.ts` — third-party telemetry fetch.
- `third-party.ts` — upload pipeline glue (signed URL, metadata persistence, installer notification).

---

## 5. Migrations

| File | Tables created / altered |
|---|---|
| `migrations/0005_care_installations.sql` | `installations`, `installation_telemetry`, `installation_alerts` (root, with `updated_at` trigger) — **duplicates unified-portal 006/007** |
| `migrations/0006_care_conversations.sql` | `care_conversations`, `care_messages` (root) — **duplicates unified-portal 006** |
| `migrations/0006_care_access_codes.sql` | adds `access_code` to `installations` |
| `apps/unified-portal/migrations/006_care_tables.sql` | `installations`, `care_conversations`, `care_messages` (active) |
| `apps/unified-portal/migrations/007_telemetry_tables.sql` | `installation_telemetry`, `installation_alerts` + telemetry columns on `installations` |
| `apps/unified-portal/migrations/008_care_dashboard_upgrade.sql` | `support_queries`, `diagnostic_flows` + `energy_generated_kwh`, `savings_eur` |
| `apps/unified-portal/migrations/009_heat_pump_fields.sql` | `service_records`, `safety_alerts`, `service_bookings` + heat pump columns on `installations` |
| `apps/unified-portal/migrations/039_care_third_party_uploads.sql` | `care_third_party_uploads` |
| `apps/unified-portal/migrations/040_seed_third_party_uploads.sql` | demo data |
| `apps/unified-portal/migrations/041_fix_care_installation_demo_data.sql` | demo data fix |

---

## 6. Shared vs Care-only ambiguity

**Shared, Care depends on them:**

- `tenants`, `admins`, `auth.users` — multi-tenant base. Properly RLS'd.
- `documents`, `storage_files` — shared with Developer Portal data hub.
- `intelligence_interactions` — single audit log used by Agent dashboard and Care intelligence (`skin: 'care'`). Worth keeping shared.
- `developments`, `units` — referenced indirectly. The root version of `installations` referenced `development_id`, the unified-portal version does not. Confirm which is live.

**Care-only:** `care_conversations`, `care_messages`, `installation_telemetry`, `installation_alerts`, `service_records`, `safety_alerts`, `service_bookings`, `support_queries`, `diagnostic_flows`, `care_third_party_uploads`.

**Ambiguous:**

- `installations.installer_name` is a free-text string filtered by the literal `'SE Systems'` in the intelligence chat route. There is no foreign key to a canonical installer entity, and no link to `tenant_id` to enforce that the filter and the tenant match. If a second installer ever lands in the same tenant, intelligence answers silently include the wrong rows.
- `installations.homeowner_id` exists in the root schema but not in the unified-portal version, so the implied "homeowner tenant" relationship is currently structurally absent.

---

## 7. AI surface area

Two LLM call sites, both `gpt-4o-mini`:

### Homeowner assistant — `app/api/care/chat/route.ts`

- System prompt built dynamically (route.ts:522–561). Merges up to four KB sources (SE Systems if applicable, Ireland, Care, generic), deduplicated to top four entries.
- Tools: `get_system_status`, `troubleshoot_issue`, `get_energy_estimate`, `get_warranty_info`, `draft_service_request`.
- Streaming SSE with JSON fallback. Rate limit 20 req/min per installation.
- Conversation persisted to `care_conversations` and `care_messages` (one conversation per installation).
- Falls back to a hardcoded Mary Murphy demo (job ref `SE-2026-0312`, 3.69 kWp SolarEdge, 9× JA Solar 410 W) if no DB row is found — this is a soft P1 because demo data can mask real-data bugs.

### Installer intelligence — `app/api/care/intelligence/chat/route.ts`

- System prompt at lines 441–477. Voice: "OpenHouse Care Intelligence", colleague tone, anti-clarifying-question rule.
- Tools: `search_installations`, `get_diagnostics_summary`, `get_warranty_status`, `get_support_queue`, `get_customer_communications`, `get_performance_metrics`, `get_attention_required`.
- Hardcoded `INSTALLER_NAME = 'SE Systems'` (route.ts:22). Filter is applied at query layer, not RLS.
- Streaming NDJSON with `token`, `sources`, `followups`, `done`, `error` events. Follow-up questions auto-generated post-response.
- Logs to `intelligence_interactions` with `skin: 'care'`.

No `match_document_sections` RAG call from Care: the homeowner assistant uses curated KB modules rather than embeddings. This is a notable difference from the Developer Portal pattern and is worth a strategic discussion in Part 4.

---

## 8. Schema and RLS findings

### Tables — Care-owned

All Care-owned tables have RLS enabled. None have authenticated-user policies.

| Table | RLS | Policies present | Tenant column |
|---|---|---|---|
| `installations` | enabled | service_role only | `tenant_id` |
| `care_conversations` | enabled | service_role only | none, JOIN via `installation_id` |
| `care_messages` | enabled | service_role only | none, JOIN via `conversation_id` |
| `installation_telemetry` | enabled | service_role only | none |
| `installation_alerts` | enabled | service_role only | none |
| `support_queries` | enabled | service_role only | `tenant_id` |
| `diagnostic_flows` | enabled | service_role only | `tenant_id` |
| `service_records` | enabled | **none** (P0) | none |
| `safety_alerts` | enabled | **none** (P0) | none |
| `service_bookings` | enabled | **none** (P0) | none |
| `care_third_party_uploads` | enabled | admin-subquery + service_role | `installer_tenant_id` (no FK) |

### Flags

1. P0 — `service_records`, `safety_alerts`, `service_bookings` have RLS on with no policies of any kind. See section 0.
2. P0 — `installations.telemetry_api_key` is plaintext. See section 0.
3. P1 — Authenticated user access is impossible on Care tables today because policies only grant service role. Every API route must go through service role. If anyone ever swaps to the user-JWT client, the app silently returns empty arrays. The intent is presumably "API-mediated only", but the lack of any user policy means there is no defence-in-depth: a leaked service-role key is total compromise.
4. P1 — `care_third_party_uploads.installer_tenant_id` has no FK to `tenants(id)`. Orphan rows possible; cascade behaviour undefined on tenant deletion.
5. P1 — `care_third_party_uploads` RLS policy joins `admins WHERE id = auth.uid()`. This assumes a 1:1 between auth user and admin row with a non-null `tenant_id`. If an installer ever has two admin rows (multi-tenant staff, future), or if `tenant_id` is null, the policy fails open or closed in non-obvious ways.
6. P1 — `installations.installer_name` is a free-text filter used as the security boundary for intelligence chat. Not enforced by RLS, not linked to a tenant entity. Single-installer-per-tenant assumption is baked in but not stated.
7. P2 — `support_queries.tenant_id` and `diagnostic_flows.tenant_id` reference `tenants(id)` without `ON DELETE` clause. Deletion of a tenant blocks on these constraints rather than cascading. Probably fine for now but worth fixing.
8. P2 — Child tables (`care_conversations`, `care_messages`, `installation_telemetry`, etc.) carry no `tenant_id` column. RLS would need to JOIN through `installations`. This is a constraint on the eventual "real RLS" rewrite.
9. P2 — JSONB columns `system_specs`, `component_specs`, `performance_baseline`, `installer_contact`, `active_safety_alerts` are unvalidated. No CHECK constraints, no JSON schema.
10. P3 — No indexes on `care_messages(conversation_id, created_at)`, `service_records(installation_id, service_date)`, etc. Once datasets grow, intelligence summaries will slow.

### Shared tables Care relies on

- `tenants` — RLS in `packages/db/policies.sql`. Three policies, scoped by `tenant_id` claim plus `platform` role. Healthy.
- `admins` — RLS in `packages/db/policies.sql` + `migrations/0008_rls_admin_login_fix.sql`. Care's third-party upload policies depend on this table's shape.
- `developments` — RLS hardened in `apps/unified-portal/migrations/004_developments_rls_and_tenant.sql`. Used indirectly via root-schema `installations.development_id` if that variant is live.
- `documents` / `storage_files` — Data Hub. Not directly read by Care today.

### Storage buckets

No bucket creation or bucket-policy SQL found in repo migrations. Inferred that Care uses bucket(s) provisioned via Supabase Studio with signed-URL access through `lib/care/third-party.ts` and `app/api/care/third-party/upload-*`. This is a P2 audit gap: bucket policies need to be inspected directly in the Supabase project.

### RPCs / functions

- `update_care_conversations_updated_at()` — trigger function, SECURITY INVOKER. Touches `updated_at` only. Safe.
- `care_tpu_set_updated_at()` — trigger function for `care_third_party_uploads`. Safe.
- `update_installations_updated_at()` — defined in root migration only. **Not active** in unified-portal-derived schema, so `installations.updated_at` is not auto-maintained.

No `match_document_sections` call from Care (homeowner assistant uses curated KBs, not embeddings).

### Migration order

The cleanest reading is that `apps/unified-portal/migrations/` is the live source of truth and the root `migrations/0005_*`, `0006_*` Care files are dead code that should be deleted to remove the silent-divergence trap. I have not confirmed this against the running Supabase project. Recommend confirming before any further migration is authored.

---

## 9. Data freshness

Surfaces with stale-data risk:

- **Real-time telemetry** (`/api/care/telemetry/[id]`): live SolarEdge API hit. Latency and rate limits live with the upstream vendor; no cache layer visible. Cold path will be slow on the homeowner home screen.
- **`installations.health_status`, `energy_generated_kwh`, `savings_eur`**: these look like cached aggregates with no visible recompute trigger. Source of truth unclear — likely the telemetry tables, but the path that updates the parent row is not obvious from the code.
- **Warranty dates**: stored once on the installation row. No background job to flag expiries. The intelligence tool `get_warranty_status` calculates windows at query time, which is fine.
- **`care_third_party_uploads.status`**: state machine progressed by the inbox UI. No timestamps for each transition beyond `reviewed_at`, so audit forensics on rejection vs filing later are weak.

---

## 10. Constraint on Parts 2 and 3

Parts 2 and 3 ("Stress Test the Installer Dashboard" and "Stress Test the Homeowner Care Assistant") describe browser-level interactive QA: clicking nav items, resizing viewports, sending chat messages, attempting prompt injection. This session does not have a running browser or live access to the deployed app or the Supabase project.

What I can do without a browser:

- Trace every code path statically and report likely failure modes (e.g. unhandled stream-cut behaviour in `AssistantScreen`, the demo-data fallback masking real-data bugs in `/api/care/chat`, the `installer_name` hardcoding in intelligence chat).
- Run `npm run build` and TypeScript checks to surface latent errors.
- Read the intelligence chat tool implementations and predict their behaviour on adversarial inputs.
- Read the homeowner system prompt and stress-test it against the documented prompt-injection patterns by reading, not executing.
- Audit the third-party upload flow for tenant escape, file-type abuse, and enumeration in `lookup-job`.

What I cannot do without a browser or live env:

- Click anything.
- Verify visual layout at different breakpoints.
- Confirm that streaming truncation handles cleanly in the UI.
- Send live prompts to `gpt-4o-mini` and grade the actual responses.
- Exercise RLS by issuing cross-tenant queries against the live database.

I want to flag this before running Part 2/3 so we are aligned on what "stress test" produces here: a thorough static analysis with specific failure-mode predictions, plus a build/typecheck pass, not a hands-on QA log.

---

## Outstanding questions before continuing

1. Is the unified-portal migrations directory the live source of truth? (Affects whether root migrations 0005/0006 are dead code worth deleting.)
2. Has the seed endpoint (`POST /api/care/seed`) been gated to non-production? Repo doesn't show an env check at the route level.
3. Is there an existing background job that maintains `installations.health_status` / `energy_generated_kwh` / `savings_eur`, or are these set on insert and otherwise stale?
4. For Parts 2 and 3, is static analysis + build + targeted code review acceptable, or do you want me to spin up a local dev server and exercise the UI via screenshots?

Pausing here for direction.
