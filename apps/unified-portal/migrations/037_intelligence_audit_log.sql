-- ============================================================================
-- MIGRATION 037: Intelligence Audit Log
-- Tracks all AI-initiated write actions for accountability and rollback
-- Run each block separately in Supabase SQL Editor
-- ============================================================================

-- Block 1: Create table
CREATE TABLE intelligence_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id),
  scheme_id text,
  tool_name text NOT NULL,
  natural_language_instruction text,
  parameters jsonb,
  result jsonb,
  status text CHECK (status IN ('confirmed', 'cancelled', 'failed'))
);

-- Block 2: Indexes
CREATE INDEX idx_audit_log_user ON intelligence_audit_log(user_id);
CREATE INDEX idx_audit_log_scheme ON intelligence_audit_log(scheme_id);
CREATE INDEX idx_audit_log_created ON intelligence_audit_log(created_at DESC);

-- Block 3: RLS
ALTER TABLE intelligence_audit_log ENABLE ROW LEVEL SECURITY;

-- Block 4: Select policy
CREATE POLICY "Users can view their own audit log"
  ON intelligence_audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- Block 5: Insert policy
CREATE POLICY "Service role can insert audit log"
  ON intelligence_audit_log FOR INSERT
  WITH CHECK (true);
