-- Migration: Voice Capture + Action Confirmation
-- Creates pending_drafts (for drafted vendor updates awaiting review)
-- and recent_actions (for 60-second undo of approved actions)
-- Run as three separate query blocks in Supabase SQL Editor:
--   (1) CREATE TABLE
--   (2) ENABLE RLS
--   (3) CREATE POLICY
-- Never batch together.

-- ============================================
-- 1. pending_drafts
--    Drafts produced by voice-captured actions that are awaiting user review.
--    Not auto-sent. A future session ships the review screen.
-- ============================================
CREATE TABLE IF NOT EXISTS pending_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  skin TEXT NOT NULL DEFAULT 'agent',
  draft_type TEXT NOT NULL,
  recipient_id TEXT,
  content_json JSONB NOT NULL,
  send_method TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'sent', 'discarded')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_drafts_user_id ON pending_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_drafts_status ON pending_drafts(status);
CREATE INDEX IF NOT EXISTS idx_pending_drafts_tenant ON pending_drafts(tenant_id);

-- ============================================
-- 2. recent_actions
--    Journal of every approved voice action with a reversal payload
--    so the 60-second undo pill can roll back a batch.
-- ============================================
CREATE TABLE IF NOT EXISTS recent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  approval_batch_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id UUID,
  reversal_payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'undone')),
  created_at TIMESTAMPTZ DEFAULT now(),
  undone_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_recent_actions_user_id ON recent_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_recent_actions_batch ON recent_actions(approval_batch_id);
CREATE INDEX IF NOT EXISTS idx_recent_actions_status ON recent_actions(status);

-- ============================================
-- 3. Enable RLS
-- ============================================
ALTER TABLE pending_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE recent_actions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. Policies
-- ============================================
CREATE POLICY pending_drafts_service_role ON pending_drafts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY pending_drafts_self_access ON pending_drafts
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY recent_actions_service_role ON recent_actions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY recent_actions_self_access ON recent_actions
  FOR ALL USING (user_id = auth.uid());
