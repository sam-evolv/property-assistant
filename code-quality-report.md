# Code Quality Improvement Report

## Task 1: Structured Logging

**Created**: `lib/logger.ts`

A structured logger with three methods:
- `logger.info(message, meta?)` 
- `logger.warn(message, meta?)`
- `logger.error(message, error?, meta?)`

Behavior:
- **Production** (`NODE_ENV=production`): outputs JSON with `timestamp`, `level`, `message`, and meta fields
- **Development**: outputs readable `[LEVEL] message {meta}` format
- **Sensitive field stripping**: automatically redacts `email`, `password`, `token`, `key`, `secret`, `phone`, `authorization`, `cookie` and variants from meta objects

Applied to the following API routes (replacing inline `console.*` calls):
- `app/api/tenants/route.ts`
- `app/api/admin/homeowners/stats/route.ts`
- `app/api/purchaser/mark-handover/route.ts`
- `app/api/projects/route.ts`
- `app/api/agent/pipeline/route.ts`
- `app/developer/layout.tsx`

---

## Task 2: Fix SELECT * Queries

### `app/api/tenants/route.ts`
- **Before**: `.select('*')` on `tenants` table
- **After**: `.select('id, name, slug, logo_url, created_at')` — only the columns used in the response

### `app/api/admin/homeowners/stats/route.ts`
- **Before**: `.select('*')` on `units` table
- **After**: `.select('id, purchaser_name, owner_name, purchaser_email, owner_email, house_type_code, house_type, address, address_line_1, unit_number, unit_code, lot_number, project_id, project_name, development_id, created_at, last_chat_at, consent_at, registered_at, user_id, important_docs_agreed_version, important_docs_agreed_at')` — exactly the 22 columns mapped in the response

---

## Task 3: Fix Silent Failures in mark-handover

**File**: `app/api/purchaser/mark-handover/route.ts`

**Before**: If either `units` or `unit_sales_pipeline` update failed, the error was logged but execution continued. Only if *both* failed would the endpoint return 500.

**After**: If *either* update fails, the endpoint immediately returns a 500 error with a specific message indicating which table failed. No silent continuation.

---

## Task 4: Wire Up CSRF Protection

### New files:
- `lib/csrf.ts` — `requireCsrf(req)` helper that validates `X-CSRF-Token` header against tokens from `lib/security/validation.ts`
- `app/api/auth/csrf/route.ts` — `GET /api/auth/csrf` endpoint that generates and returns a fresh CSRF token

### Routes now requiring CSRF tokens:

| Route | Method | Reason |
|-------|--------|--------|
| `app/api/purchaser/mark-handover` | POST | Purchaser-facing, QR token auth only |
| `app/api/purchaser/important-docs-agreement` | POST | Purchaser-facing, QR token auth only |
| `app/api/purchaser/noticeboard/report` | POST | Purchaser-facing, QR token auth only |

### Client integration:
Clients should call `GET /api/auth/csrf` before making state-changing requests to these endpoints, then include the token in the `X-CSRF-Token` header. Tokens are single-use and expire after 1 hour.

### Routes NOT requiring CSRF:
- Auth routes (login, logout) — initial authentication flows
- Routes using `withAuth` middleware — session cookie validation is sufficient
- GET-only routes
- Public API routes

---

## Task 5: Fix _debug Field Leak

**File**: `app/api/projects/route.ts`

**Before**: `_debug` object (containing `suppressedIds` and internal metadata) was always included in the API response.

**After**: `_debug` is only included when `NODE_ENV === 'development'`. In production, the field is omitted entirely.

---

## Task 6: TypeScript `any` Cleanup

### `app/api/agent/pipeline/route.ts`
- Added proper interfaces: `PipelineRow`, `UnitRow`, `DevRow`, `CommRow`, `Buyer`
- Replaced all 17 `any` type annotations with specific types
- Changed `catch (error: any)` to `catch (error)` with `instanceof Error` narrowing

### `app/api/admin/homeowners/stats/route.ts`
- Added `UnitRow` interface with all 22 fields
- Replaced `(u: any)` mapping with `(u: UnitRow)`

### `lib/supabase-server.ts`
- Replaced `let admin: any = null` with proper typed object: `{ id: string; email: string; role: string; preferred_role: string | null; tenant_id: string } | null`
- Changed `catch (dbError: any)` to `catch (dbError: unknown)` with `instanceof Error` narrowing
- Changed `catch (fallbackError: any)` to `catch (fallbackError: unknown)` with `instanceof Error` narrowing
- Changed `catch (error: any)` to `catch (error: unknown)` with `instanceof Error` narrowing

---

## Task 7: React Error Boundaries

**Existing component**: `components/ErrorBoundary.tsx` — already implemented with error ID generation, remote error reporting, dev-mode stack traces, and reload/home buttons.

### Layouts wrapped:

| Layout | Wrapping Strategy |
|--------|-------------------|
| `app/developer/layout.tsx` | `<ErrorBoundary>` wraps `{children}` inside `DeveloperLayoutProvider` |
| `app/care-dashboard/layout.tsx` | `<ErrorBoundary>` wraps `{children}` in the content area |

**Note**: `app/admin/layout.tsx` does not exist in the codebase. Admin routes are served through other layout paths.

---

## Build Status

`npm run build` passes with zero TypeScript/webpack errors.
