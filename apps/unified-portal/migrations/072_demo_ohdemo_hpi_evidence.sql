-- 072_demo_ohdemo_hpi_evidence.sql
-- ============================================================================
-- DEMO DATA ONLY — HPI compliance evidence for "OpenHouse Demo Park" (OHDEMO)
-- Teardown: 072_demo_ohdemo_hpi_evidence_teardown.sql
-- Applied to the live project via the Supabase MCP on 2026-06-09.
-- ============================================================================
-- Adds the per-unit compliance evidence layer the HPI command centre scores
-- against (the QA 8.0 / systems evidence is already seeded by migration 071).
-- Designed to land the scheme at ~mid-70s% readiness with the mandatory gate
-- just short (unit 6 the obvious laggard) so the gap report + chase-list have
-- real substance.
--
-- Schema notes (verified live 2026-06-09):
--   compliance_document_types: NOT NULL tenant_id, development_id, name,
--     category (vocab: Certification|Safety|Registration|Warranty), required.
--   compliance_documents: NOT NULL tenant_id, development_id, unit_id,
--     document_type_id; status default 'missing'; UNIQUE (unit_id, document_type_id).
--   No compliance_files rows are inserted (file_size/file_type are NOT NULL and
--     we have no binaries; the evidence-pack only signs docs that have a file,
--     so it stays valid). unit_intelligence_profiles does NOT exist live, so the
--     BER rating is carried in the BER document's notes.

-- ---------------------------------------------------------------------------
-- 1. Compliance document types for OHDEMO (the 7 standard + 3 HPI-specific)
-- ---------------------------------------------------------------------------
INSERT INTO compliance_document_types (tenant_id, development_id, name, category, required)
SELECT '4cee69c6-be4b-486e-9c33-2b5a7d30e287', 'dd000000-0000-4000-a000-000000000001', v.name, v.category, true
FROM (VALUES
  ('BER Certificate', 'Certification'),
  ('BCMS Certificate', 'Certification'),
  ('Electrical Certificate', 'Certification'),
  ('Fire Safety Certificate', 'Safety'),
  ('Gas Safety Certificate', 'Safety'),
  ('HomeBond Registration', 'Registration'),
  ('Structural Warranty', 'Warranty'),
  ('Airtightness Test Result', 'Certification'),
  ('Ventilation Commissioning Certificate', 'Certification'),
  ('Thermal Bridging Assessment', 'Certification')
) AS v(name, category)
WHERE NOT EXISTS (
  SELECT 1 FROM compliance_document_types t
  WHERE t.development_id = 'dd000000-0000-4000-a000-000000000001' AND t.name = v.name
);

-- ---------------------------------------------------------------------------
-- 2. Per-unit compliance documents — status matrix per (unit, type).
--    verified = ready, uploaded = partial, missing = no row (a gap).
--    One row per (unit, type); idempotent via ON CONFLICT.
-- ---------------------------------------------------------------------------
INSERT INTO compliance_documents (tenant_id, development_id, unit_id, document_type_id, status, uploaded_by, expiry_date, notes)
SELECT
  u.tenant_id,
  u.development_id,
  u.id,
  t.id,
  s.status,
  'demo-seed',
  CASE
    WHEN m.doc = 'BER Certificate' AND u.unit_number = '2' THEN now() + interval '20 days'  -- expiring soon
    WHEN m.doc = 'Gas Safety Certificate' AND u.unit_number = '5' THEN now() - interval '10 days' -- expired
    ELSE NULL
  END,
  CASE
    WHEN m.doc = 'BER Certificate'
      THEN 'Rating ' || (CASE WHEN u.unit_number IN ('1','2','3','4') THEN 'A2' ELSE 'A3' END)
    ELSE NULL
  END
FROM units u
JOIN (VALUES
  -- doc,                                    U1,        U2,        U3,        U4,        U5,        U6
  ('BER Certificate',                       'verified','verified','verified','verified','verified','missing'),
  ('Airtightness Test Result',              'verified','verified','verified','verified','verified','missing'),
  ('Ventilation Commissioning Certificate', 'verified','verified','verified','verified','verified','missing'),
  ('Thermal Bridging Assessment',           'verified','verified','verified','verified','verified','verified'),
  ('Electrical Certificate',                'verified','verified','verified','verified','uploaded','missing'),
  ('Fire Safety Certificate',               'verified','verified','verified','verified','verified','uploaded'),
  ('Gas Safety Certificate',                'verified','verified','uploaded','verified','expired', 'missing'),
  ('BCMS Certificate',                      'verified','verified','verified','uploaded','uploaded','missing'),
  ('HomeBond Registration',                 'verified','verified','verified','verified','verified','uploaded'),
  ('Structural Warranty',                   'verified','verified','verified','verified','uploaded','uploaded')
) AS m(doc, u1, u2, u3, u4, u5, u6) ON TRUE
JOIN compliance_document_types t
  ON t.development_id = 'dd000000-0000-4000-a000-000000000001' AND t.name = m.doc
CROSS JOIN LATERAL (
  SELECT CASE u.unit_number
    WHEN '1' THEN m.u1 WHEN '2' THEN m.u2 WHEN '3' THEN m.u3
    WHEN '4' THEN m.u4 WHEN '5' THEN m.u5 WHEN '6' THEN m.u6
  END AS status
) s
WHERE u.development_id = 'dd000000-0000-4000-a000-000000000001'
  AND s.status IS NOT NULL
  AND s.status <> 'missing'
ON CONFLICT (unit_id, document_type_id) DO NOTHING;
