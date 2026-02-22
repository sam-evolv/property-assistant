-- Migration: Home Notes
-- Purchaser-facing personal notes for their home

-- Create enum type
DO $$ BEGIN
  CREATE TYPE home_note_category_enum AS ENUM (
    'maintenance', 'warranty', 'utility', 'appliance', 'garden', 'security', 'general'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create table
CREATE TABLE IF NOT EXISTS home_notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id       uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  content       text NOT NULL,
  category      home_note_category_enum NOT NULL DEFAULT 'general',
  pinned        boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS home_notes_unit_idx     ON home_notes (unit_id);
CREATE INDEX IF NOT EXISTS home_notes_category_idx ON home_notes (category);
CREATE INDEX IF NOT EXISTS home_notes_pinned_idx   ON home_notes (pinned);
CREATE INDEX IF NOT EXISTS home_notes_created_idx  ON home_notes (created_at);

-- Row Level Security
ALTER TABLE home_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Purchasers can read their own unit's notes
-- Uses the unit_id claim from the JWT or session context
CREATE POLICY "purchaser_select_own_notes"
  ON home_notes FOR SELECT
  USING (
    unit_id::text = current_setting('request.jwt.claims', true)::json->>'unit_id'
    OR current_setting('role', true) = 'service_role'
  );

-- Policy: Purchasers can insert notes for their own unit
CREATE POLICY "purchaser_insert_own_notes"
  ON home_notes FOR INSERT
  WITH CHECK (
    unit_id::text = current_setting('request.jwt.claims', true)::json->>'unit_id'
    OR current_setting('role', true) = 'service_role'
  );

-- Policy: Purchasers can update their own unit's notes (for pinning/unpinning)
CREATE POLICY "purchaser_update_own_notes"
  ON home_notes FOR UPDATE
  USING (
    unit_id::text = current_setting('request.jwt.claims', true)::json->>'unit_id'
    OR current_setting('role', true) = 'service_role'
  );

-- Policy: Purchasers can delete their own unit's notes
CREATE POLICY "purchaser_delete_own_notes"
  ON home_notes FOR DELETE
  USING (
    unit_id::text = current_setting('request.jwt.claims', true)::json->>'unit_id'
    OR current_setting('role', true) = 'service_role'
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_home_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER home_notes_updated_at
  BEFORE UPDATE ON home_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_home_notes_updated_at();
