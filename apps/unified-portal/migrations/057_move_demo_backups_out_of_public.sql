-- Move historical _demo_backup_*_20260502 tables out of the public schema.
--
-- These tables were operational snapshots, not part of the canonical schema.
-- A fresh database therefore may not contain them. Move each table only when
-- present, and fail closed rather than overwrite an existing protected copy.

CREATE SCHEMA IF NOT EXISTS demo_backups;

DO $$
DECLARE
  backup_name text;
BEGIN
  FOREACH backup_name IN ARRAY ARRAY[
    '_demo_backup_agent_letting_properties_20260502',
    '_demo_backup_agent_profiles_20260502',
    '_demo_backup_agent_tenancies_20260502',
    '_demo_backup_agent_workspaces_20260502',
    '_demo_backup_authuser_developer_20260502',
    '_demo_backup_compliance_documents_20260502',
    '_demo_backup_developments_20260502',
    '_demo_backup_tenants_20260502',
    '_demo_backup_unit_sales_pipeline_20260502',
    '_demo_backup_units_20260502'
  ]
  LOOP
    IF to_regclass(format('public.%I', backup_name)) IS NOT NULL THEN
      IF to_regclass(format('demo_backups.%I', backup_name)) IS NOT NULL THEN
        RAISE EXCEPTION 'Migration 057 collision: protected table demo_backups.% already exists', backup_name;
      END IF;

      EXECUTE format('ALTER TABLE public.%I SET SCHEMA demo_backups', backup_name);
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON SCHEMA demo_backups FROM PUBLIC;
REVOKE ALL ON SCHEMA demo_backups FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA demo_backups FROM anon, authenticated;
