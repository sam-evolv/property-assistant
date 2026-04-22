-- Migration: fix_homeowner_portal_data_integrity — 1/5 — link projects to developments
--
-- Context: projects rows for Rathard Park, Rathard Lawn and Longview Park have
-- projects.development_id = NULL. Downstream code that tries to resolve a
-- project by development_id (e.g. chat route's PROJECT_ID RESOLUTION block)
-- falls through to a UUID-collision path where projects.id happens to equal
-- some developments.id — producing the Rathárd Park → Árdan View leak.
--
-- Populate projects.development_id for the three production projects so the
-- back-reference lookup returns the correct canonical project_id.

UPDATE projects
   SET development_id = '84a559d1-89f1-4eb6-a48b-7ca068bcc164'
 WHERE id = '6d3789de-2e46-430c-bf31-22224bd878da';
-- Rathard Park project → Rathárd Park development

UPDATE projects
   SET development_id = '39c49eeb-54a6-4b04-a16a-119012c531cb'
 WHERE id = '9598cf36-3e3f-4b7d-be6d-d1e80f708f46';
-- Rathard Lawn project → Rathárd Lawn development

UPDATE projects
   SET development_id = 'e0833063-55ac-4201-a50e-f329c090fbd6'
 WHERE id = '57dc3919-2725-4575-8046-9179075ac88e';
-- Longview Park project → Longview Park development

-- Verification — this should return zero production rows after the migration:
-- SELECT p.id, p.name, p.development_id, d.name
--   FROM projects p
--   LEFT JOIN developments d ON d.id = p.development_id
--  WHERE p.development_id IS NULL;
