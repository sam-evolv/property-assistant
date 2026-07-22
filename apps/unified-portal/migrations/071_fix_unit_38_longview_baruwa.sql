-- ============================================================================
-- Migration 071: Fix 38 Longview Park (Baruwa) — swapped titles + wrong specs
-- ============================================================================
-- The homeowner at 38 Longview Park (Mr Sherif Baruwa) reported two issues on
-- the OpenHouse portal:
--   1. The titles on the welcome name are swapped — the portal shows
--      "Mr Halimah Baruwa and Ms Sherif Baruwa". Halimah is his wife (Ms) and
--      Sherif is him (Mr), so it should read
--      "Ms Halimah Baruwa and Mr Sherif Baruwa".
--   2. His home is a 3-bed, 2-bathroom, but the portal shows 4 bed / 3 bath.
--
-- Root cause of (2): unit 38's `units` row has NULL bedrooms, bathrooms and
-- floor_area_m2. The purchaser profile API therefore falls back to the
-- type-level `unit_types.specification_json` for house type BS02, which holds
-- the 4-bed variant (bedrooms 4, bathrooms 3, floor_area_sqm 1562.92 ≈ 145 m²).
-- BS02 is not a single spec — the seed data has both a 3-bed (1188.33 sqft ≈
-- 110 m²) and a 4-bed (1562.92 sqft ≈ 145 m²) BS02. Unit 38 is the 3-bed
-- variant, so the type default is wrong for this home.
--
-- Fix: populate unit 38's own `units` row with the correct per-home specs so
-- the API stops falling back to the ambiguous type default (units row is the
-- documented source of truth — see migrations 048 & 049). Also correct the
-- swapped titles on both `units` and `unit_sales_pipeline`.
--
--   bedrooms      = 3     (homeowner confirmed; matches the 3-bed BS02 seed)
--   bathrooms     = 2     (homeowner confirmed; seed's "3 Bathroom" was wrong)
--   floor_area_m2 = 110.4 (1188.33 sqft ÷ 10.7639, the 3-bed BS02 area)
--
-- Longview Park development_id: e0833063-55ac-4201-a50e-f329c090fbd6
-- Unit 38 id:                   9712eea6-e7fe-4ddc-88a6-a8c4a640ab1c
--
-- Idempotent / safe to re-run. Apply in the Supabase SQL Editor.
-- ============================================================================

BEGIN;

-- 1) Backup the row we are about to change (drop+recreate so re-runs are safe)
DROP TABLE IF EXISTS unit_38_longview_backup_2026_07_22;
CREATE TABLE unit_38_longview_backup_2026_07_22 AS
SELECT id, development_id, unit_number, purchaser_name,
       bedrooms, bathrooms, floor_area_m2
FROM units
WHERE development_id = 'e0833063-55ac-4201-a50e-f329c090fbd6'
  AND unit_number = '38';

-- 2) Correct the swapped titles + set the real per-home specs on the units row.
UPDATE units
SET purchaser_name = 'Ms Halimah Baruwa and Mr Sherif Baruwa',
    bedrooms       = 3,
    bathrooms      = 2,
    floor_area_m2  = 110.4
WHERE development_id = 'e0833063-55ac-4201-a50e-f329c090fbd6'
  AND unit_number = '38';

-- 3) Keep the sales pipeline name in lockstep with the units row.
UPDATE unit_sales_pipeline usp
SET purchaser_name = u.purchaser_name
FROM units u
WHERE usp.unit_id = u.id
  AND u.development_id = 'e0833063-55ac-4201-a50e-f329c090fbd6'
  AND u.unit_number = '38';

COMMIT;

-- ============================================================================
-- Verification (run after COMMIT) — expect: 3 / 2 / 110.4 and corrected titles
-- ============================================================================
--   SELECT unit_number, purchaser_name, bedrooms, bathrooms, floor_area_m2
--   FROM units
--   WHERE development_id = 'e0833063-55ac-4201-a50e-f329c090fbd6'
--     AND unit_number = '38';
--
-- Note (not fixed here — needs client-confirmed values): other 3-bed BS02
-- units (e.g. 25 and 50) also have NULL specs and will likewise render the
-- 4-bed BS02 type default. Their correct bath counts are unknown (the seed's
-- "3 Bathroom" proved wrong for unit 38), so they are intentionally left for a
-- follow-up once Sam confirms the numbers per home.
