-- 072_demo_ohdemo_hpi_evidence_teardown.sql
-- Removes the OHDEMO compliance evidence seeded by 072_demo_ohdemo_hpi_evidence.sql.
-- Order matters: documents reference document_types (no ON DELETE CASCADE).
-- Committed for the reset workflow; NOT auto-applied.

WITH demo_dev AS (SELECT id FROM developments WHERE code = 'OHDEMO')
DELETE FROM compliance_documents
WHERE development_id IN (SELECT id FROM demo_dev) AND uploaded_by = 'demo-seed';

WITH demo_dev AS (SELECT id FROM developments WHERE code = 'OHDEMO')
DELETE FROM compliance_document_types
WHERE development_id IN (SELECT id FROM demo_dev);
