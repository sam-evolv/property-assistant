-- Row-Level Security (RLS) Policies for OpenHouse AI
-- Enable RLS on all tables and configure tenant-scoped access

-- Enable RLS on tenants table
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_select_policy" ON tenants
  FOR SELECT
  USING (
    id = COALESCE(
      (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid,
      id
    )
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "tenants_insert_policy" ON tenants
  FOR INSERT
  WITH CHECK (
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "tenants_update_policy" ON tenants
  FOR UPDATE
  USING (
    id = COALESCE(
      (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid,
      id
    )
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

-- Enable RLS on admins table
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_select_policy" ON admins
  FOR SELECT
  USING (
    tenant_id = COALESCE(
      (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid,
      tenant_id
    )
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "admins_insert_policy" ON admins
  FOR INSERT
  WITH CHECK (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "admins_update_policy" ON admins
  FOR UPDATE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

-- Enable RLS on documents table
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select_policy" ON documents
  FOR SELECT
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "documents_insert_policy" ON documents
  FOR INSERT
  WITH CHECK (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "documents_update_policy" ON documents
  FOR UPDATE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "documents_delete_policy" ON documents
  FOR DELETE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

-- Enable RLS on noticeboard_posts table
ALTER TABLE noticeboard_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "noticeboard_posts_select_policy" ON noticeboard_posts
  FOR SELECT
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "noticeboard_posts_insert_policy" ON noticeboard_posts
  FOR INSERT
  WITH CHECK (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "noticeboard_posts_update_policy" ON noticeboard_posts
  FOR UPDATE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "noticeboard_posts_delete_policy" ON noticeboard_posts
  FOR DELETE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

-- Enable RLS on pois table
ALTER TABLE pois ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pois_select_policy" ON pois
  FOR SELECT
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "pois_insert_policy" ON pois
  FOR INSERT
  WITH CHECK (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "pois_update_policy" ON pois
  FOR UPDATE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "pois_delete_policy" ON pois
  FOR DELETE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

-- Enable RLS on messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select_policy" ON messages
  FOR SELECT
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "messages_insert_policy" ON messages
  FOR INSERT
  WITH CHECK (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "messages_update_policy" ON messages
  FOR UPDATE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "messages_delete_policy" ON messages
  FOR DELETE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

-- Enable RLS on analytics_daily table
ALTER TABLE analytics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analytics_daily_select_policy" ON analytics_daily
  FOR SELECT
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "analytics_daily_insert_policy" ON analytics_daily
  FOR INSERT
  WITH CHECK (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "analytics_daily_update_policy" ON analytics_daily
  FOR UPDATE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "analytics_daily_delete_policy" ON analytics_daily
  FOR DELETE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

-- =====================================================
-- MULTI-DEVELOPMENT ACCESS CONTROL (Added Dec 2025)
-- =====================================================

-- Helper function to check if user has access to a development
-- Uses auth.uid() to identify the current authenticated user
CREATE OR REPLACE FUNCTION public.user_has_development_access(dev_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_developments ud
    WHERE ud.user_id = auth.uid()
      AND ud.development_id = dev_id
  );
$$;

COMMENT ON FUNCTION public.user_has_development_access IS 'Checks if the authenticated user has access to the specified development';

-- =====================================================
-- Enable RLS on new tables
-- =====================================================

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user_developments table
ALTER TABLE public.user_developments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies for users table
-- =====================================================

CREATE POLICY "users_select_own" ON public.users
  FOR SELECT
  USING (
    id = auth.uid()
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "users_insert_self" ON public.users
  FOR INSERT
  WITH CHECK (
    id = auth.uid()
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE
  USING (
    id = auth.uid()
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

-- =====================================================
-- RLS Policies for user_developments table
-- =====================================================

-- Users can view their own development mappings
CREATE POLICY "user_developments_select_own" ON public.user_developments
  FOR SELECT
  USING (user_id = auth.uid());

-- Tenant admins can add user development mappings
CREATE POLICY "user_developments_insert_admin" ON public.user_developments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'tenant_admin'
    )
  );

-- Tenant admins can update user development mappings
CREATE POLICY "user_developments_update_admin" ON public.user_developments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'tenant_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'tenant_admin'
    )
  );

-- Tenant admins can delete user development mappings
CREATE POLICY "user_developments_delete_admin" ON public.user_developments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'tenant_admin'
    )
  );

-- =====================================================
-- Development-scoped RLS Policies using helper function
-- =====================================================

-- Users see only developments they are mapped to
CREATE POLICY "developments_select_user_access" ON public.developments
  FOR SELECT
  USING (
    public.user_has_development_access(id)
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

-- Users see documents in their developments
CREATE POLICY "documents_select_user_access" ON public.documents
  FOR SELECT
  USING (
    public.user_has_development_access(development_id)
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

-- Users see doc_chunks in their developments
CREATE POLICY "doc_chunks_select_user_access" ON public.doc_chunks
  FOR SELECT
  USING (
    public.user_has_development_access(development_id)
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

-- Ensure RLS is enabled on doc_chunks (may already be enabled)
ALTER TABLE public.doc_chunks ENABLE ROW LEVEL SECURITY;
