-- Add discipline column to documents table for Smart Archive feature
-- This categorizes documents into engineering disciplines like Architectural, Electrical, etc.

-- Add the discipline column
ALTER TABLE documents ADD COLUMN IF NOT EXISTS discipline TEXT;

-- Add revision_code for document versioning display
ALTER TABLE documents ADD COLUMN IF NOT EXISTS revision_code VARCHAR(20);

-- Create index for efficient discipline-based queries
CREATE INDEX IF NOT EXISTS idx_documents_discipline ON documents(tenant_id, development_id, discipline);

-- Create index for archive queries (discipline + created_at for ordering)
CREATE INDEX IF NOT EXISTS idx_documents_archive ON documents(tenant_id, development_id, discipline, created_at DESC);
