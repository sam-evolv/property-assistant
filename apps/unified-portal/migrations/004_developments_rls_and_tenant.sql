-- ============================================================================
-- MIGRATION 004: DEVELOPMENTS RLS + TENANT ENFORCEMENT
-- ============================================================================
-- Purpose: Enable RLS on developments and enforce tenant_id NOT NULL
-- ============================================================================

-- ============================================================================
-- STEP 1: Enable RLS on developments
-- ============================================================================
ALTER TABLE developments ENABLE ROW LEVEL SECURITY;

-- Drop any existing anon policies
DROP POLICY IF EXISTS developments_anon_read ON developments;
DROP POLICY IF EXISTS developments_public_read ON developments;
DROP POLICY IF EXISTS "Enable read access for all users" ON developments;

-- Service role has full access
DROP POLICY IF EXISTS developments_service_role_all ON developments;
CREATE POLICY developments_service_role_all ON developments
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Authenticated users can read developments (scoped via application layer)
DROP POLICY IF EXISTS developments_tenant_read ON developments;
CREATE POLICY developments_tenant_read ON developments
  FOR SELECT TO authenticated
  USING (true);

-- ============================================================================
-- STEP 2: Fix developments.tenant_id NULL values before adding NOT NULL
-- ============================================================================
DO $$
DECLARE
  v_null_count INTEGER;
  v_default_tenant_id UUID;
BEGIN
  -- Count NULLs
  SELECT COUNT(*) INTO v_null_count FROM developments WHERE tenant_id IS NULL;
  
  IF v_null_count > 0 THEN
    -- Get the first tenant as fallback
    SELECT id INTO v_default_tenant_id FROM tenants ORDER BY created_at LIMIT 1;
    
    IF v_default_tenant_id IS NULL THEN
      RAISE EXCEPTION 'Cannot fix NULL tenant_ids: no tenants exist';
    END IF;
    
    -- Update NULL tenant_ids to default tenant
    UPDATE developments SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
    RAISE NOTICE 'Fixed % developments with NULL tenant_id, set to %', v_null_count, v_default_tenant_id;
  ELSE
    RAISE NOTICE 'No developments with NULL tenant_id';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Add NOT NULL constraint on tenant_id
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'developments' 
    AND column_name = 'tenant_id'
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE developments ALTER COLUMN tenant_id SET NOT NULL;
    RAISE NOTICE 'Added NOT NULL constraint to developments.tenant_id';
  ELSE
    RAISE NOTICE 'developments.tenant_id already has NOT NULL constraint';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Create tenant alignment trigger for units
-- ============================================================================
CREATE OR REPLACE FUNCTION enforce_unit_tenant_alignment()
RETURNS TRIGGER AS $$
DECLARE
  v_dev_tenant_id UUID;
BEGIN
  -- Get the tenant_id from the development
  SELECT tenant_id INTO v_dev_tenant_id 
  FROM developments 
  WHERE id = NEW.development_id;
  
  IF v_dev_tenant_id IS NULL THEN
    RAISE EXCEPTION 'TENANT ALIGNMENT: development_id % does not exist or has no tenant_id', NEW.development_id;
  END IF;
  
  -- Enforce tenant alignment
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := v_dev_tenant_id;
  ELSIF NEW.tenant_id != v_dev_tenant_id THEN
    RAISE EXCEPTION 'TENANT ALIGNMENT VIOLATION: unit tenant_id (%) must match development tenant_id (%)', 
      NEW.tenant_id, v_dev_tenant_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_tenant_alignment_units ON units;
CREATE TRIGGER enforce_tenant_alignment_units
  BEFORE INSERT OR UPDATE ON units
  FOR EACH ROW
  EXECUTE FUNCTION enforce_unit_tenant_alignment();

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 004: Developments security hardened';
  RAISE NOTICE '  - RLS: ENABLED';
  RAISE NOTICE '  - Anon access: BLOCKED';
  RAISE NOTICE '  - tenant_id: NOT NULL enforced';
  RAISE NOTICE '  - Tenant alignment trigger: ACTIVE';
END $$;
