# OpenHouse AI - Production Hardening Documentation

> Last Updated: 2025-12-22
> Status: Phase 1-6 Complete - Core Hardening Active

## Overview

This document tracks the production hardening pass for the OpenHouse AI Unified Portal. The goal is to convert the MVP into a production-grade, load-tolerant, secure, and resilient application.

### Target Scale
- 10+ developers
- 10+ concurrent developments  
- 1,000–5,000 houses
- Sustained concurrent usage

## Critical Flows

### 1. Purchaser Flow (Highest Priority)
- **Entry**: QR code scan → `/homes/[unitUid]`
- **Resolution**: `/api/houses/resolve` - converts unit UID to project context
- **Profile**: `/api/purchaser/profile` - fetches unit details, purchaser info
- **Chat**: `/api/chat` - AI-powered home assistant
- **Documents**: `/api/purchaser/docs-list` - floor plans, specs
- **Noticeboard**: `/api/purchaser/noticeboard` - community posts

### 2. Developer Flow
- **Auth**: `/api/auth/login`, `/api/auth/me`
- **Dashboard**: `/api/analytics/developer/dashboard`
- **Developments**: `/api/developments`, `/api/developments/[id]`
- **Units**: `/api/admin/units`, `/api/homeowners`
- **Documents**: `/api/documents`, `/api/documents/upload`

### 3. Super Admin Flow
- **Platform Overview**: `/api/analytics/platform/overview`
- **All Developments**: `/api/developments`
- **Homeowners Directory**: `/api/super/homeowners`
- **Units Explorer**: `/api/super/units`
- **Analytics**: Multiple `/api/analytics-v2/*` endpoints

## Busiest API Routes (Hot Paths)

| Route | Type | Frequency | Caching Priority |
|-------|------|-----------|------------------|
| `/api/houses/resolve` | GET | Every QR scan | HIGH |
| `/api/purchaser/profile` | GET | Every home view | HIGH |
| `/api/chat` | POST | User interaction | NO CACHE |
| `/api/purchaser/docs-list` | GET | Document access | MEDIUM |
| `/api/purchaser/noticeboard` | GET | Community view | MEDIUM |
| `/api/auth/me` | GET | Every auth check | LOW TTL |
| `/api/developments` | GET | Dashboard load | MEDIUM |
| `/api/analytics/*` | GET | Dashboard load | MEDIUM |

## Known Fragility Points

1. **Database Connection Exhaustion**: ~~Multiple concurrent requests can exhaust the connection pool~~ MITIGATED - Connection pooling configured (10 max, 2 min)
2. **Unbounded Queries**: Some routes lack pagination limits - PARTIALLY FIXED
3. **N+1 Patterns**: Document listings may query per-item - DEFERRED
4. **No Rate Limiting**: ~~API routes vulnerable to abuse~~ FIXED - Rate limiting active on hot paths
5. **Chat Timeouts**: OpenAI calls can hang without timeout - EXISTING TIMEOUT
6. **Session Validation**: Every request validates session against database - ACCEPTABLE

## Build Commands

```bash
# Development
npm --prefix apps/unified-portal run dev

# Build
npm --prefix apps/unified-portal run build

# Type Check
npm --prefix apps/unified-portal run typecheck
```

## Smoke Test Checklist

- [ ] App builds without errors
- [ ] `/api/health` returns ok
- [ ] `/login` page loads
- [ ] QR code flow works (`/homes/[unitUid]`)
- [ ] Chat responds to queries
- [ ] Developer dashboard loads
- [ ] Super admin dashboard loads
- [ ] Documents list loads in archive

---

## Change Log

### Phase 0 - Baseline (2025-12-22)
- Created HARDENING.md documentation
- Identified critical flows and hot paths
- Documented known fragility points

### Phase 1 - API Route Stability Layer (2025-12-22)
- [x] Created `lib/api/route-utils.ts` with `withRouteGuard` wrapper
- [x] Created `lib/api/errors.ts` with standard error codes (TIMEOUT, BAD_REQUEST, etc.)
- [x] Created `lib/api/middleware.ts` with `withAPIMiddleware` for rate limiting
- [x] Error normalization and timeout handling implemented
- [x] Request ID generation and propagation

### Phase 2 - TTL Caching (2025-12-22)
- [x] Created `lib/cache/ttl-cache.ts` with short TTL in-memory cache
- [x] Max entries cap (500 entries)
- [x] Automatic cleanup and eviction
- [x] `wrap(fn)` helper for easy caching

### Phase 3 - Rate Limiting (2025-12-22)
- [x] Created `lib/security/rate-limit.ts` with token bucket algorithm
- [x] Route-specific rate limits (chat: 30/min, dashboard: 120/min, public: 60/min)
- [x] IP-based rate limiting
- [x] Clean 429 responses with retry-after headers
- [x] Automatic bucket cleanup
- [x] Applied rate limiting to `/api/houses/resolve` (QR hot path)
- [x] Applied rate limiting to `/api/purchaser/profile` (home view hot path)
- [x] Applied rate limiting to `/api/chat` (AI queries, 30 req/min)

### Phase 4 - Database Hygiene (2025-12-22)
- [x] Audited queries - most critical routes already have LIMIT clauses
- [x] Connection pooling configured (10 max, 2 min connections)
- [x] Retry logic for transient failures in supabase-server.ts
- [ ] Further N+1 fixes deferred to avoid regressions

### Phase 5 - Observability (2025-12-22)
- [x] Request ID propagation via x-request-id header
- [x] Created `lib/version.ts` for git SHA exposure
- [x] Health endpoint enhanced with version, pool stats, cache stats, rate limiter stats
- [x] Structured logging with timing and identifiers

### Phase 6 - Safety Scripts (2025-12-22)
- [x] Created `scripts/smoke-test.sh` - health, auth, resolve endpoints
- [x] Created `scripts/load-test.js` - concurrent request testing

### Phase 7 - Hygiene Cleanup
- [ ] Deferred to avoid regressions - conservative approach

---

## Cached Routes

| Route | TTL | Cache Key | Status |
|-------|-----|-----------|--------|
| `/api/houses/resolve` | 60s | `resolve:{token}` | ACTIVE |
| `/api/purchaser/profile` | 60s | `profile:{unitUid}` | ACTIVE |

## Rate Limit Policy

| Route Pattern | Limit | Window |
|---------------|-------|--------|
| `/api/chat` | 30 req | 1 min |
| `/api/analytics/*` | 120 req | 1 min |
| `/api/purchaser/*` | 60 req | 1 min |
| Default | 120 req | 1 min |

## Incident Debugging

1. Check request ID in logs (`x-request-id` header)
2. Search logs for `[ERROR]` or `[TIMEOUT]`
3. Check `/api/health/db` for database status
4. Review connection pool stats

## Remaining Risks

1. OpenAI API rate limits (external dependency)
2. Supabase connection limits at very high scale
3. Large file uploads without chunking
4. No CDN for static assets
