-- Move 10 _demo_backup_*_20260502 tables out of the public schema.
--
-- These tables were created on 2026-05-02 as a safety snapshot during demo
-- data work. They have RLS disabled, which means anyone holding the public
-- anon key (which ships in the client bundle) can read every row of the
-- snapshotted tenant, agent, sales pipeline, units, compliance documents
-- and tenancy data. The Supabase advisor flagged this as critical.
--
-- Fix: relocate them to a non-public `demo_backups` schema. The Supabase
-- anon and authenticated roles only get table access in `public` by
-- default, so moving the schema is sufficient to revoke their reach
-- without losing the snapshots themselves.
--
-- No application code references these tables (verified by grep). Safe to
-- move without code changes.

CREATE SCHEMA IF NOT EXISTS demo_backups;

ALTER TABLE public._demo_backup_agent_letting_properties_20260502 SET SCHEMA demo_backups;
ALTER TABLE public._demo_backup_agent_profiles_20260502           SET SCHEMA demo_backups;
ALTER TABLE public._demo_backup_agent_tenancies_20260502          SET SCHEMA demo_backups;
ALTER TABLE public._demo_backup_agent_workspaces_20260502         SET SCHEMA demo_backups;
ALTER TABLE public._demo_backup_authuser_developer_20260502       SET SCHEMA demo_backups;
ALTER TABLE public._demo_backup_compliance_documents_20260502     SET SCHEMA demo_backups;
ALTER TABLE public._demo_backup_developments_20260502             SET SCHEMA demo_backups;
ALTER TABLE public._demo_backup_tenants_20260502                  SET SCHEMA demo_backups;
ALTER TABLE public._demo_backup_unit_sales_pipeline_20260502      SET SCHEMA demo_backups;
ALTER TABLE public._demo_backup_units_20260502                    SET SCHEMA demo_backups;

REVOKE ALL ON SCHEMA demo_backups FROM PUBLIC;
REVOKE ALL ON SCHEMA demo_backups FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA demo_backups FROM anon, authenticated;
