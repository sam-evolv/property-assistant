ALTER TABLE units ADD COLUMN IF NOT EXISTS tier TEXT
  NOT NULL DEFAULT 'standard';
ALTER TABLE units ADD CONSTRAINT units_tier_check
  CHECK (tier IN ('standard', 'select'));
