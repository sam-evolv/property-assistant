-- Migration: Add tier column to units table for OpenHouse Select
-- Valid values: 'standard' (default), 'select' (premium tier)
-- Run manually in Supabase SQL Editor

ALTER TABLE units ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'standard';

-- Add a check constraint for valid tier values
ALTER TABLE units ADD CONSTRAINT units_tier_check CHECK (tier IN ('standard', 'select'));

-- Index for filtering by tier
CREATE INDEX IF NOT EXISTS units_tier_idx ON units USING btree (tier);

COMMENT ON COLUMN units.tier IS 'Unit product tier: standard = existing portal, select = premium OpenHouse Select experience';
