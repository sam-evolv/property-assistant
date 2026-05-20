-- Migration: Add v2 guardrail detection columns to guardrail_evaluations
-- Run this in Supabase SQL Editor

ALTER TABLE guardrail_evaluations
  ADD COLUMN IF NOT EXISTS is_correct_refusal boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_faithful_repetition boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_false_premise boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS false_premise_details text DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_off_topic boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS portal_feature_available boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS portal_feature_mentioned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS unattested_numeric_claims jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pii_detected boolean DEFAULT false;
