-- ============================================================================
-- Migration 072: Fix 25 & 50 Longview Park — 3-bed BS02 specs (same bug as #071)
-- ============================================================================
-- Follow-up to migration 071. Units 25 and 50 at Longview Park are the 3-bed
-- BS02 variant but their `units` rows have NULL bedrooms/bathrooms/floor_area,
-- so the purchaser profile API falls back to the type-level BS02
-- specification_json (the 4-bed variant: 4 bed / 3 bath / 1562.92 sqft ≈ 145 m²)
-- and renders the wrong home. Sam confirmed both are 3-bed / 2-bathroom.
--
-- Fix: populate the correct per-home specs on each units row (the documented
-- source of truth — see migrations 048, 049 & 071). Purchaser names are already
-- correct for these two units and are intentionally left untouched.
--
--   bedrooms      = 3
--   bathrooms     = 2
--   floor_area_m2 = 110.4  (1188.33 sqft ÷ 10.7639, the 3-bed BS02 area)
--
-- Longview Park development_id: e0833063-55ac-4201-a50e-f329c090fbd6
--
-- Idempotent / safe to re-run. Apply in the Supabase SQL Editor.
-- ============================================================================

BEGIN;

-- Set the real per-home specs. Names are already correct — do not touch them.
UPDATE units
SET bedrooms      = 3,
    bathrooms     = 2,
    floor_area_m2 = 110.4
WHERE development_id = 'e0833063-55ac-4201-a50e-f329c090fbd6'
  AND unit_number IN ('25','50');

DO $$
DECLARE
  corrected_count integer;
BEGIN
  SELECT COUNT(*) INTO corrected_count
  FROM units
  WHERE development_id = 'e0833063-55ac-4201-a50e-f329c090fbd6'
    AND unit_number IN ('25','50')
    AND bedrooms = 3
    AND bathrooms = 2
    AND floor_area_m2 = 110.4;

  IF corrected_count <> 2 THEN
    RAISE EXCEPTION 'Migration 072 verification failed: expected 2 corrected units, found %', corrected_count;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- Verification (run after COMMIT) — expect two rows, each 3 / 2 / 110.4
-- ============================================================================
--   SELECT unit_number, bedrooms, bathrooms, floor_area_m2
--   FROM units
--   WHERE development_id = 'e0833063-55ac-4201-a50e-f329c090fbd6'
--     AND unit_number IN ('25','50')
--   ORDER BY unit_number;
