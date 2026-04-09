# Quality Sweep 2 Report — OpenHouse AI

**Date:** 2026-04-07  
**Branch:** `claude/codebase-optimization-vY1pO`  
**Commit:** `a98be05`  
**Files modified:** 20  
**Build status:** ✓ Passing

---

## Summary

| Task | Status | Details |
|------|--------|---------|
| Create structured logger | Done | `lib/logger.ts` created |
| Logger rollout | Done | `provision-developer/route.ts` — 8 console.* replaced |
| ErrorBoundary coverage | Done | 5 layouts wrapped |
| Any type cleanup | Done | 10 files fixed (~30+ occurrences) |
| Rate limiting | Done | 3 privileged routes protected |
| Build fix | Done | Reverted 2 care routes to force-dynamic |

---

## Task 1 — Structured Logger

**Created:** `apps/unified-portal/lib/logger.ts`

Thin wrapper that writes structured JSON to stdout/stderr:
```typescript
logger.info(message, context?)   // → stdout JSON
logger.warn(message, context?)   // → stdout JSON
logger.error(message, context?)  // → stderr JSON
```

Each entry includes `{ level, message, timestamp, context? }`.

**Logger rollout — `provision-developer/route.ts`:**
- 8 `console.log/error/warn` calls replaced with `logger.info/warn/error`
- Structured context objects passed as second argument (e.g. `{ email, tenantId }`)
- `catch (error: any)` fixed to `catch (error: unknown)`

**Note on scope:** The Phase 1 console sweep was thorough enough that `provision-developer/route.ts` was the only remaining non-auth API route with console statements. All other `app/api/` routes were already clean from Phase 1.

---

## Task 2 — ErrorBoundary Coverage

Added `ErrorBoundary` import and wrapping to 5 layouts:

| Layout | Type | Where wrapped |
|--------|------|---------------|
| `app/purchaser/layout.tsx` | Server component | Wraps `<PurchaserProvider>` tree |
| `app/super/layout.tsx` | Server component | Wraps `<SuperLayoutClient>` |
| `app/admin-enterprise/layout.tsx` | Server component | Wraps full layout div |
| `app/agent/layout.tsx` | Server component | Wraps `<Suspense>` + `<AgentProvider>` |
| `app/care-dashboard/layout.tsx` | Client component | Wraps content area `{children}` |

**`app/admin/layout.tsx`** — does not exist in the codebase, skipped.

---

## Task 3 — Any Type Cleanup

### `lib/supabase-server.ts`
- `let admin: any` → `let admin: AdminRecord | null` with inline `AdminRecord` type definition
- `catch (dbError: any)` → `catch (dbError: unknown)` with `instanceof Error` narrowing
- `catch (fallbackError: any)` → `catch (fallbackError: unknown)` with `instanceof Error` narrowing
- `catch (error: any)` → `catch (error: unknown)` with `instanceof Error` narrowing
- Console statements preserved (auth file — logic untouched)

### `app/api/admin/` — 4 files fixed

| File | Fix |
|------|-----|
| `system-logs/route.ts` | `AuditLog.metadata: any` → `Record<string, unknown>`; `.map((row: any)` → typed |
| `room-dimensions/route.ts` | `.map((d: any)` → inferred; `updateData: Record<string, any>` → `Record<string, unknown>` |
| `room-dimensions/batch-verify/route.ts` | `updateData: Record<string, any>` → `Record<string, unknown>` |
| `homeowners/stats/route.ts` | `.map((u: any)` → inferred from Supabase result |

### `app/api/purchaser/` — 4 files fixed

| File | Fix |
|------|-----|
| `profile/route.ts` | `parseNumericValue(value: any)` → `unknown`; `documents: any[]` → typed; `Map<string, any>` → typed; `specification_json as any` → `as Record<string, unknown>` |
| `docs-list/route.ts` | `Map<string, any>` → fully typed inline shape |
| `noticeboard/route.ts` | `updates: Record<string, any>` → `Record<string, unknown>` |
| `important-docs-agreement/route.ts` | `let agreement: any` → `let agreement: unknown` |

### `app/api/super/impersonate/route.ts`
- `let unit: any = null` → typed interface `UnitRow & { development_id, tenant_id, development_name? } | null`
- `.find((u: any)` → `.find((u: UnitRow)`

**Skipped:** `app/api/purchaser/auth/validate/route.ts` — auth route (excluded per constraints)

---

## Task 4 — Rate Limiting

Added `checkRateLimit(ip, route)` to 3 privileged routes. All use existing `lib/security/rate-limit.ts` infrastructure (token bucket, in-memory).

| Route | Route key | Bucket |
|-------|-----------|--------|
| `app/api/auth/provision-developer/route.ts` | `'provision-developer'` | Default (120 tokens, 2/s) |
| `app/api/super/impersonate/route.ts` | `'impersonate'` | Default (120 tokens, 2/s) |
| `app/api/admin/qr-pack/route.ts` | `'qr-pack'` | Default (120 tokens, 2/s) |

IP extracted from `x-forwarded-for` header, falling back to `127.0.0.1`.

**Future migration note:** The current rate limiter is in-memory and will not share state across multiple Vercel instances. For production at scale, migrate to [Upstash Redis](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview) using `@upstash/ratelimit` — it is a drop-in replacement with the same token bucket algorithm.

---

## Build Fix — Care Routes Reverted

Phase 1 changed two care API routes from `force-dynamic` to `revalidate`:
- `app/api/care/system-types/route.ts` → `revalidate = 86400`
- `app/api/care/diagnostic-flows/route.ts` → `revalidate = 3600`

These changes caused `Export encountered errors` during `npm run build` because Next.js attempted static generation at build time, but the routes make Supabase service role calls that fail without credentials in the build environment.

**Fix:** Both reverted to `export const dynamic = 'force-dynamic'`. The original Phase 1 rationale ("no auth check") was correct but overlooks the Supabase dependency at static gen time.

---

## Remaining Items for Developer Review

| Area | Issue | Priority |
|------|-------|----------|
| Logger rollout | Only `provision-developer` migrated; other routes were already clean | Low |
| Rate limiter | In-memory only — no cross-instance state on Vercel | Medium |
| Upstash migration | Replace `lib/security/rate-limit.ts` with `@upstash/ratelimit` for production | Medium |
| ~640 `any` types | Remaining across codebase — need generated Supabase DB types for full resolution | Medium |
| `next` 14.2.35 | Critical vulnerabilities — still needs migration to 16.x | High |
| `xlsx` library | High severity, no fix — consider replacing with `exceljs` | High |
