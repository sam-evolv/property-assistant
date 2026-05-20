-- Migration: Create guardrail_evaluations table
-- Stores every guardrail evaluation for analysis and auto-research loop

CREATE TABLE IF NOT EXISTS guardrail_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text,
  query_hash text,
  query_preview text,
  intent text,
  confidence_overall double precision,
  confidence_grounding double precision,
  confidence_specificity double precision,
  confidence_consistency double precision,
  confidence_completeness double precision,
  confidence_safety double precision,
  risk_factors jsonb DEFAULT '[]'::jsonb,
  guardrail_log jsonb DEFAULT '[]'::jsonb,
  was_modified boolean DEFAULT false,
  was_blocked boolean DEFAULT false,
  shadow_mode boolean DEFAULT true,
  turn_count integer DEFAULT 1,
  escalation_level integer DEFAULT 0,
  clarification_triggered boolean DEFAULT false,
  ambiguous_terms jsonb DEFAULT '[]'::jsonb,
  response_length integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_guardrail_eval_created ON guardrail_evaluations (created_at);
CREATE INDEX IF NOT EXISTS idx_guardrail_eval_intent ON guardrail_evaluations (intent);
CREATE INDEX IF NOT EXISTS idx_guardrail_eval_confidence ON guardrail_evaluations (confidence_overall);

-- RLS: allow service role full access (same pattern as other tables)
ALTER TABLE guardrail_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON guardrail_evaluations
  FOR ALL USING (true);
