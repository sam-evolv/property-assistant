-- Migration: add project_id to documents table
-- Run manually in Supabase SQL Editor.
--
-- project_id stores the Supabase project UUID that corresponds to this
-- document's development. It is used as the partition key when inserting
-- rows into document_sections so that the homeowner AI assistant can find
-- them via the match_document_sections RPC.
--
-- For existing rows, project_id will be NULL and the ingest route falls
-- back to the hardcoded development→project mapping while backfilling.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS project_id TEXT;

CREATE INDEX IF NOT EXISTS documents_project_id_idx ON documents (project_id)
  WHERE project_id IS NOT NULL;
