-- ============================================================================
-- APPLIED TO PRODUCTION via Supabase MCP on 2026-05-19.
-- DO NOT RE-RUN. Recorded here for audit / future env bootstrap only.
-- ============================================================================
--
-- Migration: 060_pending_drafts_workspace_id_column.sql
--
-- Adds the workspace_id link to pending_drafts so the drafts inbox query
-- can no longer return a Sales draft to a Lettings session (or vice
-- versa). Bridge Property Group audit found two Sales offer drafts on
-- Unit 51 Ardan View (€515k, recipient ailbhe.tierney+u45@example.com)
-- in the Lettings drafts inbox — one tap from a sales offer reaching a
-- buyer through the wrong workspace. The root cause: drafts were
-- partitioned only by draft_type, and `buyer_followup` is a SHARED
-- type that appears in both workspaces' filters.
--
-- This migration is DDL only — column + flag + indexes. No policy
-- changes, no row updates. Three migrations chained per project
-- convention so ordering failures don't lose work mid-way:
--   060: DDL
--   061: RLS
--   062: DML backfill + CHECK constraint
--
-- workspace_id is nullable for the moment so the backfill in 062 can
-- run without the column rejecting every existing row. After 062 every
-- row either has workspace_id set or has needs_workspace_review = true,
-- enforced by a CHECK constraint added at the end of 062.

ALTER TABLE pending_drafts
  ADD COLUMN IF NOT EXISTS workspace_id UUID
    REFERENCES agent_workspaces(id) ON DELETE RESTRICT;

-- Manual-review flag for drafts whose origin is too ambiguous to map to a
-- workspace conservatively. Stays false on every new write; only the
-- backfill in 062 sets it to true. Drafts with this flag are excluded
-- from both workspace inboxes via the workspace_id JOIN in the read
-- path, so they never bleed while a human triages them.
ALTER TABLE pending_drafts
  ADD COLUMN IF NOT EXISTS needs_workspace_review BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pending_drafts_workspace
  ON pending_drafts(workspace_id);

-- Partial index supports the hot path: list pending_review drafts for a
-- given workspace. The drafts inbox endpoint is the only consumer.
CREATE INDEX IF NOT EXISTS idx_pending_drafts_workspace_status
  ON pending_drafts(workspace_id, status)
  WHERE status = 'pending_review';
