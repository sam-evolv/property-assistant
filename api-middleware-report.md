# API Auth Middleware Report

## Summary

Created a centralized `withAuth()` wrapper at `apps/unified-portal/lib/api-auth-middleware.ts` that enforces authentication on all API routes by default (opt-out model). Applied it to 11 routes across the codebase.

## Middleware: `withAuth(handler, options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `public` | `boolean` | `false` | Skip all auth checks |
| `roles` | `AdminRole[]` | `undefined` | Restrict to specific roles |

- **No options**: requires any valid Supabase session (returns 401 if missing)
- **`{ roles: [...] }`**: requires session + one of the listed roles (returns 403 if wrong role)
- **`{ public: true }`**: passes through without any auth check

Auth errors (`UNAUTHORIZED` / `FORBIDDEN`) thrown by `requireSession` / `requireRole` are caught by the wrapper and returned as JSON responses, eliminating duplicated catch blocks in every handler.

## Routes Updated

### Public Routes (3)

| Route | Method | Reason |
|-------|--------|--------|
| `app/api/health/route.ts` | GET | Monitoring/observability endpoint |
| `app/api/stats/public/route.ts` | GET | Public stats with CORS (website widget) |
| `app/api/purchaser/auth/validate/route.ts` | POST | QR code validation for purchasers (uses its own token-based auth + rate limiting) |

### Authenticated Routes (8)

| Route | Methods | Roles |
|-------|---------|-------|
| `app/api/broadcasts/route.ts` | GET, POST | `developer`, `admin`, `super_admin` |
| `app/api/developments/route.ts` | GET | `developer`, `super_admin` |
| `app/api/documents/route.ts` | GET | `developer`, `admin`, `super_admin` |
| `app/api/important-docs/route.ts` | GET | `developer`, `admin`, `super_admin` |
| `app/api/integrations/route.ts` | GET, DELETE | `developer`, `admin`, `super_admin` |
| `app/api/noticeboard/route.ts` | GET, POST | `developer`, `super_admin` |
| `app/api/pipeline/route.ts` | GET | `developer`, `admin`, `super_admin` |
| `app/api/train/route.ts` | POST, GET | `developer`, `admin`, `super_admin` |

**Note**: `developments/route.ts` POST handler (`handleCreateDevelopment`) is an imported function from `@openhouse/api/developments` — it was not wrapped here as it has its own auth handling.

## Changes Per Route

For each authenticated route:
1. Replaced `import { requireRole } from '@/lib/supabase-server'` with `import { withAuth } from '@/lib/api-auth-middleware'`
2. Changed `export async function METHOD(...)` to `export const METHOD = withAuth(async function METHOD(req, { session }) { ... }, { roles: [...] })`
3. Removed inline `await requireRole([...])` calls (session now provided by wrapper)
4. Removed duplicated `UNAUTHORIZED` / `FORBIDDEN` catch blocks (handled by wrapper)

For each public route:
1. Added `import { withAuth } from '@/lib/api-auth-middleware'`
2. Wrapped handler with `withAuth(handler, { public: true })`
3. No other changes

## Design: Opt-Out vs Opt-In

The middleware uses an **opt-out** model: all routes require authentication by default. To make a route public, you must explicitly pass `{ public: true }`. This prevents accidental unauthenticated endpoints — the original audit found 10 routes that shipped without auth because developers forgot to add it (opt-in failure).

## Build Status

`npm run build` passes with zero TypeScript errors.
