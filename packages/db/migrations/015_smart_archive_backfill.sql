-- Backfill Script: Smart Archive Development-Level Segregation
-- Creates default "Master Archive" development for existing developers and attaches documents

-- Step 1: For each tenant without developments, create a Master Archive development
-- Uses UUID suffix to prevent code/slug collisions
INSERT INTO developments (
  id,
  tenant_id,
  code,
  name,
  slug,
  description,
  archive_mode,
  created_at
)
SELECT 
  gen_random_uuid() as new_id,
  t.id,
  CONCAT('MASTER-', REPLACE(gen_random_uuid()::text, '-', '')::text) as unique_code,
  'Master Archive',
  CONCAT(t.slug, '-master-', LEFT(REPLACE(gen_random_uuid()::text, '-', ''), 8)) as unique_slug,
  'Default development for pre-existing documents',
  'shared'::archive_mode_enum,
  NOW()
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM developments d WHERE d.tenant_id = t.id
);

-- Step 2: Attach orphaned documents (with NULL development_id) to their tenant's first development
-- Uses a CTE to get the first development per tenant for efficiency
WITH first_developments AS (
  SELECT DISTINCT ON (tenant_id) 
    tenant_id, 
    id as development_id
  FROM developments
  ORDER BY tenant_id, created_at ASC
)
UPDATE documents d
SET development_id = fd.development_id
FROM first_developments fd
WHERE d.tenant_id = fd.tenant_id
AND d.development_id IS NULL;

-- Step 3: Set upload_status to 'indexed' for documents that already have embeddings/chunks
UPDATE documents
SET upload_status = 'indexed'::upload_status_enum
WHERE chunks_count > 0 
AND upload_status = 'pending'::upload_status_enum;

-- Step 4: Set upload_status to 'failed' for documents with processing errors
UPDATE documents
SET upload_status = 'failed'::upload_status_enum
WHERE processing_status = 'error' 
AND upload_status = 'pending'::upload_status_enum;

-- Step 5: Ensure all developments have archive_mode set (in case of partial migration)
UPDATE developments
SET archive_mode = 'shared'::archive_mode_enum
WHERE archive_mode IS NULL;

-- Verification queries (run to check backfill results)
-- SELECT COUNT(*) as orphaned_docs FROM documents WHERE development_id IS NULL;
-- SELECT archive_mode, COUNT(*) FROM developments GROUP BY archive_mode;
-- SELECT upload_status, COUNT(*) FROM documents GROUP BY upload_status;
