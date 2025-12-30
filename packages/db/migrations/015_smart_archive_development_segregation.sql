-- Migration: Smart Archive Development-Level Segregation
-- Adds optional development-level segregation for the Smart Archive system

-- Step 1: Create archive_mode enum type
DO $$ BEGIN
  CREATE TYPE archive_mode_enum AS ENUM ('shared', 'isolated');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Step 2: Create upload_status enum type  
DO $$ BEGIN
  CREATE TYPE upload_status_enum AS ENUM ('pending', 'indexed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Step 3: Add archive_mode column to developments table
ALTER TABLE developments 
ADD COLUMN IF NOT EXISTS archive_mode archive_mode_enum DEFAULT 'shared' NOT NULL;

-- Step 4: Add upload_status column to documents table
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS upload_status upload_status_enum DEFAULT 'pending' NOT NULL;

-- Step 5: Create index for efficient archive mode filtering
CREATE INDEX IF NOT EXISTS idx_developments_archive_mode 
ON developments(archive_mode);

-- Step 6: Create index for upload status filtering
CREATE INDEX IF NOT EXISTS idx_documents_upload_status 
ON documents(upload_status);

-- Step 7: Create composite index for development-scoped document queries
CREATE INDEX IF NOT EXISTS idx_documents_development_status 
ON documents(development_id, upload_status) 
WHERE development_id IS NOT NULL;

-- Migration complete
COMMENT ON COLUMN developments.archive_mode IS 'Controls document visibility: shared = all developers see all docs, isolated = docs segregated by development';
COMMENT ON COLUMN documents.upload_status IS 'Document indexing status: pending = awaiting processing, indexed = ready for search, failed = processing error';
