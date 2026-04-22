-- Migration: fix_homeowner_portal_data_integrity — 5/5 — populate Rathárd Park developments.logo_url
--
-- The homeowner portal header renders developments.logo_url when present and
-- falls back to the development name text otherwise. For Rathárd Park the
-- column is currently NULL, so the plain-text header "Rathárd Park" is shown.
--
-- Sam will upload the Rathárd Park logo to Supabase Storage and replace
-- <STORAGE_PUBLIC_URL_TODO> below with the public URL before running.

-- UPDATE developments
--    SET logo_url = '<STORAGE_PUBLIC_URL_TODO>'
--  WHERE id = '84a559d1-89f1-4eb6-a48b-7ca068bcc164';

-- Verify after running:
-- SELECT id, name, logo_url FROM developments WHERE id = '84a559d1-89f1-4eb6-a48b-7ca068bcc164';
