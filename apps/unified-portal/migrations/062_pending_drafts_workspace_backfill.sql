-- ============================================================================
-- APPLIED TO PRODUCTION via Supabase MCP on 2026-05-19.
-- DO NOT RE-RUN. Recorded here for audit / future env bootstrap only.
-- Backfill results on Bridge Property Group:
--   total rows before: 4
--   workspace_assigned after: 4
--   flagged_for_review: 0
--   sales / lettings split: 2 / 2
-- ============================================================================
--
-- Migration: 062_pending_drafts_workspace_backfill.sql
--
-- Backfills workspace_id on every existing pending_drafts row. Conservative
-- rules — never guess. Origin signals, in order of priority:
--
--   1. Definitive draft_type. lease_renewal, application_invitation,
--      landlord_statement are lettings-only. The sales-only list mirrors
--      SALES_DRAFT_TYPES in lib/agent-intelligence/drafts.ts.
--   2. content_json.affected_record.kind. When draft_type is in the
--      SHARED bucket (today: buyer_followup), the persisted
--      affected_record.kind disambiguates: sales_unit/listing → sales,
--      tenancy/letting_property → lettings.
--   3. No match → needs_workspace_review = true, workspace_id stays
--      NULL. These rows are dropped from both inboxes by the
--      workspace_id JOIN in the new read path.
--
-- After the UPDATE, a CHECK constraint locks in the invariant: every row
-- either has a workspace_id, or carries needs_workspace_review = true.
-- New writes always set workspace_id (see lib/agent-intelligence/draft-
-- store.ts and the API routes), so the flag column is only ever set by
-- this backfill.

WITH inferred AS (
  SELECT
    pd.id AS draft_id,
    pd.tenant_id,
    pd.user_id,
    pd.draft_type,
    pd.content_json,
    CASE
      WHEN pd.draft_type IN ('lease_renewal', 'application_invitation', 'landlord_statement')
        THEN 'lettings'
      WHEN pd.draft_type IN (
        'solicitor_chase', 'viewing_followup', 'viewing_proposal',
        'viewing_record', 'weekly_briefing', 'intelligence_report',
        'intelligence_answer', 'intelligence_draft', 'schedule_viewing',
        'vendor_update', 'offer_response', 'price_reduction_notice',
        'chain_update_to_buyer'
      )
        THEN 'sales'
      WHEN pd.content_json->'affected_record'->>'kind' IN ('sales_unit', 'listing', 'unit')
        THEN 'sales'
      WHEN pd.content_json->'affected_record'->>'kind' IN ('tenancy', 'letting_property', 'lettings_property')
        THEN 'lettings'
      ELSE NULL
    END AS inferred_mode
  FROM pending_drafts pd
  WHERE pd.workspace_id IS NULL
),
resolved AS (
  SELECT
    i.draft_id,
    i.inferred_mode,
    aw.id AS workspace_id
  FROM inferred i
  LEFT JOIN agent_profiles ap ON ap.user_id = i.user_id
  LEFT JOIN agent_workspaces aw
    ON aw.agent_id = ap.id
    AND aw.tenant_id = i.tenant_id
    AND aw.mode = i.inferred_mode
)
UPDATE pending_drafts pd
SET
  workspace_id = r.workspace_id,
  needs_workspace_review = (r.workspace_id IS NULL),
  updated_at = now()
FROM resolved r
WHERE pd.id = r.draft_id;

-- Invariant: every row has a clear workspace decision attached. New
-- inserts MUST set workspace_id; the backfill is the only path that
-- ever sets needs_workspace_review.
ALTER TABLE pending_drafts
  DROP CONSTRAINT IF EXISTS pending_drafts_workspace_decision_check;

ALTER TABLE pending_drafts
  ADD CONSTRAINT pending_drafts_workspace_decision_check
  CHECK (workspace_id IS NOT NULL OR needs_workspace_review = true);
