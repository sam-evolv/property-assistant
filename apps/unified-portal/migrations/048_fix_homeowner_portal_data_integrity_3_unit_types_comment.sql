-- Migration: fix_homeowner_portal_data_integrity — 3/5 — document unit_types.specification_json as a type-level default only
--
-- The homeowner portal NEVER reads unit_types.specification_json for
-- user-facing specs (bedrooms / bathrooms / area). The source of truth is the
-- units row. This comment makes the rule explicit at the schema level.
--
-- Flag bad Rathárd Park rows for Sam's manual review — do NOT auto-correct.
-- Rathárd Park's BT03 specification_json currently holds 4/3 bed/bath and a
-- floor_area_sqm value of 1517.71 which is actually sqft. Rathárd Lawn stores
-- correct sqm values (75–168) which proves the sqft-under-sqm-key issue is
-- localised to Rathárd Park.

COMMENT ON COLUMN unit_types.specification_json IS
  'Type-level defaults only. NOT the source of truth for any homeowner-portal display. '
  'User-visible specs (bedrooms, bathrooms, floor_area_m2) must come from the units row. '
  'Rathárd Park seed data stored floor_area in sqft under the sqm key — known bad until '
  'Sam supplies corrected values per the audit report.';

-- TODO REPORT — Rathárd Park unit_types where floor_area_sqm looks like sqft
-- (anything over 300 is physically implausible for an Irish residential home
-- as a square-metre figure; 300 m² ≈ 3230 sqft, a large 5-bed+).
--
-- Run manually and review output with Sam:
--
-- SELECT ut.id,
--        ut.name AS house_type_code,
--        ut.specification_json->>'bedrooms'       AS bedrooms,
--        ut.specification_json->>'bathrooms'      AS bathrooms,
--        ut.specification_json->>'floor_area_sqm' AS floor_area_sqm
--   FROM unit_types ut
--   JOIN projects p ON p.id = ut.project_id
--  WHERE p.name ILIKE 'rathard park'
--    AND (ut.specification_json->>'floor_area_sqm')::numeric > 300;
