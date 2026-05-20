-- Migration: Add intent_misread_detected column to guardrail_evaluations
ALTER TABLE guardrail_evaluations
  ADD COLUMN IF NOT EXISTS intent_misread_detected boolean DEFAULT false;
