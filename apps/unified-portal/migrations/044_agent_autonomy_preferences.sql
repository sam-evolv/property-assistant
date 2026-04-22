-- Migration: Autonomy preferences + send_mode telemetry (Session 3)
--
-- Creates agent_autonomy_preferences (per-user, per-draft-type auto-send
-- switches + a `_global_pause` pseudo-row that acts as the kill switch),
-- extends agent_send_history with send_mode, and adds a timezone column
-- to agent_profiles so active-hours gating can use the user's local clock.
--
-- Run as three separate query blocks in Supabase SQL Editor:
--   (1) CREATE / ALTER
--   (2) ENABLE RLS
--   (3) CREATE POLICY
-- Never batch together.

-- ============================================
-- 1. Schema changes
-- ============================================

-- Per-user, per-draft-type autonomy switch.
-- The pseudo draft_type '_global_pause' flags the kill switch.
CREATE TABLE IF NOT EXISTS agent_autonomy_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  draft_type TEXT NOT NULL,
  auto_send_enabled BOOLEAN NOT NULL DEFAULT false,
  enabled_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  offered_at TIMESTAMPTZ,
  offer_dismissed_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, draft_type)
);

CREATE INDEX IF NOT EXISTS idx_autonomy_preferences_user_id
  ON agent_autonomy_preferences(user_id);

-- send_mode distinguishes reviewed sends from auto-sends + cancelled autos.
-- Default keeps historical rows truthful (they were all reviewed pre-session 3).
ALTER TABLE agent_send_history
  ADD COLUMN IF NOT EXISTS send_mode TEXT NOT NULL DEFAULT 'reviewed';

-- Timezone defaults to Europe/Dublin, the product's target market. Users who
-- travel or live elsewhere can update via profile; the active-hours gate
-- reads this column via the send pipeline.
ALTER TABLE agent_profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Dublin';

-- ============================================
-- 2. Enable RLS
-- ============================================
ALTER TABLE agent_autonomy_preferences ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. Policies — drop-if-exists for idempotency
-- ============================================
DROP POLICY IF EXISTS agent_autonomy_preferences_service_role ON agent_autonomy_preferences;
DROP POLICY IF EXISTS agent_autonomy_preferences_self_access ON agent_autonomy_preferences;

CREATE POLICY agent_autonomy_preferences_service_role ON agent_autonomy_preferences
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY agent_autonomy_preferences_self_access ON agent_autonomy_preferences
  FOR ALL USING (user_id = auth.uid());
