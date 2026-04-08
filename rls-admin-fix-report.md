# RLS Admin Login Fix — Diagnosis & Changes Report

**Date:** 2026-04-08  
**Branch:** `claude/supabase-rls-fixes-y1X9A`  
**Migration file:** `migrations/0008_rls_admin_login_fix.sql`  
**MCP status:** Disconnected this session — diagnostic SQL is provided for manual
execution in Supabase SQL Editor. The root cause was identified by static code
analysis of `middleware.ts`, `lib/supabase-server.ts`, `lib/api-auth.ts`, and
`packages/db/client.ts`.

---

## Step 1 — Diagnosis (Code Analysis)

### Key finding: two different database clients in use

| Client | Used by | RLS applied? |
|---|---|---|
| `createMiddlewareClient` (anon + JWT) | `middleware.ts` | **YES** |
| `createServerComponentClient` (anon + JWT) | `lib/supabase-server.ts` | **YES** |
| `getSupabaseAdmin()` (service_role key) | fallback in `lib/supabase-server.ts` | No (service_role bypasses) |
| `db` (Drizzle, direct `SUPABASE_DB_URL`) | `lib/api-auth.ts`, API routes | **No** (postgres superuser bypasses RLS) |

The `db` Drizzle client connects via `SUPABASE_DB_URL` as the `postgres` role — a
direct PostgreSQL connection that **bypasses RLS entirely**. API routes using
`getAdminContextFromSession()` were unaffected by the RLS changes.

The middleware is the only path that uses the user's JWT client to query `admins`.

---

### Root Cause — admins table, NOT developments

**File:** `middleware.ts`, lines 200–211

```typescript
const { data: adminData, error: adminError } = await supabase
  .from('admins')
  .select('role, preferred_role')
  .eq('email', user!.email)
  .single();

if (!adminError && adminData?.role) {
  role = adminData.role as AdminRole;
}
```

`supabase` here is `createMiddlewareClient({ req, res })` — the user's JWT auth
client, fully subject to RLS.

The `admins` table had **no SELECT policy for authenticated users** — only a
`service_role` ALL bypass applied in P0/P1. The JWT client query returned 0 rows.
With `role` staying `null`, `resolveDefaultRoute(null)` returned `/access-pending`,
and the middleware redirected every admin user to "Access Not Configured" before
they reached the dashboard.

The `db` Drizzle client path (`getAdminContextFromSession()` in `api-auth.ts`) was
never hit during middleware routing — it's used by API routes after the user is
already past the middleware guard.

---

### 1a — auth.users (expected)
```sql
SELECT id, email FROM auth.users WHERE email = 'sam@evolvai.ie';
-- Expected: 1 row with a UUID
```

### 1b — admins (expected)
```sql
SELECT id, email, role, tenant_id FROM public.admins WHERE email = 'sam@evolvai.ie';
-- Expected: 1 row (super_admin or admin), tenant_id = <EvolvAI tenant UUID>
-- If 0 rows: sam has no admin record — the user needs to be provisioned, not an RLS fix
```

### 1c — user_developments (expected)
```sql
SELECT * FROM public.user_developments
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'sam@evolvai.ie');
-- Expected: 0 rows
-- Admin users access developments via admins.tenant_id, not user_developments.
-- This is why inserting user_developments records (Step 4) would be wrong —
-- every new development would require a manual insert.
```

### 1d — developments sam should see (expected)
```sql
SELECT d.id, d.name, d.tenant_id
FROM public.developments d
JOIN public.admins a ON a.tenant_id = d.tenant_id
WHERE a.email = 'sam@evolvai.ie';
-- Expected: all developments for the EvolvAI tenant
```

### 1e/1f — policies before change
```sql
-- admins: only service_role ALL policy (no SELECT for authenticated)
-- developments: only "Users can view own developments" (user_developments only) + service_role ALL
```

---

## Step 2 — Fix the developments policy

**Problem:** The P1C policy only allowed access via `user_developments`. Admin
users have no rows there; their access is via `admins.tenant_id`.

**Fix:** Two-arm policy — admins via tenant JOIN, purchasers/agents via
`user_developments`.

```sql
DROP POLICY "Users can view own developments" ON public.developments;

CREATE POLICY "Users can view own developments" ON public.developments
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT d.id
      FROM public.developments d
      JOIN public.admins a ON a.tenant_id = d.tenant_id
      WHERE a.email = auth.jwt() ->> 'email'
    )
    OR
    id IN (
      SELECT development_id
      FROM public.user_developments
      WHERE user_id = auth.uid()
    )
  );
```

**Security analysis:**
- `auth.jwt() ->> 'email'` is the verified email from the Supabase-signed JWT —
  safe to use as an identity claim. Not user-controllable.
- Admin can only see developments where their tenant_id matches — no cross-tenant
  leakage.
- Purchasers continue to see only explicitly granted developments via `user_developments`.
- `developments_service_role_all` (applied in P1C) continues to give service_role
  unrestricted access.

---

## Step 3 — admins table SELECT policy (CRITICAL)

This is the **direct fix for the login failure.**

```sql
CREATE POLICY "Admins can read own record" ON public.admins
  FOR SELECT TO authenticated
  USING (email = auth.jwt() ->> 'email');
```

Allows an authenticated user to read their own row in `admins`, matched by their
verified JWT email claim. No other rows are visible.

**Security analysis:**
- Single-row self-read only — no admin can read another admin's record via this path.
- `auth.jwt() ->> 'email'` is from the signed Supabase JWT, not user-supplied input.
- The middleware only needs `role` and `preferred_role` — minimal exposure.

---

## Step 4 — user_developments INSERT: NOT applied (wrong approach)

Inserting `user_developments` rows for `sam@evolvai.ie` was considered and rejected:

- Admins derive access from `admins.tenant_id` — this is the semantically correct
  join. Manually maintaining `user_developments` for admins would drift over time
  (every new development requires a manual insert).
- The Fix 2 developments policy correctly handles admin access without any data
  migration.

---

## Step 5 — users table policy (conditional, not applied)

The users table fix from the task is **commented out** in the migration for two
reasons:

1. **Schema mismatch:** The task's proposed USING clause joins
   `units.development_id`. The live DB `units` table (from P1B inspection) has a
   `project_id` column, not `development_id`. Running the query as written would
   return 0 rows silently (no error, just no data). The correct column name must
   be verified before applying.

2. **May be unnecessary:** The developer dashboard queries via the `db` Drizzle
   client (direct postgres), which bypasses RLS. Check whether any dashboard page
   uses the auth Supabase client to query `users`. If all user lookups go through
   `db`, this policy adds no value.

**To apply after verification:**
```sql
-- Confirm units column name first:
SELECT column_name FROM information_schema.columns
WHERE table_name = 'units' AND table_schema = 'public'
AND column_name IN ('development_id', 'project_id');

-- Then adapt the users policy accordingly (see migration file §FIX 4)
```

---

## Step 6 — Simulation query

Run in SQL Editor to verify sam's developments are visible (substitute real UUID):

```sql
SELECT id, name FROM public.developments
WHERE (
  id IN (
    SELECT d.id FROM public.developments d
    JOIN public.admins a ON a.tenant_id = d.tenant_id
    WHERE a.email = 'sam@evolvai.ie'
  )
  OR
  id IN (
    SELECT development_id FROM public.user_developments
    WHERE user_id = '<UUID-FROM-1a>'
  )
);
```

Expected: all developments under the EvolvAI tenant.

---

## Step 7 — Post-fix portal smoke tests

| Portal | Expected outcome after fix |
|---|---|
| Developer dashboard — sam@evolvai.ie | Login succeeds; all tenant developments visible |
| Admin portal — sam@evolvai.ie | Full access; Fix 1 (admins read) unblocks middleware |
| Super admin portal — sam@evolvai.ie | Depends on actual role (`super_admin`); Fix 1 resolves routing |
| Purchaser QR login | Unaffected — uses `user_developments` arm of Fix 2 policy |
| Agent portal | Unaffected — agent policies in `agent_profiles`/`agent_tasks` are unchanged |

---

## Constraints satisfied

| Constraint | Status |
|---|---|
| No P0 security fixes reverted | ✓ All existing policies intact |
| No anon access opened | ✓ All new policies are `TO authenticated` |
| No cross-tenant exposure | ✓ admins policy is email-scoped self-read; developments uses tenant JOIN |
| Fix is additive | ✓ Added OR arm to developments; added new admins policy |
| No guessing on ambiguous schema | ✓ Fix 4 (users) is commented out pending column verification |

---

## Changes summary

| Fix | SQL | Status |
|---|---|---|
| admins self-read (CRITICAL) | `CREATE POLICY "Admins can read own record" ...` | **Apply immediately** |
| developments two-arm policy | DROP + CREATE with admin OR purchaser arms | **Apply immediately** |
| admins RLS enabled | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` | No-op if already enabled |
| users admin bypass | commented out | **Verify first, then apply** |
| user_developments INSERT for sam | rejected | Do not apply |

**To apply:** Run `migrations/0008_rls_admin_login_fix.sql` in the Supabase SQL
Editor (the Supabase MCP was unavailable this session).
Uncomment Fix 4 only after verifying the `units` column name.
