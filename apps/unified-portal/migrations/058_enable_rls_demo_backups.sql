-- Defence-in-depth: enable RLS on every _demo_backup_*_20260502 table
-- in the `demo_backups` schema.
--
-- Migration 057 moved these tables out of `public` so PostgREST no
-- longer exposes them via the anon/authenticated roles. RLS is
-- therefore not strictly required for confidentiality today — but
-- enabling it locks the tables down even if the schema is ever added
-- to PostgREST's `db.schemas` list, or if a future migration grants
-- direct table access. No policies are added: the intent is "no
-- access by default" until an explicit policy is written.
--
-- One ALTER per table per the team's "split DDL" convention; each was
-- applied via Supabase MCP `apply_migration` so the migration history
-- in the Supabase dashboard mirrors this file. Listed alphabetically.

ALTER TABLE demo_backups._demo_backup_agent_letting_properties_20260502 ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_backups._demo_backup_agent_profiles_20260502           ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_backups._demo_backup_agent_tenancies_20260502          ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_backups._demo_backup_agent_workspaces_20260502         ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_backups._demo_backup_authuser_developer_20260502       ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_backups._demo_backup_compliance_documents_20260502     ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_backups._demo_backup_developments_20260502             ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_backups._demo_backup_tenants_20260502                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_backups._demo_backup_unit_sales_pipeline_20260502      ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_backups._demo_backup_units_20260502                    ENABLE ROW LEVEL SECURITY;
