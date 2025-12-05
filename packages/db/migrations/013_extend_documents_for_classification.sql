-- Migration 013: Extend documents table for Smart Archive Phase 2
-- Adds must_read flag for document classification

-- Add must_read column for critical documents that residents must read
ALTER TABLE documents ADD COLUMN IF NOT EXISTS must_read BOOLEAN DEFAULT FALSE NOT NULL;

-- Create index for must_read filter queries
CREATE INDEX IF NOT EXISTS idx_documents_must_read ON documents(tenant_id, development_id, must_read) WHERE must_read = true;

-- Create composite index for archive filtering by important and must_read
CREATE INDEX IF NOT EXISTS idx_documents_archive_flags ON documents(tenant_id, development_id, is_important, must_read);

-- Add processing metadata for AI classification tracking
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_classified BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_classified_at TIMESTAMPTZ;

-- Create index for AI classification status
CREATE INDEX IF NOT EXISTS idx_documents_ai_classified ON documents(ai_classified, ai_classified_at);
