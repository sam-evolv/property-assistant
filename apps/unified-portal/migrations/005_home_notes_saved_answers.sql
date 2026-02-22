-- Migration: Add source_query and title to home_notes for saved AI answers
-- Date: 2026-02-22

ALTER TABLE home_notes ADD COLUMN IF NOT EXISTS source_query TEXT;
ALTER TABLE home_notes ADD COLUMN IF NOT EXISTS title TEXT;
