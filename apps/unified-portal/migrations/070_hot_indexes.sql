-- 070_hot_indexes.sql
-- Applied to the live project via the Supabase MCP on 2026-06-09 (migration
-- name: 070_hot_indexes). Run manually in the SQL editor on any other env.
--
-- Source: pg_indexes audit + Supabase advisors (2026-06-09).
--   • issue_reports had unit/status/tenant indexes but nothing on
--     development_id — /developer/issues and the intelligence snag tools
--     filter by development.
--   • unit_sales_pipeline had release_date + handover_date indexes but not
--     sale_agreed_date, the column behind the intelligence
--     query_pipeline_activity "sale agreed last week" questions.
--   • Advisors flagged exact-duplicate indexes on messages (x3 on unit_id)
--     and unit_room_dimensions (x2 on room key) — keep one of each.
-- Advisor findings NOT addressed here (reported instead): security_definer_view
-- on agent_home_stats + listing_price_review_candidates, auth_rls_initplan on
-- 73 policies, public bucket listing on development-branding/development_docs,
-- leaked-password protection toggle (dashboard setting).

CREATE INDEX IF NOT EXISTS issue_reports_dev_status_idx
  ON issue_reports (development_id, status);

CREATE INDEX IF NOT EXISTS unit_pipeline_sale_agreed_date_idx
  ON unit_sales_pipeline (sale_agreed_date)
  WHERE sale_agreed_date IS NOT NULL;

-- Exact duplicates (advisor: duplicate_index) — keep one canonical index each
DROP INDEX IF EXISTS idx_messages_unit_id;
DROP INDEX IF EXISTS messages_unit_id_idx;     -- keeps messages_unit_idx
DROP INDEX IF EXISTS idx_urd_room_key;         -- keeps idx_unit_room_dimensions_room_key
