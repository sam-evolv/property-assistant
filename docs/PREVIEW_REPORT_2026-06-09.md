# OpenHouse — Full Audit & Upgrade Report (Preview Branch)

**Branch:** `claude/sleepy-sagan-3ab8zs` · **Date:** 9 June 2026
**Scope:** Security + stability audit of the developer dashboard and property assistant, OpenHouse Intelligence upgrade, HPI/IGBC alignment, UX fixes, and go-to-market next steps.

---

## 1. Security audit — found and fixed

379 API route files were audited. All fixes are committed on this branch; nothing was deleted.

| Severity | Issue | Fix |
|---|---|---|
| **P0** | `/api/tenant/[slug]` returned tenant admins, developments and counts with **no auth at all** | Requires an enterprise session; non-super-admins can only read their own tenant |
| **P0** | `/api/analytics/homeowner-counts` accepted any `tenant_id` from the query string (cross-tenant read) | Session required + `enforceTenantScope` / `enforceDevelopmentScope` |
| **P0** | `/api/archive/disciplines` listed any development's documents unauthenticated | Session required + tenant scope |
| **P0** | Real **Supabase database password committed** in `property-assistant/DEPLOY_TO_SUPABASE.md` | Redacted in the tree — **ACTION: rotate this password in Supabase** (project `qgkyuaagcrrynnkipbad`); git history still contains it |
| **P1** | `/api/qr/generate` minted home QR codes for any unit UUID, unauthenticated | Session + unit-tenant ownership check |
| **P1** | Cron routes (`refresh-tokens`, `send-scheduled-broadcasts`) authenticated against `Bearer ${CRON_SECRET}` — if the env var is unset, the literal string `Bearer undefined` authenticates | Fail closed: reject whenever `CRON_SECRET` is missing or mismatched |
| **P2** | `/api/debug/messages` let any tenant admin read cross-tenant message stats | Super-admin only |
| **P2** | `/api/dev/data-integrity` exposed aggregate message data in non-production with no auth | Admin session now required as well |
| **P2** | `/api/homeowner/register` had no rate limiting (account-creation hammering) | 5 requests/min per IP via the existing limiter (active in prod/staging) |

**Actions that must be done outside this repo (cannot be fixed in code):**
1. **Rotate the Supabase DB password** for project `qgkyuaagcrrynnkipbad` (Settings → Database). The old one is in git history forever.
2. **Verify `CRON_SECRET` is set in Vercel** (the cron fixes fail closed — crons will 401 until it's configured; Vercel sends it automatically when set).
3. The Google Maps key in `.replit` is client-exposed by design but should be **HTTP-referrer-restricted** in Google Cloud Console.
4. Consider purging `logs/` and the stale `property-assistant/` nested copy from the repo (left untouched per "don't delete" instruction).

**Verified-good during audit:** the intelligence write-confirmation endpoint properly re-verifies ownership and writes an audit log; `schedule-digest` cron already used constant-time, fail-closed auth; purchaser QR token signing validates unit↔development binding; admins table holds no password hashes (auth is in Supabase Auth).

---

## 2. Stability

- `npm run build` passes (baseline verified before changes, re-verified after).
- `tsc --noEmit` clean after every commit on this branch.
- No schema changes were required for any of this work **except** that the existing HPI migrations **067, 068, 069 must be run manually in the Supabase SQL editor** (they were already on main before this branch; the HPI board and unit file 404/error until they're applied).

---

## 3. OpenHouse Intelligence — now portfolio-wide, date-aware, agentic

The dev-app Intelligence could not answer the headline question ("how many houses across all my schemes went sale agreed last week?"). It can now:

- **New `query_pipeline_activity` tool** — counts/lists any pipeline milestone (sale agreed, contracts signed, drawdown, handover…) in an explicit date range, across the whole portfolio or one scheme, with a per-development breakdown.
- **Agentic loop** — up to 3 chained tool rounds per turn (was a single round), so it can e.g. pull the portfolio numbers then drill into a specific unit in the same answer.
- **Correct snag data** — intelligence read the dormant `snag_items` table; it now reads canonical `issue_reports` (severity, trade, safety-risk included), matching what `/developer/issues` shows.
- **Regulatory + HPI knowledge** — a verified knowledge block (BCAR/CCC, TGD Parts B/F/L/M, BER/NZEB, HomeBond, and HPI v3.1: five categories, mandatory minimums, QA evidence list, QA 8.0) now ships in the system prompt, with strict "orient, don't certify" behaviour rules. Lives in `lib/dev-app/regulatory-knowledge.ts` for reuse by other assistant surfaces.
- **Mutation integrity** — the prompt now forbids claiming success before tool confirmation and tells the truth about pending confirmations (ported from the agent-intelligence hard rules).
- **Stronger model** — defaults to `gpt-4o` (low-volume, high-value surface); `INTELLIGENCE_MODEL` env var overrides.

## 4. HPI / IGBC — research findings and what was built

### Research (sourced from IGBC/homeperformanceindex.ie and industry sources)
- Current version is **HPI Technical Manual v3.1 (Nov 2025)**, projects registered from 20 Jan 2026. Five categories (Environment, Health & Wellbeing, Economic, Quality Assurance, Sustainable Location), levels Certified/Silver/Gold, and from v3.1 **certification is project-wide** (every unit submitted).
- Mandatory minimums regardless of score: water efficiency, designed **and commissioned** ventilation, thermal bridging evidence, enhanced airtightness, energy ≥10% better than NZEB, no individual oil/gas boilers.
- **QA is the paperwork pain**: per-unit airtightness results + photos of details, thermal-bridging junction schedules (IGBC issued dedicated evidence guidance because industry struggled), construction-stage photos, commissioning certs, post-occupancy evaluation (~12 months), and QA 8.0 **Consumer Information & Aftercare** (Home User Guide + handover demo + aftercare).
- **Key strategic fact:** since Dec 2025 IGBC has a submission portal partner — **"HPI Upload" built on IES TaP** is the mandatory certification submission route. So OpenHouse should NOT pitch as the submission portal. The open lane is **upstream evidence capture**: per-plot site evidence, commissioning/cert chasing, handover events, Home User Guide, aftercare and POE — feeding clean packs into HPI Upload.
- Demand drivers: **LDA has adopted HPI** for its schemes; **HBFI links green development finance to HPI**; the new **Home Performance Pathway (HPP)** (~12 indicators, backed by AIB/BOI/HBFI green lending) targets exactly OpenHouse's SME builder segment. 36,000+ homes registered; 3,500+ certified in 2025 alone.
- Contact: hpi@igbc.ie (CEO Pat Barry). Worth downloading the v3.1 manual + Home User Guide template + Certification Calculator from the technical documents page before the meeting (they block automated fetching).

### Built on this branch
- **HPI Readiness board** (`/dev-app/hpi`): portfolio and per-scheme QA 8.0 evidence — % homes ready, guides issued / demos logged / aftercare active, expandable per-unit checklist, one tap to each unit file. This is the screen to put in front of IGBC: as-built evidence state across a whole scheme at a glance.
- **Units tab in the dev-app nav** — the entire unit file surface (snags, systems, HPI readiness, Home User Guide) existed but was unreachable from navigation.
- **Home User Guide generation upgraded to `gpt-4o`** (the QA 8.0 headline deliverable; generated once per unit so cost is bounded).
- Intelligence can now answer HPI questions in context ("what do I still need for QA 8.0 on Maple Drive?" → checks handover events and reports present vs missing).

---

## 5. Property assistant (buyer-facing) — assessment

Architecture is solid: persona-locked prompts, three-tier knowledge (real house context → general Irish home knowledge → RAG), hallucination firewall, snag photo flow into canonical `issue_reports` with async enrichment, and full Irish-context snag triage (settlement bias, "normal things that look alarming" list). Deliberately **not** modified in this pass (it's the stable, demo-critical surface). Recommended next, in order:

1. **Confirm production flags in Vercel**: `FEATURE_OPENHOUSE_AGENT_V1`, `FEATURE_ASSISTANT_IMAGE_UPLOAD` (+ `NEXT_PUBLIC_` variants) — the best photo-snag pipeline is dormant without them.
2. Apply the hallucination firewall to the text-only `/api/chat` path (currently only the multimodal path enforces it).
3. Server-sent streaming for chat (today the client fakes streaming after full response — perceived latency suffers).
4. Add RLS to `assistant_conversation_turns` (identifiable conversation memory currently relies on service-role discipline alone).
5. Let the agent ask one clarifying question before filing ambiguous snags (single-shot today).

## 6. Step-change ideas (not built — for tomorrow's discussion)

1. **HPI Evidence Pack export** — one click per scheme: ZIP/PDF of every unit's guide, handover events, commissioning docs, airtightness certs, organised by HPI indicator, ready for HPI Upload. (The unit-file route already stubs `documents`; this is the V1.1 slot.) This is the feature that makes OpenHouse *the* recommended upstream tool.
2. **Site evidence capture against QA indicators** — the /snag photo flow generalised: tag a photo to plot + QA indicator (airtightness detail, junction, commissioning). Site teams already use phones; HPI assessors need exactly these photos.
3. **POE via the buyer assistant** — QA 7.0 requires post-occupancy evaluation ~12 months in. OpenHouse already talks to the occupants. A scheduled in-chat survey + report = an HPI indicator no competitor can reach.
4. **HPP mode** — a 12-indicator "lite" checklist for SME builders chasing green finance (AIB/BOI/HBFI). Smaller builders are OpenHouse's beachhead market and HPP is their entry door.

## 7. Go-to-market next steps

1. **Before the IGBC meeting:** run migrations 067–069 in Supabase, seed one scheme with 2–3 units fully evidenced (issue guides, log demos), and demo: Units → HPI board → unit file → "ask Intelligence what's missing for QA 8.0".
2. **Pitch to IGBC as the upstream evidence layer feeding HPI Upload** (complement, not competitor, to their IES partnership) and ask about: the Home User Guide template (align our generator's sections to it), HPP tooling for SME builders, and being listed as a recommended tool for site-stage evidence.
3. **Revenue wedge:** target HPP-curious SME builders (bank-driven demand for green finance) with a per-unit price (guide + handover evidence + aftercare). The LDA's HPI adoption makes their delivery partners the second target list.
4. **Proof asset:** after the first scheme completes QA 8.0 through OpenHouse, write it up as a case study with the assessor's feedback.

---

## Commits on this branch

1. `fix(security)` — all auth/tenant-isolation/cron/rate-limit fixes + password redaction
2. `feat(intelligence)` — portfolio/date-aware/agentic intelligence + regulatory & HPI knowledge
3. `feat(hpi)` — HPI Readiness board, Units tab, summary API, gpt-4o Home User Guide
4. `docs` — this report
