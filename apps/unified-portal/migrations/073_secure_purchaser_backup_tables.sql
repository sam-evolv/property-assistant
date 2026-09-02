-- Secure purchaser backup tables that may have been created by migrations
-- 066, 071 and 072 before their backup behavior was corrected.
--
-- These snapshots contain purchaser or property data and must not remain in
-- Supabase's API-exposed public schema without RLS. Preserve any existing
-- first snapshot by moving it into the already protected demo_backups schema.

CREATE SCHEMA IF NOT EXISTS demo_backups;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'units_purchaser_backup_2026_06_04',
    'usp_purchaser_backup_2026_06_04',
    'unit_38_longview_backup_2026_07_22',
    'units_25_50_longview_backup_2026_07_22'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      IF to_regclass(format('demo_backups.%I', table_name)) IS NOT NULL THEN
        -- A protected first snapshot already exists. Remove only the public copy
        -- recreated by replaying an older migration.
        EXECUTE format('DROP TABLE public.%I', table_name);
      ELSE
        EXECUTE format('ALTER TABLE public.%I SET SCHEMA demo_backups', table_name);
      END IF;
    END IF;

    IF to_regclass(format('demo_backups.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE demo_backups.%I ENABLE ROW LEVEL SECURITY', table_name);
    END IF;
  END LOOP;
END
$$;

REVOKE ALL ON SCHEMA demo_backups FROM PUBLIC;
REVOKE ALL ON SCHEMA demo_backups FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA demo_backups FROM anon, authenticated;