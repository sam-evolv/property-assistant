-- Migration: Draft Send Flow (Session 2)
-- Adds sent_at to pending_drafts, expands its status enum, and creates
-- agent_send_history — a track-record table Session 3 will use to gate
-- auto-send behaviour.
--
-- Run as three separate query blocks in Supabase SQL Editor:
--   (1) CREATE / ALTER
--   (2) ENABLE RLS
--   (3) CREATE POLICY
-- Never batch together.

-- ============================================
-- 1. Schema changes
-- ============================================

-- New timestamp for when the draft was actually sent.
ALTER TABLE pending_drafts
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

-- Widen the allowed statuses. 'sent_external' covers WhatsApp/SMS which this
-- session hands off to the native URI handlers rather than sending directly.
-- 'undone' is a distinct terminal state so the track-record is truthful.
ALTER TABLE pending_drafts
  DROP CONSTRAINT IF EXISTS pending_drafts_status_check;

ALTER TABLE pending_drafts
  ADD CONSTRAINT pending_drafts_status_check
  CHECK (status IN ('pending_review', 'sent', 'sent_external', 'discarded', 'undone'));

-- Track record of every successful send for the authenticated agent.
-- Used later to decide when auto-send is safe. Undo flips the undone flag.
CREATE TABLE IF NOT EXISTS agent_send_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  draft_id UUID REFERENCES pending_drafts(id),
  draft_type TEXT NOT NULL,
  recipient_id TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  was_edited_before_send BOOLEAN NOT NULL,
  undone BOOLEAN DEFAULT false,
  send_method TEXT,
  provider TEXT,
  provider_message_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_send_history_user_id ON agent_send_history(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_send_history_draft_type ON agent_send_history(draft_type);
CREATE INDEX IF NOT EXISTS idx_agent_send_history_sent_at ON agent_send_history(sent_at DESC);

-- ============================================
-- 2. Enable RLS
-- ============================================
ALTER TABLE agent_send_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. Policies — drop-if-exists for idempotency
-- ============================================
DROP POLICY IF EXISTS agent_send_history_service_role ON agent_send_history;
DROP POLICY IF EXISTS agent_send_history_self_access ON agent_send_history;

CREATE POLICY agent_send_history_service_role ON agent_send_history
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY agent_send_history_self_access ON agent_send_history
  FOR ALL USING (user_id = auth.uid());
