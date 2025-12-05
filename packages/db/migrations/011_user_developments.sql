-- Migration: 011_user_developments.sql
-- Purpose: Multi-development access control with users table and development mappings
-- This allows users to be mapped to multiple developments within their tenant

-- =====================================================
-- STEP 1: Create users table (syncs with Supabase auth.users)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.users (
  id            uuid PRIMARY KEY,  -- Matches auth.users.id
  tenant_id     uuid REFERENCES public.tenants (id) ON DELETE CASCADE,
  email         text,
  role          text NOT NULL DEFAULT 'user',  -- user, tenant_admin, platform_admin
  metadata      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for tenant-scoped queries
CREATE INDEX IF NOT EXISTS users_tenant_idx ON public.users (tenant_id);
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);
CREATE INDEX IF NOT EXISTS users_role_idx ON public.users (role);

COMMENT ON TABLE public.users IS 'Application users synced with Supabase auth.users';
COMMENT ON COLUMN public.users.id IS 'Matches auth.users.id from Supabase Auth';
COMMENT ON COLUMN public.users.role IS 'User role: user, tenant_admin, platform_admin';

-- =====================================================
-- STEP 2: Create user_developments mapping table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_developments (
  user_id        uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  development_id uuid NOT NULL REFERENCES public.developments (id) ON DELETE CASCADE,
  role           text NOT NULL DEFAULT 'member',
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, development_id)
);

-- Index for queries by development (find all users for a development)
CREATE INDEX IF NOT EXISTS user_developments_development_idx
  ON public.user_developments (development_id, user_id);

-- Index for queries by user (find all developments for a user)
CREATE INDEX IF NOT EXISTS user_developments_user_idx
  ON public.user_developments (user_id, development_id);

COMMENT ON TABLE public.user_developments IS 'Maps users to developments for multi-development access control';
COMMENT ON COLUMN public.user_developments.role IS 'Role within the development: member, manager, admin';
