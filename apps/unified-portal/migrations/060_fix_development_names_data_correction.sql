-- Migration: fix scheme name corruption in developments table (audit CONTENT-01)
--
-- Run this manually in the Supabase SQL Editor, NOT auto-applied.
--
-- Context:
--   The Chrome audit flagged that the purchaser portal shows different
--   scheme names in different surfaces for the same unit (header logo,
--   AI assistant intro, profile modal, page <title>). Investigation
--   showed the codebase already reads `developments.name` everywhere
--   and the inconsistency is purely a DB data issue: across all four
--   Longview / Rathard / Ardan developments, `name` had been overwritten
--   with generic real-estate-sounding strings (Riverview Heights,
--   Hillcrest Park, Lakeside Manor, Westfield Heights) while the
--   matching `code`, `slug`, and `logo_url` still pointed at the real
--   schemes. Hardcoded resolver maps in lib/development-resolver.ts
--   confirmed the intended identities below.
--
-- Each UPDATE is gated on the current (incorrect) name so re-running
-- this file is a no-op if the row has already been corrected.
--
-- The fifth development in this tenant (code HVA, name Bayside
-- Apartments, 12 units, project_type btr) was confirmed as a real,
-- separate scheme by the project owner and is not touched here.

BEGIN;

-- Longview Park (linked to project 57dc3919-... via the resolver)
UPDATE developments
SET name = 'Longview Park',
    code = 'LONGVIEW_PARK',
    slug = 'longview-park'
WHERE id = 'e0833063-55ac-4201-a50e-f329c090fbd6'
  AND name = 'Riverview Heights';

-- Rathard Lawn
UPDATE developments
SET name = 'Rathard Lawn',
    slug = 'rathard-lawn'
WHERE id = '39c49eeb-54a6-4b04-a16a-119012c531cb'
  AND name = 'Hillcrest Park';

-- Ardan View (note: slug was longview-park, almost certainly leftover
-- from an earlier copy/paste; corrected here)
UPDATE developments
SET name = 'Ardan View',
    slug = 'ardan-view'
WHERE id = '34316432-f1e8-4297-b993-d9b5c88ee2d8'
  AND name = 'Lakeside Manor';

-- Rathard Park
UPDATE developments
SET name = 'Rathard Park',
    slug = 'rathard-park'
WHERE id = '84a559d1-89f1-4eb6-a48b-7ca068bcc164'
  AND name = 'Westfield Heights';

-- Sanity check before COMMIT. Should return four rows, each with the
-- corrected name and a matching slug.
SELECT id, code, name, slug, logo_url
FROM developments
WHERE id IN (
  'e0833063-55ac-4201-a50e-f329c090fbd6',
  '39c49eeb-54a6-4b04-a16a-119012c531cb',
  '34316432-f1e8-4297-b993-d9b5c88ee2d8',
  '84a559d1-89f1-4eb6-a48b-7ca068bcc164'
)
ORDER BY name;

COMMIT;
