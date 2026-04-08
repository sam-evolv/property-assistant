-- ============================================================
-- RLS Admin Login Fix
-- Fixes "Access Not Configured" for admin users (e.g. sam@evolvai.ie)
--
-- ROOT CAUSE ANALYSIS
-- middleware.ts (line 200-205) queries the admins table using
-- createMiddlewareClient — the anon/user JWT Supabase client, which
-- is subject to RLS. The admins table had no authenticated-user
-- SELECT policy, so the query returned 0 rows, role resolved to null,
-- and resolveDefaultRoute(null) redirected to /access-pending.
--
-- The db Drizzle client (SUPABASE_DB_URL, direct postgres) bypasses
-- RLS, so API routes using getAdminContextFromSession() were fine.
-- Only the middleware path was broken.
--
-- STEP 1 DIAGNOSTICS — run these first to confirm your environment:
-- ============================================================

-- 1a: Confirm sam@evolvai.ie auth user exists
-- SELECT id, email FROM auth.users WHERE email = 'sam@evolvai.ie';

-- 1b: Confirm sam@evolvai.ie is in admins
-- SELECT id, email, role, tenant_id FROM public.admins WHERE email = 'sam@evolvai.ie';

-- 1c: Check if sam has any user_developments records
-- SELECT * FROM public.user_developments
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'sam@evolvai.ie');
-- (Expected: 0 rows — admins use tenant_id scoping, not user_developments)

-- 1d: Confirm developments exist for sam's tenant
-- SELECT d.id, d.name, d.tenant_id
-- FROM public.developments d
-- JOIN public.admins a ON a.tenant_id = d.tenant_id
-- WHERE a.email = 'sam@evolvai.ie';

-- 1e: See all current developments policies before we change them
-- SELECT policyname, roles, cmd, qual FROM pg_policies
-- WHERE tablename = 'developments';

-- 1f: See all current admins policies
-- SELECT policyname, roles, cmd, qual FROM pg_policies
-- WHERE tablename = 'admins';

-- ============================================================
-- FIX 1 (CRITICAL — fixes login failure immediately)
-- Add self-read policy to admins table.
-- middleware.ts queries admins via auth client — needs this to
-- resolve the user's role for routing.
-- ============================================================

CREATE POLICY "Admins can read own record" ON public.admins
  FOR SELECT TO authenticated
  USING (email = auth.jwt() ->> 'email');

-- ============================================================
-- FIX 2 — developments SELECT policy
-- Previous policy only allowed access via user_developments.
-- Admin users are identified by admins.tenant_id, not user_developments.
-- Replace with a two-arm policy: admins via tenant join, OR
-- purchasers/agents via user_developments.
-- ============================================================

DROP POLICY "Users can view own developments" ON public.developments;

CREATE POLICY "Users can view own developments" ON public.developments
  FOR SELECT TO authenticated
  USING (
    -- Arm 1: Admin users — scoped to their tenant via admins table
    id IN (
      SELECT d.id
      FROM public.developments d
      JOIN public.admins a ON a.tenant_id = d.tenant_id
      WHERE a.email = auth.jwt() ->> 'email'
    )
    OR
    -- Arm 2: Purchaser / agent users — scoped via explicit user_developments mapping
    id IN (
      SELECT development_id
      FROM public.user_developments
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- FIX 3 — admins table: ensure RLS is enabled
-- (Should already be enabled from P0; this is a no-op if so)
-- ============================================================

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FIX 4 — users table: add admin bypass for dashboard reads
-- Own-record SELECT already exists. Add an admin arm so the
-- developer dashboard can see users within the admin's tenant.
-- CONDITIONAL: only run if you have a "Users can view own record"
-- policy AND the developer dashboard queries the users table
-- directly via the auth client.
-- ============================================================

-- Check first — if this policy doesn't exist, skip Fix 4:
-- SELECT policyname FROM pg_policies
-- WHERE tablename = 'users' AND policyname = 'Users can view own record';

-- If policy exists, run:
-- DROP POLICY "Users can view own record" ON public.users;
--
-- CREATE POLICY "Users can view own record" ON public.users
--   FOR SELECT TO authenticated
--   USING (
--     -- Own record
--     id = auth.uid()
--     OR
--     -- Admin sees users in their tenant's developments
--     id IN (
--       SELECT u.id
--       FROM public.users u
--       JOIN public.units un ON un.user_id = u.id
--       JOIN public.developments d ON d.id = un.development_id
--       JOIN public.admins a ON a.tenant_id = d.tenant_id
--       WHERE a.email = auth.jwt() ->> 'email'
--     )
--   );

-- NOTE: Fix 4 is commented out because:
-- 1. The units table from the live DB has a different schema than
--    schema.ts (live DB uses project_id; schema.ts uses development_id).
--    Inspect the actual units columns before running this.
-- 2. The developer dashboard may already use the service_role db client
--    (Drizzle direct connection) for user queries, making this unnecessary.
-- Uncomment and adapt after verifying.

-- ============================================================
-- FIX 5 — DO NOT insert user_developments for sam
-- This was proposed in the task but is the wrong approach.
-- Reason: admin access should be derived from admins.tenant_id,
-- not a manual per-row join table. Every new development would
-- need a manual insert. The two-arm developments policy (Fix 2)
-- is the correct solution.
-- ============================================================

-- ============================================================
-- VERIFICATION — run after applying fixes above
-- ============================================================

-- V1: Confirm admins now has a SELECT policy
SELECT policyname, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'admins'
ORDER BY policyname;

-- V2: Confirm developments policy now has two arms
SELECT policyname, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'developments'
ORDER BY policyname;

-- V3: Simulate what sam@evolvai.ie will see (substitute real UUID from 1a)
-- SELECT id, name FROM public.developments
-- WHERE (
--   id IN (
--     SELECT d.id FROM public.developments d
--     JOIN public.admins a ON a.tenant_id = d.tenant_id
--     WHERE a.email = 'sam@evolvai.ie'
--   )
--   OR
--   id IN (
--     SELECT development_id FROM public.user_developments
--     WHERE user_id = '<UUID-FROM-1a>'
--   )
-- );
