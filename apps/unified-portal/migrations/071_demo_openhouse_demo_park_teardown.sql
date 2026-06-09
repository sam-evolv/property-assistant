-- 071_demo_openhouse_demo_park_teardown.sql
-- Removes EVERYTHING seeded by 071_demo_openhouse_demo_park.sql, keyed off the
-- demo development code OHDEMO. Run in the Supabase SQL editor (or via MCP)
-- to reset, then re-apply the seed for fresh now()-relative dates.
-- NOT applied automatically — committed for the reset workflow only.

WITH demo_dev AS (
  SELECT id FROM developments WHERE code = 'OHDEMO'
),
demo_units AS (
  SELECT u.id FROM units u JOIN demo_dev d ON u.development_id = d.id
)
, del_issues AS (
  DELETE FROM issue_reports WHERE unit_id IN (SELECT id FROM demo_units) RETURNING 1
)
, del_guides AS (
  DELETE FROM home_user_guides WHERE unit_id IN (SELECT id FROM demo_units) RETURNING 1
)
, del_events AS (
  DELETE FROM handover_events WHERE unit_id IN (SELECT id FROM demo_units) RETURNING 1
)
, del_systems AS (
  DELETE FROM unit_systems WHERE unit_id IN (SELECT id FROM demo_units) RETURNING 1
)
, del_pipeline AS (
  DELETE FROM unit_sales_pipeline WHERE unit_id IN (SELECT id FROM demo_units) RETURNING 1
)
, del_units AS (
  DELETE FROM units WHERE id IN (SELECT id FROM demo_units) RETURNING 1
)
, del_project AS (
  DELETE FROM projects WHERE id IN (SELECT id FROM demo_dev) RETURNING 1
)
DELETE FROM developments WHERE id IN (SELECT id FROM demo_dev);
