-- Migration 051: development_aliases
-- Session 13 — phonetic alias table for scheme-name resolution.
--
-- When Orla types "Can you reach out to number one add-on view...", the
-- existing substring matcher in matchAssignedScheme() fails because "add
-- on view" has no substring overlap with "Árdan View". Irish placenames
-- with fadas are the worst offenders: the canonical name carries an
-- accented character most users won't type, and Whisper transcribes the
-- sound rather than the spelling.
--
-- The alias table stores every written / spoken form that maps to a given
-- development. `alias_normalised` is the lookup key — it strips fadas,
-- punctuation, and collapses whitespace so "Árdan View", "ardan-view",
-- "Ardan  View" and "ARDAN VIEW" all resolve to the same row.
--
-- `source` distinguishes:
--   canonical      = the row the development was seeded with (always present)
--   phonetic_seed  = manually curated misspelling seed shipped with this migration
--   manual         = admin-entered alias (UI not built yet; reserved)
--   inferred       = self-captured from a user's prior "did you mean…?" flow

CREATE TABLE IF NOT EXISTS development_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id UUID NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_normalised TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('canonical', 'phonetic_seed', 'manual', 'inferred')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(development_id, alias_normalised)
);

CREATE INDEX IF NOT EXISTS idx_development_aliases_normalised
  ON development_aliases(alias_normalised);

-- Row-level security: service-role bypass (same pattern as other agent
-- tables). Clients never read/write this directly; it's accessed via the
-- chat route which uses the service-role client.
ALTER TABLE development_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY development_aliases_service_role ON development_aliases
  FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------
-- Backfill canonical aliases for every existing development.
-- --------------------------------------------------------------------
INSERT INTO development_aliases (development_id, alias, alias_normalised, source)
SELECT
  d.id,
  d.name,
  -- Normalise: lowercase, strip fadas, keep only alnum + spaces, collapse ws.
  trim(regexp_replace(
    regexp_replace(
      translate(
        lower(d.name),
        'áéíóúàèìòùäëïöüâêîôûãõçñÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÃÕÇÑ',
        'aeiouaeiouaeiouaeiouaocnaeiouaeiouaeiouaeiouaocn'
      ),
      '[^a-z0-9\s]', ' ', 'g'
    ),
    '\s+', ' ', 'g'
  )),
  'canonical'
FROM developments d
ON CONFLICT (development_id, alias_normalised) DO NOTHING;

-- --------------------------------------------------------------------
-- Phonetic seeds for Orla's 5 schemes. Development IDs are resolved by
-- name rather than hardcoded UUIDs so the migration is replayable across
-- environments (staging / prod may have different IDs for the same
-- scheme in seed data).
-- --------------------------------------------------------------------

-- Helper: inline SELECT each time so we don't rely on pl/pgsql.

-- Árdan View
INSERT INTO development_aliases (development_id, alias, alias_normalised, source)
SELECT d.id, v.alias, v.alias_normalised, 'phonetic_seed'
FROM developments d, (VALUES
  ('Ardan View',    'ardan view'),
  ('Ardawn View',   'ardawn view'),
  ('Arden View',    'arden view'),
  ('Adan View',     'adan view'),
  ('Adden View',    'adden view'),
  ('Add-on View',   'add on view'),
  ('Add on View',   'add on view'),
  ('Addon View',    'addon view'),
  ('Ardhan View',   'ardhan view'),
  ('Ardan',         'ardan'),
  ('Ardawn',        'ardawn')
) AS v(alias, alias_normalised)
WHERE d.name ILIKE 'Árdan View' OR d.name ILIKE 'Ardan View'
ON CONFLICT (development_id, alias_normalised) DO NOTHING;

-- Rathárd Park
INSERT INTO development_aliases (development_id, alias, alias_normalised, source)
SELECT d.id, v.alias, v.alias_normalised, 'phonetic_seed'
FROM developments d, (VALUES
  ('Rathard Park',    'rathard park'),
  ('Rathaud Park',    'rathaud park'),
  ('Rahard Park',     'rahard park'),
  ('Rathard-Park',    'rathard park'),
  ('Rath-tard Park',  'rath tard park'),
  ('R-tard Park',     'r tard park'),
  ('Rathard',         'rathard'),
  ('Rathaud',         'rathaud')
) AS v(alias, alias_normalised)
WHERE d.name ILIKE 'Rathárd Park' OR d.name ILIKE 'Rathard Park'
ON CONFLICT (development_id, alias_normalised) DO NOTHING;

-- Rathárd Lawn
INSERT INTO development_aliases (development_id, alias, alias_normalised, source)
SELECT d.id, v.alias, v.alias_normalised, 'phonetic_seed'
FROM developments d, (VALUES
  ('Rathard Lawn',    'rathard lawn'),
  ('Rathaud Lawn',    'rathaud lawn'),
  ('Rahard Lawn',     'rahard lawn'),
  ('Rath-tard Lawn',  'rath tard lawn'),
  ('R-tard Lawn',     'r tard lawn')
) AS v(alias, alias_normalised)
WHERE d.name ILIKE 'Rathárd Lawn' OR d.name ILIKE 'Rathard Lawn'
ON CONFLICT (development_id, alias_normalised) DO NOTHING;

-- Harbour View Apartments (no fada, but common variants)
INSERT INTO development_aliases (development_id, alias, alias_normalised, source)
SELECT d.id, v.alias, v.alias_normalised, 'phonetic_seed'
FROM developments d, (VALUES
  ('Harbor View Apartments', 'harbor view apartments'),
  ('Harbour View Apts',      'harbour view apts'),
  ('Harbor View Apts',       'harbor view apts'),
  ('Harbour View',           'harbour view'),
  ('Harbor View',            'harbor view')
) AS v(alias, alias_normalised)
WHERE d.name ILIKE 'Harbour View Apartments'
ON CONFLICT (development_id, alias_normalised) DO NOTHING;

-- Longview Park (compound word — users may split it)
INSERT INTO development_aliases (development_id, alias, alias_normalised, source)
SELECT d.id, v.alias, v.alias_normalised, 'phonetic_seed'
FROM developments d, (VALUES
  ('Long View Park',  'long view park'),
  ('Long-View Park',  'long view park'),
  ('Longview',        'longview'),
  ('Long View',       'long view')
) AS v(alias, alias_normalised)
WHERE d.name ILIKE 'Longview Park'
ON CONFLICT (development_id, alias_normalised) DO NOTHING;
