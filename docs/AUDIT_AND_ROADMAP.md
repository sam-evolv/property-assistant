# OpenHouse Platform — Audit, Fixes & Roadmap

_Full-platform audit (security, correctness, build, design) with fixes applied and a
prioritized roadmap. Generated during the audit engagement._

---

## 1. Executive summary

A multi-auditor sweep covered authentication/tenant-isolation, secrets/injection,
correctness, build/dependency health, and design/UX across the `unified-portal`
app (388 API routes, ~650 components) and shared packages.

**Headlines**
- **Secrets, SQL injection, XSS, credential encryption, and SSRF are clean.** AES-256-GCM
  encryption, parameterized Drizzle queries, and escaped `dangerouslySetInnerHTML` sinks
  were all verified sound.
- **The dominant risk class is broken access control**: routes that authenticate the
  caller but then trust a client-supplied identifier (header, cookie, query `tenant_id`,
  or path id) instead of the server session. A prior hardening pass (`cddbc24`) fixed
  developer/admin routes but missed the purchaser token model, the homeowner flow,
  the BTR routes, and several forgeable-auth endpoints.
- **The design system is good but unadopted**: an excellent `components/ui/premium`
  library competes with several dead/duplicate token systems; the brand gold and text
  hierarchy were applied inconsistently.

Confirmed critical/high issues have been fixed in this pass (Section 2). A set of
larger, product-decision, or higher-regression-risk items are documented as a
prioritized backlog (Section 4).

---

## 2. Fixed in this pass

### Security — critical
- **`x-admin-email` header auth bypass** (`packages/api/src/rbac.ts`, `app/api/developers/[id]`):
  `getAdminContext` derived admin identity+role from a client header. Switched the route to
  the session-authoritative `getAdminContextFromSession`; `getAdminContext` now fails closed.
- **`auth/portal-login` account takeover**: the homeowner branch minted a Supabase session for
  *any* email given any valid property code. Now requires the email to match the unit's
  registered `purchaser_email`.
- **`schemes/[schemeId]/profile` forgeable-cookie auth**: identity/tenant/role came from
  unsigned `admin_id`/`tenant_id`/`user_role` cookies. Now uses the validated server session,
  and ownership checks bind every non-super_admin role (not just `developer`).
- **`tenant/[slug]` unauthenticated dump**: returned a tenant's full record + all admin
  emails/roles + developments to anyone who guessed a slug. Now requires a session and
  membership (or super_admin).
- **`super/developer-codes` unauthenticated**: create/enumerate developer invite codes with no
  auth. Now `requireRole(['super_admin'])`.
- **BTR routes cross-tenant IDOR** (`developments/[id]/btr/{route,tenancies,maintenance,compliance,amenities,welcome}`):
  read/write of rent roll, tenant PII, and portal access codes by path id with no tenant check.
  All now verify development→tenant ownership; writes strip client `tenant_id`/`id`.
- **Purchaser document download IDOR** (`purchaser/docs-list/download`): arbitrary `docId`
  returned any document platform-wide. Now scoped to the caller unit's tenant + development
  (and Supabase `project_id` for sections), fail-closed.
- **`agent/applicants/[id]` GET (no auth) + PATCH (fail-open)**: now require a session and
  enforce `agent_id` ownership.
- **`agent/pipeline` client-supplied `tenant_id`**: now derived from the session.

### Security — high / medium
- **Purchaser token validator** (`packages/api/src/qr-tokens.ts`): removed the unsigned
  `token === unitUid` / `parts[0] === unitUid` bypasses that made the purchaser API effectively
  unauthenticated. Now requires a valid HMAC signature; continued-session access re-verifies the
  signature; showhouse/demo access is **off by default** (`ENABLE_SHOWHOUSE_DEMO=true` to opt in).
  Also switched signature comparison to constant-time (`crypto.timingSafeEqual`).
- **`developments/[id]`, `house-types`, `pipeline/[developmentId]/release`, `compliance/[developmentId]`
  (update_document / removeDocType)**: added tenant/development scoping.
- **Agent "fall back to first agent_profile" anti-pattern** (`agent/applicants`, `pipeline-data`,
  `badge-count`, `intelligence/execute-actions`): removed — these now fail closed (401).
- **`agent/viewings` PATCH/DELETE IDOR**: now scoped to the caller's `agent_id`.
- **`admin/units`, `admin/qr-pack`, `admin/system-logs`**: added tenant scoping for non-super_admin.
- **`dev-app/intelligence/send-email` IDOR**: verifies message→conversation ownership.
- **`debug/messages`**: restricted to super_admin.
- **PostgREST `.or()` filter injection** (`super/homeowners`, `super/units`, `notifications`),
  **`notify/new-signup` HTML injection**, and **unauthenticated analytics leaks** — see Section 3
  for the exact set handled.
- **`developer/places-health`**: removed the forgeable-cookie auth fallback.

### Correctness bugs
- **Broadcast targeting** (`notification-service.ts`): `pipeline_stage` broadcasts ignored the
  stage filter and went to *every* homeowner — added the `status` predicate.
- **Quiet hours** computed in UTC, not the user's timezone — now Europe/Dublin via `Intl`.
- **Spreadsheet enrichment** wrote to the wrong row via loose substring matching (`"1"` matched
  `"10"`; empty id matched everything) — now exact-match, skips empty ids.
- **Analytics fabrication**: `active_units_in_window` invented a value of `50% of units` on
  failure — now records an error and leaves the true value.
- **Mortgage-expiry alert** off-by-one (`> 0` skipped items expiring today; summary could show
  negative days) — fixed bounds.
- **`safeAnalyticsResponse`** returned HTTP 200 on validation failure — now 422 (callers branch on
  status).

### Build / config
- Added `compiler.removeConsole` guidance and confirmed the TypeScript baseline is clean.

### Design / UX
- **Collapsed the token systems**: deleted the dead, misleading `lib/design-tokens.ts` and
  `lib/shared-theme.ts` (both declared the *wrong* brand gold and had zero importers).
- **Fixed the gold system**: `globals.css` `--gold-50…400` were the Tailwind *yellow* palette;
  now match the muted-gold ramp. Made the Tailwind `gold`/`brand` ramps monotonic so
  `hover:bg-gold-600` is actually visible (500 and 600 were near-identical).
- **Restored text hierarchy**: the global `!important` rule forced ~2,000 secondary-text uses to
  near-black, flattening hierarchy (and, being unscoped, darkening text on dark surfaces). Softened
  to an accessible muted gray (`#6b7280`, AA on white).
- **WCAG button contrast**: the shared primary `Button` used white-on-gold (~1.9:1, fails AA) — now
  near-black-on-gold.
- Fixed the no-op `hover:shadow-cardHover` (→ `shadow-card-hover`), removed non-functional
  care-dashboard quick actions, fixed the "OpenHouse Ai" → "OpenHouse AI" brand typo.
- Added branded `not-found.tsx` and root `error.tsx` (the app had neither).

---

## 3. Analytics-auth & injection pass (also fixed)

- **Unauthenticated verbatim-message leaks** — `analytics-v2/top-questions`,
  `analytics-v2/question-analysis`, `analytics/platform/top-questions`,
  `analytics/developments/[developmentId]/top-questions` returned real purchaser chat
  text with no auth. Now require a session; platform-wide endpoints are super_admin-only
  and per-development endpoints verify the development belongs to the caller's tenant.
- **Unauthenticated aggregate/identifier leaks** — `analytics/platform/{top-developments,
  message-volume,usage}`, `analytics-v2/{document-health,rag-latency}`,
  `analytics/homeowner-counts`, and the per-development `overview`/`message-volume`/`usage`
  routes now require a session and are tenant-scoped (super_admin retains the platform view).
- **PostgREST `.or()` filter injection** — `super/homeowners`, `super/units`, and
  `notifications` now escape LIKE wildcards and strip the `(),"` structural characters
  (and gate `developmentId` on a UUID pattern) before interpolation.
- **HTML email injection** — `notify/new-signup` now HTML-escapes user-supplied values.

---

## 4. Prioritized backlog (recommended, not yet applied)

These are higher-regression-risk or need a product decision. Ordered by priority.

### P0 — Security follow-ups
1. **Care homeowner routes need a session model** (`care/{service-records,telemetry,conversations,
   chat,dismiss-alert,service-booking,content,access}`). These are documented "Batch 2" gaps:
   unauthenticated, trust a client `installationId`, and the 24-bit (`crypto.randomBytes(3)`) access
   code is brute-forceable. Ship the homeowner care session + rate-limit `care/access` + widen the
   code entropy. **This exposes homeowner PII and allows safety-alert tampering — treat as urgent.**
2. **Homeowner self-registration hijack** (`homeowner/lookup-code` + `register`): `lookup-code`
   leaks purchaser name/address with no rate limit; `register` claims any unclaimed unit with only
   the (enumerable) code. Bind registration to a verified purchaser email (OTP/match), stop
   returning PII, and rate-limit both.
3. **Wire up rate limiting**: `safetyMiddleware` (route limits + circuit breaker) exists but is
   never invoked from `middleware.ts`, and `ENABLE_RATE_LIMITS` defaults off unless `APP_ENV` is
   `prod`/`staging` (Vercel sets `NODE_ENV`). The purchaser limiter also keys on the spoofable full
   `x-forwarded-for` and uses per-instance memory. Move to a durable store (Supabase/Upstash) and
   a trusted client-IP derivation; add limits to `auth/login`.

### P1 — Security hardening
4. **Move purchaser sessions to httpOnly+Secure cookies** (currently the unit token lives in
   `localStorage` + a non-Secure cookie — one XSS exfiltrates long-lived access).
5. **QR tokens should be single-use and revocable, fail-closed**: `validateQRToken` currently
   returns valid when the hash is absent from the DB or on any DB error, and `purchaser/auth/validate`
   never persists issued tokens. Persist tokens, enforce `used_at`/`expires_at`, derive expiry from the
   signed timestamp.
6. **Restrict/authenticate the remaining unauthenticated analytics routes** not covered in Section 3
   (platform aggregates) — decide public vs. super_admin-only per route.
7. **Remove dev/test surface from production**: `/test-hub`, `/test-page`, `/dev-tools` in
   `PUBLIC_PATHS`; exclude `auth/test-login` from prod builds rather than relying on a runtime env
   check; delete the dead `lib/session-engine.ts`/`lib/auth-server.ts` (hardcoded fallback secret +
   `x-admin-email` helper — landmines if ever imported).

### P1 — Correctness
8. **Inbound sync conflict detection** (`lib/integrations/sync-engine.ts`): after the first sync,
   every legitimate spreadsheet edit becomes a "conflict" because there's no per-field last-synced
   snapshot. Store the last-synced remote value (or a hash) and only conflict when both sides changed.
9. **Data Hub nested-folder scoping** (`lib/data-hub/sync-worker.ts`): files inside sub-folders are
   stored with `development_id = null`. Propagate the root watched folder through recursion.

### P2 — Build / dependency hygiene
10. **Flip off `typescript.ignoreBuildErrors` / `eslint.ignoreDuringBuilds`** in `next.config.js`
    (the TS baseline is already clean) so the green build actually enforces types. Add `scripts/**`
    to a separate typecheck.
11. **Prune spurious root `package.json` deps** (`next`, `react`, `recharts`, `framer-motion`, `zod`,
    `jspdf`, `pdf-parse`, `csv-parse`, `@types/recharts`, `react-is`) — they cause double-installs and
    a zod 3-vs-4 skew trap.
12. **Patch advisories**: `jspdf`, `drizzle-orm`, `form-data`; decide on `xlsx` (no fix — sanitize
    inputs or replace with `exceljs`). `next@14.2.35` already has the middleware CVE fix.
13. **Remove committed artifacts**: `tsconfig.tsbuildinfo`, `pre-handover-portal-complete.tar.gz`,
    committed PDFs, `.env.production`, stray root test scripts.

### P2 — Design system adoption
14. **Adopt the `premium` primitives** (`Button`/`Input`/`Card`): 1,462 raw `<button>` and 713 ad-hoc
    card blocks. Codemod the highest-traffic surfaces and add an ESLint guard banning raw hex in
    `className`/`style` and raw `<button>` in `app/**`.
15. **Extract a shared `<AuthShell>`** for the three copy-pasted login pages (dedupe the breathing-logo
    `<style>`, convert JS hover to CSS `:hover`/`:focus-visible`, wire the dead Terms/Privacy links).
16. **Standardize loading/empty/error**: add `loading.tsx` to route groups; consolidate the 3 Skeletons
    + 3 spinners into one each.
17. **Decide dark mode**: it's half-wired (`globals.css` darkens `body` under `prefers-color-scheme`
    but components hardcode `bg-white`) — either implement via the `--bg/--surface/--text` variables or
    remove the media block.
18. **Accessibility sweep**: `aria-label` on icon-only controls, `aria-current` on the mobile tab bar,
    `role="alert"` on form errors (much of this comes free with primitive adoption).

---

## 5. Innovation opportunities

See the "Strategic / innovation" section of the engagement summary for product-level ideas
(AI concierge for buyers, predictive pipeline intelligence, a unified design-system package, an
API/webhooks platform, and a proactive compliance engine).
