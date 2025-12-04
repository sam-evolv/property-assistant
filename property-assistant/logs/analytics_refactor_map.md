# Analytics Refactor Map — Complete Dependency Audit
**Generated:** November 22, 2025  
**Purpose:** Foundation rebuild for analytics engine migration

---

## CURRENT ANALYTICS COMPONENTS

### 1. UNIFIED PORTAL — Super Admin Analytics
**Location:** `apps/unified-portal/app/super/analytics/`

#### Files:
- `analytics-client.tsx` — @needs-refactor
  - **Type:** Client Component
  - **Inputs:** `/api/admin/analytics/overview`
  - **Data Source:** `packages/api/src/analytics/computePlatformMetrics.ts`
  - **Outputs:** Platform-wide metrics dashboard
  - **Charts:** LineChart (tenant growth), BarChart (usage funnel)
  - **Caching:** 300s server-side cache (via `getOrSetJSON`)
  - **Styling:** Inline Tailwind, gradient cards, gold accents
  - **Issues:** Inconsistent spacing, no skeleton loaders, hardcoded chart configs

#### API Routes:
- `/api/admin/analytics/overview/route.ts` — @needs-refactor
  - **Input:** None (super admin session)
  - **Transform:** Calls `computePlatformMetrics(tenantId?)`
  - **Caching:** Redis-backed cache (300s TTL)
  - **Output:** Zod-validated `PlatformMetrics`

### 2. UNIFIED PORTAL — Development Deep-Dive Analytics
**Location:** `apps/unified-portal/app/super/developments/[id]/analytics/`

#### Files:
- `analytics-client.tsx` — @needs-refactor
  - **Type:** Client Component
  - **Inputs:** `/api/super/developments/[id]/analytics`
  - **Outputs:** Per-development metrics
  - **Charts:** Unknown (needs audit)
  - **Caching:** Unknown
  - **Styling:** Unknown

### 3. UNIFIED PORTAL — Chat Analytics
**Location:** `apps/unified-portal/app/super/chat-analytics/`

#### Files:
- `chat-analytics-client.tsx` — @needs-refactor
  - **Type:** Client Component
  - **Inputs:** `/api/admin/analytics/chat`
  - **Outputs:** Chat-specific metrics
  - **Charts:** Unknown
  - **Caching:** Unknown

### 4. UNIFIED PORTAL — Enterprise Overview
**Location:** `apps/unified-portal/app/admin-enterprise/`

#### Files:
- `chat-analytics-client.tsx` — @needs-refactor
- `overview-client.tsx` — @needs-refactor
- `nav-client.tsx` — @needs-refactor

### 5. TENANT PORTAL — Basic Analytics
**Location:** `apps/tenant-portal/app/admin/analytics/`

#### Files:
- `page.tsx` — @needs-refactor
  - **Type:** Server Component
  - **Inputs:** `apps/tenant-portal/data/analytics.ts`
  - **Data Source:** Direct DB queries
  - **Outputs:** Tenant-specific analytics
  - **Charts:** None (table-based)
  - **Caching:** None
  - **Styling:** Basic Tailwind

#### API Routes:
- `/api/analytics/route.ts` — @needs-refactor
- `/api/analytics/overview/route.ts` — @needs-refactor

---

## CHART COMPONENTS

### Current Chart Library
**Location:** `apps/unified-portal/components/admin-enterprise/charts/`

#### Files:
- `LineChart.tsx` — @needs-refactor
  - **Props:** `{ data, xKey, lines: Array<{ dataKey, stroke, name }> }`
  - **Library:** Recharts
  - **Styling:** Inline, dark theme, gold accents
  - **Issues:** No responsive sizing, hardcoded dimensions

- `BarChart.tsx` — @needs-refactor
  - **Props:** `{ data, xKey, bars: Array<{ dataKey, fill, name }> }`
  - **Library:** Recharts
  - **Styling:** Inline, dark theme
  - **Issues:** Same as LineChart

- `PieChart.tsx` — @needs-refactor
- `StackedBarChart.tsx` — @needs-refactor

---

## DATA SOURCES & QUERIES

### Primary Analytics Engine
**Location:** `packages/api/src/analytics/`

#### Files:
- `computePlatformMetrics.ts` — @needs-refactor
  - **Inputs:** `tenantId?: string`
  - **Database Queries:** 9 separate SQL queries
    1. Total counts (developers, developments, units, homeowners, messages, documents)
    2. Active homeowners (7d)
    3. Top 5 developments by activity
    4. Active vs dormant tenants
    5. Tenant growth (30d time series)
    6. Tenant engagement rankings
    7. Tenant health scores
    8. Cross-tenant RAG quality
    9. Cross-tenant doc ingestion
    10. Usage funnel
  - **Output:** Zod-validated `PlatformMetrics`
  - **Caching:** External (via `getOrSetJSON`)
  - **Issues:** No query batching, no prepared statements, no connection pooling awareness

- `index.ts` — @needs-refactor
  - **Exports:** `computePlatformMetrics`, `PlatformMetricsSchema`, `PlatformMetrics`

---

## CACHING INFRASTRUCTURE

### Current Implementation
**Location:** `packages/api/src/cache.ts`

- **Type:** PostgreSQL-backed cache table
- **TTL:** Configurable (default 300s for analytics)
- **Key Format:** `analytics:platform:v2:{tenantId || 'all'}`
- **Storage:** JSONB in `api_cache` table
- **Issues:** No invalidation strategy, no LRU eviction, no distributed lock

---

## STYLING INCONSISTENCIES

### Current Themes
1. **Unified Portal (Super Admin):**
   - Colors: Black background, gold accents, white text
   - Spacing: Inconsistent (mix of p-4, p-6, p-8, space-y-8, gap-6)
   - Cards: Gradient backgrounds, border-gray-700, shadow-xl
   - Animations: Inline `motion-safe:animate-fade-in`, staggered delays

2. **Unified Portal (Admin Enterprise):**
   - Colors: Similar to Super Admin
   - Spacing: Different from Super Admin
   - Cards: Different from Super Admin

3. **Tenant Portal:**
   - Colors: Default Tailwind
   - Spacing: Minimal
   - Cards: Basic borders

### Problems:
- No centralized theme system
- No spacing tokens
- No reusable card components
- No consistent motion system
- No dark/light mode parity

---

## MISSING ANALYTICS FEATURES (per STEP 2 requirements)

### Not Yet Implemented:
1. ❌ Top 10 questions
2. ❌ Top topics (RAG insights)
3. ❌ Knowledge gaps
4. ❌ Document usage statistics
5. ❌ Units by status heatmap
6. ❌ Purchaser engagement funnel
7. ❌ Chat load by day/hour
8. ❌ Estimated cost per home
9. ❌ Model usage trends
10. ❌ Missing documents report
11. ❌ Developer performance overview
12. ❌ AI answer accuracy (thumbs up/down)

---

## DEPENDENCY GRAPH

```
User Browser
    ↓
[Client Component] analytics-client.tsx
    ↓ (fetch)
[API Route] /api/admin/analytics/overview/route.ts
    ↓ (calls)
[Cache Layer] packages/api/src/cache.ts (getOrSetJSON)
    ↓ (miss)
[Analytics Engine] packages/api/src/analytics/computePlatformMetrics.ts
    ↓ (SQL)
[Database] PostgreSQL (via Drizzle ORM)
    ↓
[Tables] tenants, developments, units, homeowners, messages, documents, doc_chunks, training_jobs
```

---

## REFACTOR STRATEGY

### Phase 1: Create Analytics Engine Package
- [ ] Create `/packages/analytics-engine/` structure
- [ ] Migrate & refactor `computePlatformMetrics` → `queries.ts`
- [ ] Add new analytics features (top questions, topics, gaps, etc.)
- [ ] Implement event definitions in `events.ts`
- [ ] Add insight generation in `insights.ts`
- [ ] Add period aggregation in `stats.ts`
- [ ] Unified caching in `cache.ts`
- [ ] Chart configuration in `charts.ts`
- [ ] Zod schemas in `models.ts`

### Phase 2: Rebuild UI Components
- [ ] Create consistent spacing system
- [ ] Build premium card components
- [ ] Build chart wrapper components
- [ ] Add skeleton loaders
- [ ] Implement responsive grid

### Phase 3: Integrate & Replace
- [ ] Replace all existing analytics pages
- [ ] Remove old components
- [ ] Update API routes to use new engine
- [ ] Add end-to-end tests

---

## NEXT STEPS
Proceed to **STEP 2 — ANALYTICS ARCHITECTURE REBUILD**
