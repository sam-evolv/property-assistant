-- ============================================================================
-- MIGRATION 033: Add missing columns to unit_sales_pipeline
-- Run this in the Supabase SQL Editor
--
-- Context: The Drizzle schema defines these columns but they were never
-- included in the original migration (026_sales_pipeline.sql). The API
-- queries them which causes PostgREST to return errors, preventing the
-- Sales Pipeline detail view from loading.
-- ============================================================================

ALTER TABLE unit_sales_pipeline
  ADD COLUMN IF NOT EXISTS queries_raised_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS queries_replied_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sale_type TEXT,
  ADD COLUMN IF NOT EXISTS housing_agency TEXT,
  ADD COLUMN IF NOT EXISTS sale_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS kitchen_selected BOOLEAN,
  ADD COLUMN IF NOT EXISTS kitchen_counter TEXT,
  ADD COLUMN IF NOT EXISTS kitchen_cabinet TEXT,
  ADD COLUMN IF NOT EXISTS kitchen_handle TEXT,
  ADD COLUMN IF NOT EXISTS kitchen_wardrobes BOOLEAN,
  ADD COLUMN IF NOT EXISTS kitchen_notes TEXT;

-- Also add audit trail columns for queries (matching the pattern of other stages)
ALTER TABLE unit_sales_pipeline
  ADD COLUMN IF NOT EXISTS queries_raised_updated_by UUID REFERENCES admins(id),
  ADD COLUMN IF NOT EXISTS queries_raised_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS queries_replied_updated_by UUID REFERENCES admins(id),
  ADD COLUMN IF NOT EXISTS queries_replied_updated_at TIMESTAMPTZ;

-- Verify the columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'unit_sales_pipeline'
  AND column_name IN (
    'queries_raised_date', 'queries_replied_date',
    'sale_type', 'housing_agency', 'sale_price',
    'kitchen_selected', 'kitchen_counter', 'kitchen_cabinet',
    'kitchen_handle', 'kitchen_wardrobes', 'kitchen_notes'
  )
ORDER BY column_name;
