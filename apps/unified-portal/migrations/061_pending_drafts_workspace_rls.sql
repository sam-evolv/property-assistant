-- ============================================================================
-- APPLIED TO PRODUCTION via Supabase MCP on 2026-05-19.
-- DO NOT RE-RUN. Recorded here for audit / future env bootstrap only.
-- ============================================================================
--
-- Migration: 061_pending_drafts_workspace_rls.sql
--
-- Replaces the user-scoped RLS policy with a workspace-scoped one. The
-- application layer (drafts route + send-draft route + draft-store
-- writer) is the primary security boundary; this policy is belt-and-
-- braces for the case where someone queries pending_drafts via
-- PostgREST without going through the API.
--
-- The old policy (pending_drafts_self_access) said `user_id = auth.uid()`.
-- That's safe for single-workspace users but every Bridge agent has ONE
-- auth user owning TWO workspaces (sales + lettings). Under the old policy
-- a user JWT could read every draft on every workspace they own. Under
-- the new policy the workspace_id must also belong to the calling user's
-- agent_profile.
--
-- Note: the existing pending_drafts_service_role policy (USING (true))
-- is intentionally left untouched. API routes use the service-role
-- client and bypass RLS — the application-layer assertion in the read
-- paths is what enforces active-workspace scoping for those callers.

DROP POLICY IF EXISTS pending_drafts_self_access ON pending_drafts;

CREATE POLICY pending_drafts_self_workspace ON pending_drafts
  FOR ALL
  USING (
    user_id = auth.uid()
    AND (
      workspace_id IS NOT NULL
      AND workspace_id IN (
        SELECT aw.id
        FROM agent_workspaces aw
        JOIN agent_profiles ap ON aw.agent_id = ap.id
        WHERE ap.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (
      workspace_id IS NOT NULL
      AND workspace_id IN (
        SELECT aw.id
        FROM agent_workspaces aw
        JOIN agent_profiles ap ON aw.agent_id = ap.id
        WHERE ap.user_id = auth.uid()
      )
    )
  );
