# Next.js 14 → 16 Upgrade Report

## Summary

Upgraded the OpenHouse AI monorepo from Next.js 14.2.x to Next.js 16.2.2, resolving all 5 Next.js CVEs (1 critical, 4 high). React upgraded from 18.x to 19.x.

## Version Changes

| Package | Before | After |
|---------|--------|-------|
| `next` | 14.2.18 / 14.2.35 | 16.2.2 |
| `react` | 18.3.1 | 19.2.4 |
| `react-dom` | 18.3.1 | 19.2.4 |
| `@types/react` | ^18 | ^19.2.14 |
| `@types/react-dom` | ^18 | ^19.2.3 |

Updated across all workspace packages: `apps/unified-portal`, `apps/marketing`, `packages/api`, root `package.json`, and `property-assistant/package.json`.

## Codemod Applied

Ran `npx @next/codemod@canary next-async-request-api` which modified **74 files**:
- All `params` and `searchParams` in route handlers and page components converted to `Promise<>` types with `await`
- All `cookies()` calls made async with `await`
- All `headers()` calls made async with `await`

## Build Errors Encountered and Fixed

### Error 1: Turbopack/Webpack config conflict
**Error**: `This build is using Turbopack, with a webpack config and no turbopack config`
**Cause**: Next.js 16 defaults to Turbopack; project had webpack config but no turbopack config.
**Fix**: Added `turbopack: {}` to `next.config.js` and `serverExternalPackages` for server-only packages. Removed deprecated `eslint` config key.

### Error 2: `ssr: false` in Server Components (3 files)
**Error**: `` `ssr: false` is not allowed with `next/dynamic` in Server Components ``
**Files**:
- `app/super/developers/page.tsx`
- `app/super/page.tsx`
- `app/super/training-jobs/page.tsx`
**Cause**: Next.js 16 enforces that `next/dynamic` with `ssr: false` can only be used in Client Components.
**Fix**: Extracted the `dynamic()` calls into separate `'use client'` wrapper components:
- `DevelopersClientWrapper.tsx`
- `SuperDashboardWrapper.tsx`
- `TrainingJobsClientWrapper.tsx`
Server components still handle auth (`requireRole`) then render the client wrapper.

### Error 3: Multiline className string parse errors (4 files)
**Error**: `Module parse failed: Unterminated string constant`
**Files**:
- `app/care-dashboard/intelligence/intelligence-client.tsx`
- `app/developer/scheme-intelligence/page.tsx`
- `components/pre-handover/PreHandoverHome.tsx`
- `components/pre-handover/sheets/FAQSheet.tsx`
**Cause**: SWC compiler + styled-jsx in Next.js 16 outputs broken JavaScript when JSX `className="..."` string attributes span multiple lines (newlines inside the string literal).
**Fix**: Collapsed all multiline `className` string values onto single lines. No class names were changed.

### Error 4: OOM during webpack build
**Error**: Build process `Killed` by OOM killer
**Cause**: Next.js 16 webpack builds use significantly more memory than Next.js 14.
**Fix**: Added `NODE_OPTIONS='--max-old-space-size=8192'` to the build script. Turbopack (default) also works with this setting.

## Config Changes

### `next.config.js`
- Removed `eslint: { ignoreDuringBuilds: true }` (no longer supported in Next.js 16)
- Added `serverExternalPackages: ['pdf-parse', 'canvas', 'pdfkit']` (replaces webpack externals for these)
- Added `turbopack: {}` (acknowledges Turbopack as default bundler)
- Kept `webpack` config for backwards compatibility

### `package.json` (unified-portal)
- Build script: `NODE_OPTIONS='--max-old-space-size=8192' next build`

## Vulnerability Impact

| Stage | Vulnerabilities |
|-------|----------------|
| Before upgrade (session start) | 17 (6 moderate, 9 high, 2 critical) |
| After dependency fixes (pre-Next.js upgrade) | 9 (4 moderate, 4 high, 1 critical) |
| After Next.js 16 upgrade | **8 (4 moderate, 4 high, 0 critical)** |

### CVEs Resolved by This Upgrade
- GHSA-7m27-7ghc-44w9 (critical) — Next.js DoS with Server Actions
- GHSA-3h52-269p-cp9r — Information exposure in dev server
- GHSA-g5qg-72qw-gw5v — Cache Key Confusion for Image Optimization
- GHSA-4342-x723-ch2f — Improper Middleware Redirect → SSRF
- GHSA-xv57-4mr9-wg8v — Content Injection in Image Optimization
- GHSA-qpjv-v59x-3qc4 — Race Condition to Cache Poisoning
- GHSA-mwv6-3258-q52c — DoS with Server Components
- GHSA-5j59-xgg2-r9c4 — DoS Server Components follow-up
- GHSA-9g9p-9gw9-jx7f — DoS via Image Optimizer remotePatterns
- GHSA-h25m-26qc-wcjf — DoS with insecure RSC deserialization
- GHSA-f82v-jwr5-mffw — Authorization Bypass in Middleware
- GHSA-ggv3-7p47-pfv8 — HTTP request smuggling in rewrites
- GHSA-3x4c-7xq6-9pq8 — Unbounded next/image disk cache growth

### Remaining Vulnerabilities (8)
All unrelated to Next.js:
- 4 moderate: `esbuild` (dev-only, via `drizzle-kit`)
- 4 high: `tar` chain (transitive via `unpdf` → `canvas` → `@mapbox/node-pre-gyp`)

## Verification

- `npm run build`: **PASSES** (Turbopack, zero errors)
- `npm audit`: **0 critical, 0 Next.js vulnerabilities**
- `npm run dev`: **Starts successfully** (Next.js 16.2.2 Turbopack, ready in 389ms)

## Warnings (Non-blocking)

1. **Middleware deprecation**: `The "middleware" file convention is deprecated. Please use "proxy" instead.` — This is a Next.js 16 warning about the upcoming migration from `middleware.ts` to `proxy.ts`. The current middleware still works but should be migrated in a future PR.
2. **Custom Cache-Control headers**: Warning about `/_next/static/:path*` custom cache headers. Non-breaking.
