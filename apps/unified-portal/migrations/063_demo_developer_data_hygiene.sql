-- ============================================================================
-- MIGRATION 063: Demo developer tenant data hygiene cleanup
--
-- Target tenant: 4cee69c6-be4b-486e-9c33-2b5a7d30e287
-- (Bridge Property Group / Longview Estates demo data used in developer demos)
--
-- Cleans:
--   1. Internal scheme code suffixes leaking into the development switcher
--      (e.g. RATHARD_PARK_8U9H, ARDAN_VIEW on the wrong scheme)
--   2. Real looking purchaser names (and a few real Gmail addresses) seeded
--      across units, sales pipeline, purchaser agreements
--   3. Placeholder firstname.lastname+u<N>@example.com emails
--   4. Identical "20 queries" pipeline counts that come from a frontend
--      fallback when unresolved unit_pipeline_notes count is zero on a scheme
--
-- Run each block via execute_sql separately, verifying with the SELECT that
-- follows each block before moving on.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- BLOCK 1: Strip internal code suffixes from developments
-- ----------------------------------------------------------------------------
UPDATE public.developments SET code = 'ARDAN_VIEW'      WHERE id = '34316432-f1e8-4297-b993-d9b5c88ee2d8';
UPDATE public.developments SET code = 'BAYSIDE_APTS'    WHERE id = 'b45347d3-934d-4ec1-9d25-c0a687b82263';
UPDATE public.developments SET code = 'LONGVIEW_PARK'   WHERE id = 'e0833063-55ac-4201-a50e-f329c090fbd6';
UPDATE public.developments SET code = 'OH_SELECT_DEMO' WHERE id = 'de1a0000-0000-0000-0000-000000000001';
UPDATE public.developments SET code = 'RATHARD_LAWN'    WHERE id = '39c49eeb-54a6-4b04-a16a-119012c531cb';
UPDATE public.developments SET code = 'RATHARD_PARK'    WHERE id = '84a559d1-89f1-4eb6-a48b-7ca068bcc164';

-- Verify: every code should be a clean prefix of the development name.
-- SELECT id, name, code FROM developments
-- WHERE tenant_id = '4cee69c6-be4b-486e-9c33-2b5a7d30e287' ORDER BY name;


-- ----------------------------------------------------------------------------
-- BLOCK 2: Replace purchaser_name and purchaser_email on units with
--          consistent generic Irish demo identities. Pool of 50 identities,
--          cycled deterministically so the mapping is stable across reruns
--          for the same units.
-- ----------------------------------------------------------------------------
WITH pool(idx, full_name, email) AS (
  VALUES
    ( 1, 'Aoife O''Brien',     'aoife.obrien@email.ie'),
    ( 2, 'Cian Murphy',        'cian.murphy@email.ie'),
    ( 3, 'Niamh Kelly',        'niamh.kelly@email.ie'),
    ( 4, 'Tadhg Ryan',         'tadhg.ryan@email.ie'),
    ( 5, 'Daniel Walsh',       'daniel.walsh@email.ie'),
    ( 6, 'Meabh Doyle',        'meabh.doyle@email.ie'),
    ( 7, 'Sinead Walsh',       'sinead.walsh@email.ie'),
    ( 8, 'Eoin Brady',         'eoin.brady@email.ie'),
    ( 9, 'James O''Connor',    'james.oconnor@email.ie'),
    (10, 'Siofra O''Reilly',   'siofra.oreilly@email.ie'),
    (11, 'David Hayes',        'david.hayes@email.ie'),
    (12, 'Anna Quinn',         'anna.quinn@email.ie'),
    (13, 'Brian Murphy',       'brian.murphy@email.ie'),
    (14, 'Lucy Reid',          'lucy.reid@email.ie'),
    (15, 'Kate Lynch',         'kate.lynch@email.ie'),
    (16, 'Liam Doyle',         'liam.doyle@email.ie'),
    (17, 'Sean Fitzgerald',    'sean.fitzgerald@email.ie'),
    (18, 'Oisin Byrne',        'oisin.byrne@email.ie'),
    (19, 'Cara Nolan',         'cara.nolan@email.ie'),
    (20, 'Padraig Lynch',      'padraig.lynch@email.ie'),
    (21, 'Rachel Burke',       'rachel.burke@email.ie'),
    (22, 'Mark Sweeney',       'mark.sweeney@email.ie'),
    (23, 'Sarah Walsh',        'sarah.walsh@email.ie'),
    (24, 'Conor Daly',         'conor.daly@email.ie'),
    (25, 'Aisling Power',      'aisling.power@email.ie'),
    (26, 'Niall Sheehan',      'niall.sheehan@email.ie'),
    (27, 'Erin O''Driscoll',   'erin.odriscoll@email.ie'),
    (28, 'Stephen Curran',     'stephen.curran@email.ie'),
    (29, 'Ciara Doherty',      'ciara.doherty@email.ie'),
    (30, 'Ronan Dunne',        'ronan.dunne@email.ie'),
    (31, 'Aoibhinn Coyle',     'aoibhinn.coyle@email.ie'),
    (32, 'Cillian Mulligan',   'cillian.mulligan@email.ie'),
    (33, 'Eimear Hogan',       'eimear.hogan@email.ie'),
    (34, 'Donal McGrath',      'donal.mcgrath@email.ie'),
    (35, 'Hannah Kavanagh',    'hannah.kavanagh@email.ie'),
    (36, 'Fionn Buckley',      'fionn.buckley@email.ie'),
    (37, 'Saoirse Mooney',     'saoirse.mooney@email.ie'),
    (38, 'Ronan Curtis',       'ronan.curtis@email.ie'),
    (39, 'Niamh Daly',         'niamh.daly@email.ie'),
    (40, 'Patrick Heffernan',  'patrick.heffernan@email.ie'),
    (41, 'Aoife Carey',        'aoife.carey@email.ie'),
    (42, 'Liam Naughton',      'liam.naughton@email.ie'),
    (43, 'Meabh O''Sullivan',  'meabh.osullivan@email.ie'),
    (44, 'Cathal Greene',      'cathal.greene@email.ie'),
    (45, 'Ailbhe Tierney',     'ailbhe.tierney@email.ie'),
    (46, 'Daragh Walsh',       'daragh.walsh@email.ie'),
    (47, 'Eabha Costello',     'eabha.costello@email.ie'),
    (48, 'Killian Fox',        'killian.fox@email.ie'),
    (49, 'Treasa Begley',      'treasa.begley@email.ie'),
    (50, 'Oran Magee',         'oran.magee@email.ie')
),
numbered AS (
  SELECT
    u.id,
    ((ROW_NUMBER() OVER (ORDER BY u.development_id, u.unit_number, u.id) - 1) % 50) + 1 AS pool_idx
  FROM public.units u
  WHERE u.tenant_id = '4cee69c6-be4b-486e-9c33-2b5a7d30e287'
    AND u.purchaser_name IS NOT NULL
)
UPDATE public.units u
SET
  purchaser_name  = p.full_name,
  purchaser_email = p.email
FROM numbered n
JOIN pool p ON p.idx = n.pool_idx
WHERE u.id = n.id;

-- Verify: no remaining real or @example.com data on units.
-- SELECT COUNT(*) FILTER (WHERE purchaser_email LIKE '%@example.com') AS placeholder_emails_remaining,
--        COUNT(*) FILTER (WHERE purchaser_email NOT LIKE '%@email.ie' AND purchaser_email IS NOT NULL) AS off_pattern_emails
-- FROM units WHERE tenant_id = '4cee69c6-be4b-486e-9c33-2b5a7d30e287';


-- ----------------------------------------------------------------------------
-- BLOCK 3: Propagate cleaned units identities to unit_sales_pipeline
-- ----------------------------------------------------------------------------
UPDATE public.unit_sales_pipeline usp
SET
  purchaser_name  = u.purchaser_name,
  purchaser_email = u.purchaser_email
FROM public.units u
WHERE usp.unit_id = u.id
  AND usp.tenant_id = '4cee69c6-be4b-486e-9c33-2b5a7d30e287'
  AND u.purchaser_name IS NOT NULL;

-- Handle the small number of pipeline rows whose underlying unit was left
-- nameless (so the join above could not propagate). These have a real looking
-- pipeline name plus the old placeholder email. Map the email to the canonical
-- @email.ie form for the name on the pipeline row.
UPDATE public.unit_sales_pipeline
SET purchaser_email = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(purchaser_name, '''', '', 'g'), '\s+', '.', 'g')) || '@email.ie'
WHERE tenant_id = '4cee69c6-be4b-486e-9c33-2b5a7d30e287'
  AND purchaser_name IS NOT NULL
  AND purchaser_email IS NOT NULL
  AND purchaser_email NOT LIKE '%@email.ie';

-- And null out any leftover placeholder email on a nameless unit so it does
-- not leak through to other surfaces.
UPDATE public.units
SET purchaser_email = NULL
WHERE tenant_id = '4cee69c6-be4b-486e-9c33-2b5a7d30e287'
  AND purchaser_name IS NULL
  AND purchaser_email IS NOT NULL
  AND purchaser_email NOT LIKE '%@email.ie';

-- Verify: no @example.com left in pipeline.
-- SELECT COUNT(*) FILTER (WHERE purchaser_email LIKE '%@example.com') AS placeholder_emails_remaining
-- FROM unit_sales_pipeline WHERE tenant_id = '4cee69c6-be4b-486e-9c33-2b5a7d30e287';


-- ----------------------------------------------------------------------------
-- BLOCK 4: Propagate cleaned units identities to purchaser_agreements
--          (this table is keyed by development_id, not tenant_id directly)
-- ----------------------------------------------------------------------------
UPDATE public.purchaser_agreements pa
SET
  purchaser_name  = u.purchaser_name,
  purchaser_email = u.purchaser_email
FROM public.units u
JOIN public.developments d ON u.development_id = d.id
WHERE pa.unit_id = u.id
  AND d.tenant_id = '4cee69c6-be4b-486e-9c33-2b5a7d30e287';

-- Verify: agreements show cleaned names.
-- SELECT pa.id, pa.purchaser_name, pa.purchaser_email, d.name AS dev
-- FROM purchaser_agreements pa
-- JOIN developments d ON pa.development_id = d.id
-- WHERE d.tenant_id = '4cee69c6-be4b-486e-9c33-2b5a7d30e287';


-- ----------------------------------------------------------------------------
-- BLOCK 5: Seed varied unit_pipeline_notes per development so that
--          unresolvedNotesCount > 0 on every scheme. Without this the
--          developer pipeline page renders the hardcoded "20" demo fallback.
--          Targets after this block:
--             Ardan View          7
--             Bayside Apartments  1
--             Longview Park      12
--             OpenHouse Select    1
--             Rathard Lawn        4
--             Rathard Park        8  (3 existing + 5 new)
-- ----------------------------------------------------------------------------
WITH dev_pipeline AS (
  SELECT
    usp.id        AS pipeline_id,
    usp.unit_id   AS unit_id,
    d.id          AS dev_id,
    d.name        AS dev_name,
    ROW_NUMBER() OVER (PARTITION BY d.id ORDER BY usp.id) AS rn
  FROM public.unit_sales_pipeline usp
  JOIN public.developments d ON usp.development_id = d.id
  WHERE usp.tenant_id = '4cee69c6-be4b-486e-9c33-2b5a7d30e287'
),
note_templates(slot, body) AS (
  VALUES
    ( 1, 'Solicitor confirmed receipt of contracts. Awaiting buyer signature.'),
    ( 2, 'Buyer requested clarification on snag list completion timeline.'),
    ( 3, 'Mortgage approval letter received. Drawdown date to confirm with bank.'),
    ( 4, 'Awaiting LPT receipt from solicitor before counter signing.'),
    ( 5, 'Kitchen counter selection pending. Buyer reviewing options.'),
    ( 6, 'Snag list returned with minor items. Site team scheduled to address.'),
    ( 7, 'Buyer requested viewing slot before contracts issued.'),
    ( 8, 'Estimated close date confirmed for next month. On track.'),
    ( 9, 'Awaiting deposit confirmation from buyer solicitor.'),
    (10, 'Insurance and structural warranty paperwork ready for issue.'),
    (11, 'Bank valuation completed. Awaiting formal mortgage offer.'),
    (12, 'Buyer requested follow up on EV charger installation status.')
)
INSERT INTO public.unit_pipeline_notes (
  id, tenant_id, pipeline_id, unit_id, note_type, content, is_resolved, created_by, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  '4cee69c6-be4b-486e-9c33-2b5a7d30e287'::uuid,
  dp.pipeline_id,
  dp.unit_id,
  'query',
  nt.body,
  FALSE,
  -- Use the tenant's developer admin so RLS reads stay tenant scoped.
  (SELECT id FROM public.admins WHERE tenant_id = '4cee69c6-be4b-486e-9c33-2b5a7d30e287' LIMIT 1),
  NOW() - (INTERVAL '1 day' * ((dp.rn * 3) % 30)),
  NOW() - (INTERVAL '1 day' * ((dp.rn * 3) % 30))
FROM dev_pipeline dp
JOIN note_templates nt ON nt.slot = ((dp.rn - 1) % 12) + 1
WHERE
     (dp.dev_name = 'Ardan View'            AND dp.rn <= 7)
  OR (dp.dev_name = 'Bayside Apartments'    AND dp.rn <= 1)
  OR (dp.dev_name = 'Longview Park'         AND dp.rn <= 12)
  OR (dp.dev_name = 'OpenHouse Select Demo' AND dp.rn <= 1)
  OR (dp.dev_name = 'Rathard Lawn'          AND dp.rn <= 4)
  OR (dp.dev_name = 'Rathard Park'          AND dp.rn <= 5);

-- Verify per development counts of unresolved notes.
-- SELECT d.name, COUNT(*) FILTER (WHERE n.is_resolved = false) AS unresolved
-- FROM developments d
-- LEFT JOIN unit_sales_pipeline usp ON usp.development_id = d.id
-- LEFT JOIN unit_pipeline_notes n ON n.pipeline_id = usp.id
-- WHERE d.tenant_id = '4cee69c6-be4b-486e-9c33-2b5a7d30e287'
-- GROUP BY d.name ORDER BY d.name;
