-- ============================================================
-- RLS Phase 1A: Enable Row Level Security on 22 tables
-- and add service_role bypass + user-scoped read policies
-- ============================================================
-- Run in Supabase SQL Editor, statement by statement.
-- Tables not found in schema are wrapped in DO $$ blocks
-- to avoid hard errors; a NOTICE is raised instead.
-- ============================================================

-- ─────────────────────────────────────────────────────────
-- STEP 1: Enable RLS on all 22 tables
-- ─────────────────────────────────────────────────────────

ALTER TABLE public.amenity_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.btr_amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.btr_tenancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.house_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_selection_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notice_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noticeboard_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poi_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheme_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_room_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.welcome_sequences ENABLE ROW LEVEL SECURITY;

-- Tables not confirmed in schema — wrapped defensively:
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='custom_qa') THEN
    ALTER TABLE public.custom_qa ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS enabled on custom_qa';
  ELSE
    RAISE NOTICE 'SKIP: table custom_qa does not exist';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='platform_insights') THEN
    ALTER TABLE public.platform_insights ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS enabled on platform_insights';
  ELSE
    RAISE NOTICE 'SKIP: table platform_insights does not exist';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='question_analytics') THEN
    ALTER TABLE public.question_analytics ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS enabled on question_analytics';
  ELSE
    RAISE NOTICE 'SKIP: table question_analytics does not exist';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────
-- STEP 2: service_role bypass policies (all 22 tables)
-- ─────────────────────────────────────────────────────────

CREATE POLICY "service_role_bypass" ON public.amenity_bookings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass" ON public.analytics_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass" ON public.btr_amenities
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass" ON public.btr_tenancies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass" ON public.compliance_document_types
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass" ON public.compliance_schedule
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass" ON public.data_access_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass" ON public.house_types
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass" ON public.kitchen_selection_options
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass" ON public.kitchen_selections
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass" ON public.knowledge_base
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass" ON public.maintenance_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass" ON public.notice_audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass" ON public.noticeboard_posts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass" ON public.poi_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass" ON public.scheme_profile
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass" ON public.unit_room_dimensions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass" ON public.video_resources
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass" ON public.welcome_sequences
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Defensive: only create if table exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='custom_qa') THEN
    EXECUTE $p$CREATE POLICY "service_role_bypass" ON public.custom_qa
      FOR ALL TO service_role USING (true) WITH CHECK (true)$p$;
    RAISE NOTICE 'service_role_bypass policy created on custom_qa';
  ELSE
    RAISE NOTICE 'SKIP: service_role_bypass on custom_qa — table does not exist';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='platform_insights') THEN
    EXECUTE $p$CREATE POLICY "service_role_bypass" ON public.platform_insights
      FOR ALL TO service_role USING (true) WITH CHECK (true)$p$;
    RAISE NOTICE 'service_role_bypass policy created on platform_insights';
  ELSE
    RAISE NOTICE 'SKIP: service_role_bypass on platform_insights — table does not exist';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='question_analytics') THEN
    EXECUTE $p$CREATE POLICY "service_role_bypass" ON public.question_analytics
      FOR ALL TO service_role USING (true) WITH CHECK (true)$p$;
    RAISE NOTICE 'service_role_bypass policy created on question_analytics';
  ELSE
    RAISE NOTICE 'SKIP: service_role_bypass on question_analytics — table does not exist';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────
-- STEP 3: User-scoped policies
--
-- SCHEMA INSPECTION RESULTS (packages/db/schema.ts):
--   kitchen_selections   → NO user_id  (has tenant_id, unit_id)
--   amenity_bookings     → NO user_id  (has tenancy_id, development_id)
--   maintenance_requests → NO user_id  (has unit_id, tenancy_id)
--   noticeboard_posts    → NO user_id  (has tenant_id, development_id)
--
-- DECISION: All user_id = auth.uid() policies SKIPPED.
--   See /rls-p1a-report.md §4 for rationale and alternatives.
-- ─────────────────────────────────────────────────────────

-- kitchen_selections: SKIPPED — no user_id column.
--   Alternative: scope by tenant via JWT claim.
--   CREATE POLICY "Tenant-scoped kitchen_selections" ON public.kitchen_selections
--     FOR ALL TO authenticated
--     USING ((auth.jwt()->>'tenant_id')::uuid = tenant_id)
--     WITH CHECK ((auth.jwt()->>'tenant_id')::uuid = tenant_id);

-- amenity_bookings: SKIPPED — no user_id, no tenant_id column.
--   Access is mediated via tenancy_id (linked to btr_tenancies).
--   Recommended: use service_role from API layer; no direct
--   authenticated-user policy until auth.uid() is stored on row.

-- maintenance_requests: SKIPPED — no user_id column.
--   Has tenancy_id → btr_tenancies. Enforce via service_role.

-- noticeboard_posts: SKIPPED user_id policy — no user_id column.
--   tenant_id IS present. Read policy added below.

-- noticeboard_posts authenticated read (tenant-scoped)
CREATE POLICY "Authenticated read noticeboard_posts" ON public.noticeboard_posts
  FOR SELECT TO authenticated
  USING ((auth.jwt()->>'tenant_id')::uuid = tenant_id);

-- ─────────────────────────────────────────────────────────
-- STEP 4: Reference / lookup table read policies
-- ─────────────────────────────────────────────────────────

CREATE POLICY "Authenticated read house_types" ON public.house_types
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read poi_cache" ON public.poi_cache
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read video_resources" ON public.video_resources
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read kitchen_selection_options"
  ON public.kitchen_selection_options
  FOR SELECT TO authenticated USING (true);

-- ─────────────────────────────────────────────────────────
-- STEP 5: Verification query
-- Run after all statements above to confirm rowsecurity = true
-- ─────────────────────────────────────────────────────────

SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'amenity_bookings','analytics_events','btr_amenities','btr_tenancies',
    'compliance_document_types','compliance_schedule','custom_qa',
    'data_access_log','house_types','kitchen_selection_options',
    'kitchen_selections','knowledge_base','maintenance_requests',
    'notice_audit_log','noticeboard_posts','platform_insights','poi_cache',
    'question_analytics','scheme_profile','unit_room_dimensions',
    'video_resources','welcome_sequences'
  )
ORDER BY tablename;
