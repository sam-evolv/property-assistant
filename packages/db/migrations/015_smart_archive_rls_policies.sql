-- RLS Policies: Smart Archive Development-Level Segregation
-- Enforces tenant isolation and development-scoped document access

-- Enable RLS on documents table if not already enabled
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for clean re-application)
DROP POLICY IF EXISTS documents_tenant_isolation ON documents;
DROP POLICY IF EXISTS documents_development_access ON documents;
DROP POLICY IF EXISTS documents_insert_policy ON documents;
DROP POLICY IF EXISTS documents_update_policy ON documents;
DROP POLICY IF EXISTS documents_select_policy ON documents;

-- Single unified SELECT policy that enforces both tenant AND development-level access
-- This prevents OR-composition issues by handling all conditions in one policy
CREATE POLICY documents_select_policy ON documents
FOR SELECT
USING (
  -- Must match tenant (hard requirement)
  tenant_id = current_setting('app.tenant_id', true)::uuid
  AND (
    -- Case 1: Document has no development (tenant-level shared doc)
    development_id IS NULL
    -- Case 2: Development is in 'shared' mode - all tenant users can see
    OR EXISTS (
      SELECT 1 FROM developments dev 
      WHERE dev.id = documents.development_id 
      AND dev.archive_mode = 'shared'
    )
    -- Case 3: Development is in 'isolated' mode AND in allowed list
    OR (
      EXISTS (
        SELECT 1 FROM developments dev 
        WHERE dev.id = documents.development_id 
        AND dev.archive_mode = 'isolated'
      )
      AND (
        -- Only check allowed list if it's non-empty
        COALESCE(NULLIF(current_setting('app.allowed_development_ids', true), ''), NULL) IS NOT NULL
        AND development_id = ANY(
          string_to_array(
            current_setting('app.allowed_development_ids', true),
            ','
          )::uuid[]
        )
      )
    )
  )
);

-- INSERT policy - developers can only insert to their tenant
CREATE POLICY documents_insert_policy ON documents
FOR INSERT
WITH CHECK (
  tenant_id = current_setting('app.tenant_id', true)::uuid
);

-- UPDATE policy - developers can only update their tenant's documents
CREATE POLICY documents_update_policy ON documents
FOR UPDATE
USING (
  tenant_id = current_setting('app.tenant_id', true)::uuid
)
WITH CHECK (
  tenant_id = current_setting('app.tenant_id', true)::uuid
);

-- DELETE policy - developers can only delete their tenant's documents
CREATE POLICY documents_delete_policy ON documents
FOR DELETE
USING (
  tenant_id = current_setting('app.tenant_id', true)::uuid
);

-- Enable RLS on developments table
ALTER TABLE developments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS developments_tenant_isolation ON developments;
DROP POLICY IF EXISTS developments_select_policy ON developments;

-- Policy: Development tenant isolation
CREATE POLICY developments_select_policy ON developments
FOR ALL
USING (
  tenant_id = current_setting('app.tenant_id', true)::uuid
);

-- Create helper function to set session context with proper null handling
CREATE OR REPLACE FUNCTION set_archive_context(
  p_tenant_id UUID,
  p_development_ids UUID[] DEFAULT NULL
) RETURNS void AS $$
BEGIN
  -- Always set tenant
  PERFORM set_config('app.tenant_id', p_tenant_id::text, false);
  
  -- Clear or set development IDs (prevents scope leakage on pooled connections)
  IF p_development_ids IS NULL OR array_length(p_development_ids, 1) IS NULL THEN
    PERFORM set_config('app.allowed_development_ids', '', false);
  ELSE
    PERFORM set_config('app.allowed_development_ids', array_to_string(p_development_ids, ','), false);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to clear context (call on connection return to pool)
CREATE OR REPLACE FUNCTION clear_archive_context() RETURNS void AS $$
BEGIN
  PERFORM set_config('app.tenant_id', '', false);
  PERFORM set_config('app.allowed_development_ids', '', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_archive_context IS 'Sets session context for RLS policies. Call before document queries.';
COMMENT ON FUNCTION clear_archive_context IS 'Clears session context. Call when returning connection to pool.';
