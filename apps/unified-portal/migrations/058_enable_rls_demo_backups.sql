-- Defence-in-depth: enable RLS on every historical demo backup table
-- that exists in the protected schema.
--
-- These snapshots were operational artifacts and are absent on a fresh
-- database. Conditional execution keeps canonical migration replay safe while
-- preserving no-policy, deny-by-default RLS for every retained snapshot.

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
    IF to_regclass(format('demo_backups.%I', backup_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE demo_backups.%I ENABLE ROW LEVEL SECURITY', backup_name);
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON SCHEMA demo_backups FROM PUBLIC;
REVOKE ALL ON SCHEMA demo_backups FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA demo_backups FROM anon, authenticated;
