-- ============================================================================
-- PENDING APPLICATION TO PRODUCTION via Supabase MCP.
--
-- Required before /api/lettings/lease-upload can create lettings_documents
-- rows for orphan PDFs (uploaded before the property is saved). Without
-- this, the insert fails the NOT NULL constraint on letting_property_id
-- and the lease PDF flow breaks at the first drop.
--
-- Apply with:
--   ALTER TABLE lettings_documents ALTER COLUMN letting_property_id DROP NOT NULL;
-- (One-line SQL — does not need block-by-block application like 052.)
--
-- Once applied, update the header below to:
--   ALREADY APPLIED TO PRODUCTION via Supabase MCP on YYYY-MM-DD.
--   DO NOT RE-RUN. Recorded here for audit / future env bootstrap only.
-- ============================================================================

-- Migration: 053_lettings_documents_nullable_property.sql
--
-- Background:
--   Migration 052 created lettings_documents with letting_property_id as
--   REFERENCES agent_letting_properties(id) ON DELETE CASCADE NOT NULL.
--   That assumed every document is created in the context of a known
--   property.
--
--   Session 7 changes the lease-PDF flow so the PDF is uploaded the
--   moment it's dropped on the entry screen — long before the property
--   record exists. The document row needs to be created in an "orphan"
--   state, and Session 8's save flow links it to the property at the
--   point of save.
--
--   Two ways to handle the orphan: nullable FK or a placeholder
--   property. We chose nullable FK because:
--     - Single source of truth (no shadow rows to clean up)
--     - Matches the natural lifecycle (PDF exists, property pending)
--     - Trivial to revert if we change our minds later

ALTER TABLE lettings_documents
  ALTER COLUMN letting_property_id DROP NOT NULL;

-- No data backfill needed — existing rows already satisfy the constraint.
-- The on-delete cascade still applies once the FK is set, so deleting a
-- property still cascades to its documents. Orphan rows (with letting_
-- property_id IS NULL) are unaffected by property deletion and live until
-- the user explicitly cancels the save flow (cleanup TODO post-launch).
