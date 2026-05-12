-- Applicant broadcast audit table for the agent-intelligence bulk-email
-- feature. One row per broadcast attempt, regardless of final delivery.
-- Drafts created by a broadcast carry broadcast_id pointing back here so a
-- single confirm gesture writes N rows in pending_drafts atomically.
--
-- Applied to project mddxbilpjukwskeefakz on 2026-05-12 via
-- apply_migration (Supabase MCP). This file is kept in the repo as the
-- source-of-truth replay for fresh environments.

CREATE TABLE IF NOT EXISTS public.broadcast_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  agent_id uuid NOT NULL REFERENCES auth.users(id),
  intent text NOT NULL,
  filter_used jsonb NOT NULL,
  recipient_count integer NOT NULL CHECK (recipient_count >= 0),
  status text NOT NULL CHECK (status IN ('drafted','sent','partial_sent','cancelled')),
  sent_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_audit_log_agent_created
  ON public.broadcast_audit_log (agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_broadcast_audit_log_tenant_created
  ON public.broadcast_audit_log (tenant_id, created_at DESC);

ALTER TABLE public.broadcast_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS broadcast_audit_log_owner_select ON public.broadcast_audit_log;
CREATE POLICY broadcast_audit_log_owner_select
  ON public.broadcast_audit_log
  FOR SELECT
  USING (agent_id = auth.uid());

DROP POLICY IF EXISTS broadcast_audit_log_owner_modify ON public.broadcast_audit_log;
CREATE POLICY broadcast_audit_log_owner_modify
  ON public.broadcast_audit_log
  FOR ALL
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

DROP POLICY IF EXISTS broadcast_audit_log_service_role ON public.broadcast_audit_log;
CREATE POLICY broadcast_audit_log_service_role
  ON public.broadcast_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Group multiple pending_drafts rows under a single broadcast. Null is
-- the historical case (single-recipient drafts created outside this
-- feature) and stays valid.
ALTER TABLE public.pending_drafts
  ADD COLUMN IF NOT EXISTS broadcast_id uuid REFERENCES public.broadcast_audit_log(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pending_drafts_broadcast_id
  ON public.pending_drafts (broadcast_id)
  WHERE broadcast_id IS NOT NULL;
