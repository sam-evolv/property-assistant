-- =============================================================================
-- MULTI-TENANT HARDENING MIGRATION v3
-- =============================================================================
-- Purpose: Add constraints, foreign keys, triggers, and RLS policies to prevent
--          cross-tenant data contamination and ensure data integrity.
-- 
-- IMPORTANT: This migration is TRANSACTIONAL and will ABORT if orphaned data
-- exists that cannot be auto-fixed. Run recovery script FIRST if needed.
--
-- Pre-flight check: Run `SELECT * FROM orphaned_data_summary;` after migration
-- to verify no orphaned data remains.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. PRE-FLIGHT: DROP ALL LEGACY RLS POLICIES
-- -----------------------------------------------------------------------------
-- This ensures no legacy anon/global policies remain that could expose data.
-- We drop all known policy names, then recreate only the strict set we need.

-- Drop any existing policies on messages
DROP POLICY IF EXISTS messages_service_role_all ON messages;
DROP POLICY IF EXISTS messages_tenant_read ON messages;
DROP POLICY IF EXISTS messages_tenant_write ON messages;
DROP POLICY IF EXISTS messages_authenticated_read ON messages;
DROP POLICY IF EXISTS messages_authenticated_write ON messages;
DROP POLICY IF EXISTS messages_anon_read ON messages;

-- Drop any existing policies on documents  
DROP POLICY IF EXISTS documents_service_role_all ON documents;
DROP POLICY IF EXISTS documents_tenant_read ON documents;
DROP POLICY IF EXISTS documents_tenant_write ON documents;
DROP POLICY IF EXISTS documents_authenticated_read ON documents;
DROP POLICY IF EXISTS documents_authenticated_write ON documents;
DROP POLICY IF EXISTS documents_anon_read ON documents;

-- Drop any existing policies on developments
DROP POLICY IF EXISTS developments_service_role_all ON developments;
DROP POLICY IF EXISTS developments_tenant_read ON developments;
DROP POLICY IF EXISTS developments_authenticated_read ON developments;
DROP POLICY IF EXISTS developments_anon_read ON developments;

-- Drop any existing policies on units
DROP POLICY IF EXISTS units_service_role_all ON units;
DROP POLICY IF EXISTS units_tenant_read ON units;
DROP POLICY IF EXISTS units_authenticated_read ON units;
DROP POLICY IF EXISTS units_anon_read ON units;

-- Drop any existing policies on house_types
DROP POLICY IF EXISTS house_types_service_role_all ON house_types;
DROP POLICY IF EXISTS house_types_tenant_read ON house_types;
DROP POLICY IF EXISTS house_types_authenticated_read ON house_types;
DROP POLICY IF EXISTS house_types_anon_read ON house_types;

-- Drop any existing policies on noticeboard_posts
DROP POLICY IF EXISTS noticeboard_posts_service_role_all ON noticeboard_posts;
DROP POLICY IF EXISTS noticeboard_posts_tenant_read ON noticeboard_posts;
DROP POLICY IF EXISTS noticeboard_authenticated_read ON noticeboard_posts;

-- Drop any existing policies on analytics_events
DROP POLICY IF EXISTS analytics_events_service_role_all ON analytics_events;
DROP POLICY IF EXISTS analytics_events_tenant_read ON analytics_events;
DROP POLICY IF EXISTS analytics_events_authenticated_read ON analytics_events;
DROP POLICY IF EXISTS analytics_events_authenticated_write ON analytics_events;

-- Drop any existing policies on archive_folders
DROP POLICY IF EXISTS archive_folders_service_role_all ON archive_folders;
DROP POLICY IF EXISTS archive_folders_authenticated_read ON archive_folders;

-- -----------------------------------------------------------------------------
-- 1. MESSAGES TABLE: Enforce NOT NULL and add indexes
-- -----------------------------------------------------------------------------

-- First, fix any NULL development_ids using metadata
UPDATE messages 
SET development_id = (metadata->>'development_id')::uuid
WHERE development_id IS NULL 
  AND metadata->>'development_id' IS NOT NULL;

-- For remaining NULLs with unit_id, match via units table
UPDATE messages m
SET development_id = u.project_id
FROM units u
WHERE m.development_id IS NULL 
  AND m.unit_id IS NOT NULL 
  AND m.unit_id = u.id;

-- STRICT ENFORCEMENT: Abort if orphaned rows remain
DO $$
DECLARE
  v_orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_orphan_count FROM messages WHERE development_id IS NULL;
  IF v_orphan_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: % messages have NULL development_id. Run recovery script first.', v_orphan_count;
  END IF;
  
  SELECT COUNT(*) INTO v_orphan_count FROM messages WHERE tenant_id IS NULL;
  IF v_orphan_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: % messages have NULL tenant_id. Run recovery script first.', v_orphan_count;
  END IF;
  
  RAISE NOTICE 'Pre-flight check passed: No orphaned messages found';
END $$;

-- Now add NOT NULL constraint unconditionally
ALTER TABLE messages ALTER COLUMN development_id SET NOT NULL;
ALTER TABLE messages ALTER COLUMN tenant_id SET NOT NULL;

-- Add performance index for multi-tenant queries
CREATE INDEX IF NOT EXISTS messages_tenant_dev_unit_created_idx 
ON messages(tenant_id, development_id, unit_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 1b. STRICT NOT NULL ENFORCEMENT FOR ALL TENANT-SCOPED TABLES
-- -----------------------------------------------------------------------------
-- These constraints will ABORT the transaction if orphaned rows exist.
-- Run recovery script BEFORE applying this migration.

-- Pre-flight checks for all tables
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Check units
  SELECT COUNT(*) INTO v_count FROM units WHERE tenant_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % units have NULL tenant_id', v_count;
  END IF;
  
  SELECT COUNT(*) INTO v_count FROM units WHERE project_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % units have NULL project_id (development_id)', v_count;
  END IF;
  
  -- Check documents
  SELECT COUNT(*) INTO v_count FROM documents WHERE tenant_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % documents have NULL tenant_id', v_count;
  END IF;
  
  -- Check developments
  SELECT COUNT(*) INTO v_count FROM developments WHERE tenant_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % developments have NULL tenant_id', v_count;
  END IF;
  
  -- Check house_types
  SELECT COUNT(*) INTO v_count FROM house_types WHERE tenant_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % house_types have NULL tenant_id', v_count;
  END IF;
  
  -- Check analytics_events (may not exist or may be empty - skip if empty)
  BEGIN
    SELECT COUNT(*) INTO v_count FROM analytics_events WHERE tenant_id IS NULL OR development_id IS NULL;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'ABORT: % analytics_events have NULL tenant_id or development_id', v_count;
    END IF;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'analytics_events table does not exist - skipping check';
  END;
  
  RAISE NOTICE 'Pre-flight checks passed: No orphaned rows detected';
END $$;

-- Now apply NOT NULL constraints unconditionally
ALTER TABLE units ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE units ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE documents ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE developments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE house_types ALTER COLUMN tenant_id SET NOT NULL;

-- analytics_events may not exist
DO $$
BEGIN
  ALTER TABLE analytics_events ALTER COLUMN tenant_id SET NOT NULL;
  ALTER TABLE analytics_events ALTER COLUMN development_id SET NOT NULL;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'analytics_events table does not exist - skipping NOT NULL';
END $$;

-- -----------------------------------------------------------------------------
-- 1c. FOREIGN KEY CONSTRAINTS - STRICT ENFORCEMENT
-- -----------------------------------------------------------------------------
-- These constraints will ABORT the transaction if FK violations exist.
-- Pre-flight checks detect offending rows before attempting constraint creation.

DO $$
DECLARE
  v_count INTEGER;
  v_sample TEXT;
BEGIN
  -- Check messages.tenant_id → tenants.id
  SELECT COUNT(*), string_agg(m.id::text, ', ' ORDER BY m.id LIMIT 5)
  INTO v_count, v_sample
  FROM messages m
  LEFT JOIN tenants t ON m.tenant_id = t.id
  WHERE m.tenant_id IS NOT NULL AND t.id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % messages have invalid tenant_id (FK violation). Sample IDs: %', v_count, v_sample;
  END IF;
  
  -- Check messages.development_id → developments.id
  SELECT COUNT(*), string_agg(m.id::text, ', ' ORDER BY m.id LIMIT 5)
  INTO v_count, v_sample
  FROM messages m
  LEFT JOIN developments d ON m.development_id = d.id
  WHERE m.development_id IS NOT NULL AND d.id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % messages have invalid development_id (FK violation). Sample IDs: %', v_count, v_sample;
  END IF;
  
  -- Check units.tenant_id → tenants.id
  SELECT COUNT(*), string_agg(u.id::text, ', ' ORDER BY u.id LIMIT 5)
  INTO v_count, v_sample
  FROM units u
  LEFT JOIN tenants t ON u.tenant_id = t.id
  WHERE u.tenant_id IS NOT NULL AND t.id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % units have invalid tenant_id (FK violation). Sample IDs: %', v_count, v_sample;
  END IF;
  
  -- Check units.project_id → developments.id
  SELECT COUNT(*), string_agg(u.id::text, ', ' ORDER BY u.id LIMIT 5)
  INTO v_count, v_sample
  FROM units u
  LEFT JOIN developments d ON u.project_id = d.id
  WHERE u.project_id IS NOT NULL AND d.id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % units have invalid project_id (FK violation). Sample IDs: %', v_count, v_sample;
  END IF;
  
  -- Check documents.tenant_id → tenants.id
  SELECT COUNT(*), string_agg(doc.id::text, ', ' ORDER BY doc.id LIMIT 5)
  INTO v_count, v_sample
  FROM documents doc
  LEFT JOIN tenants t ON doc.tenant_id = t.id
  WHERE doc.tenant_id IS NOT NULL AND t.id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % documents have invalid tenant_id (FK violation). Sample IDs: %', v_count, v_sample;
  END IF;
  
  -- Check house_types.tenant_id → tenants.id
  SELECT COUNT(*), string_agg(ht.id::text, ', ' ORDER BY ht.id LIMIT 5)
  INTO v_count, v_sample
  FROM house_types ht
  LEFT JOIN tenants t ON ht.tenant_id = t.id
  WHERE ht.tenant_id IS NOT NULL AND t.id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % house_types have invalid tenant_id (FK violation). Sample IDs: %', v_count, v_sample;
  END IF;
  
  -- CRITICAL: Check tenant alignment - units.tenant_id must match developments.tenant_id
  SELECT COUNT(*), string_agg(u.id::text, ', ' ORDER BY u.id LIMIT 5)
  INTO v_count, v_sample
  FROM units u
  JOIN developments d ON u.project_id = d.id
  WHERE u.tenant_id != d.tenant_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % units have tenant_id mismatch with development tenant_id. Sample IDs: %', v_count, v_sample;
  END IF;
  
  -- Check tenant alignment - messages.tenant_id must match developments.tenant_id
  SELECT COUNT(*), string_agg(m.id::text, ', ' ORDER BY m.id LIMIT 5)
  INTO v_count, v_sample
  FROM messages m
  JOIN developments d ON m.development_id = d.id
  WHERE m.tenant_id != d.tenant_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % messages have tenant_id mismatch with development tenant_id. Sample IDs: %', v_count, v_sample;
  END IF;
  
  -- Check tenant alignment - house_types.tenant_id must match developments.tenant_id
  SELECT COUNT(*), string_agg(ht.id::text, ', ' ORDER BY ht.id LIMIT 5)
  INTO v_count, v_sample
  FROM house_types ht
  JOIN developments d ON ht.development_id = d.id
  WHERE ht.tenant_id != d.tenant_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % house_types have tenant_id mismatch with development tenant_id. Sample IDs: %', v_count, v_sample;
  END IF;
  
  -- Check tenant alignment - documents.tenant_id must match developments.tenant_id
  SELECT COUNT(*), string_agg(doc.id::text, ', ' ORDER BY doc.id LIMIT 5)
  INTO v_count, v_sample
  FROM documents doc
  JOIN developments d ON doc.development_id = d.id
  WHERE doc.tenant_id IS NOT NULL AND d.tenant_id IS NOT NULL AND doc.tenant_id != d.tenant_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % documents have tenant_id mismatch with development tenant_id. Sample IDs: %', v_count, v_sample;
  END IF;
  
  -- Check tenant alignment - analytics_events.tenant_id must match developments.tenant_id
  BEGIN
    SELECT COUNT(*), string_agg(ae.id::text, ', ' ORDER BY ae.id LIMIT 5)
    INTO v_count, v_sample
    FROM analytics_events ae
    JOIN developments d ON ae.development_id = d.id
    WHERE ae.tenant_id != d.tenant_id;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'ABORT: % analytics_events have tenant_id mismatch with development tenant_id. Sample IDs: %', v_count, v_sample;
    END IF;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'analytics_events table does not exist - skipping alignment check';
  END;
  
  RAISE NOTICE 'Pre-flight FK and tenant alignment checks passed';
END $$;

-- Now add FK constraints unconditionally (idempotent via IF NOT EXISTS)
ALTER TABLE messages 
  DROP CONSTRAINT IF EXISTS fk_messages_tenant,
  ADD CONSTRAINT fk_messages_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE messages 
  DROP CONSTRAINT IF EXISTS fk_messages_development,
  ADD CONSTRAINT fk_messages_development FOREIGN KEY (development_id) REFERENCES developments(id);

ALTER TABLE units 
  DROP CONSTRAINT IF EXISTS fk_units_tenant,
  ADD CONSTRAINT fk_units_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE units 
  DROP CONSTRAINT IF EXISTS fk_units_development,
  ADD CONSTRAINT fk_units_development FOREIGN KEY (project_id) REFERENCES developments(id);

ALTER TABLE documents 
  DROP CONSTRAINT IF EXISTS fk_documents_tenant,
  ADD CONSTRAINT fk_documents_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE house_types 
  DROP CONSTRAINT IF EXISTS fk_house_types_tenant,
  ADD CONSTRAINT fk_house_types_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- -----------------------------------------------------------------------------
-- 2. TENANT ISOLATION TRIGGER - STRICT VERSION
-- -----------------------------------------------------------------------------

-- This trigger STRICTLY enforces tenant isolation:
-- - If unit_id is provided, tenant_id and development_id MUST match the unit
-- - If unit cannot be found, the insert is REJECTED (not allowed through)
-- - development_id is REQUIRED at the end of validation
-- - If unit_id is NULL, we still require valid tenant_id and development_id

CREATE OR REPLACE FUNCTION validate_message_tenant_isolation()
RETURNS TRIGGER AS $$
DECLARE
  unit_tenant_id UUID;
  unit_dev_id UUID;
BEGIN
  -- tenant_id is always required
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'Message requires tenant_id';
  END IF;
  
  -- If unit_id is provided, STRICTLY validate tenant/development alignment
  IF NEW.unit_id IS NOT NULL THEN
    SELECT tenant_id, project_id INTO unit_tenant_id, unit_dev_id
    FROM units
    WHERE id = NEW.unit_id;
    
    -- Check if unit was found
    IF NOT FOUND THEN
      -- STRICT: Reject messages with invalid unit_id
      RAISE EXCEPTION 'Invalid unit_id: % - unit does not exist', NEW.unit_id;
    END IF;
    
    -- Validate tenant_id matches
    IF NEW.tenant_id != unit_tenant_id THEN
      RAISE EXCEPTION 'Tenant isolation violation: message tenant_id (%) does not match unit tenant_id (%)', 
        NEW.tenant_id, unit_tenant_id;
    END IF;
    
    -- Auto-fill or validate development_id
    IF NEW.development_id IS NULL THEN
      NEW.development_id := unit_dev_id;
    ELSIF NEW.development_id != unit_dev_id THEN
      RAISE EXCEPTION 'Development isolation violation: message development_id (%) does not match unit development_id (%)',
        NEW.development_id, unit_dev_id;
    END IF;
  ELSE
    -- unit_id is NULL - still validate that development belongs to tenant
    IF NEW.development_id IS NOT NULL THEN
      PERFORM 1 FROM developments 
      WHERE id = NEW.development_id AND tenant_id = NEW.tenant_id;
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Development isolation violation: development (%) does not belong to tenant (%)',
          NEW.development_id, NEW.tenant_id;
      END IF;
    END IF;
  END IF;
  
  -- STRICT: development_id must be set after all validation
  IF NEW.development_id IS NULL THEN
    RAISE EXCEPTION 'Message requires development_id - could not determine from unit or caller';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_tenant_isolation_trigger ON messages;
CREATE TRIGGER messages_tenant_isolation_trigger
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION validate_message_tenant_isolation();

-- -----------------------------------------------------------------------------
-- 2b. TENANT ALIGNMENT TRIGGERS FOR UNITS AND HOUSE_TYPES
-- -----------------------------------------------------------------------------
-- These triggers enforce that units/house_types tenant_id matches the parent development's tenant_id

CREATE OR REPLACE FUNCTION validate_unit_tenant_alignment()
RETURNS TRIGGER AS $$
DECLARE
  dev_tenant_id UUID;
BEGIN
  -- tenant_id is required
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'Unit requires tenant_id';
  END IF;
  
  -- project_id (development_id) is required
  IF NEW.project_id IS NULL THEN
    RAISE EXCEPTION 'Unit requires project_id (development_id)';
  END IF;
  
  -- Validate tenant alignment with development
  SELECT tenant_id INTO dev_tenant_id FROM developments WHERE id = NEW.project_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid project_id: % - development does not exist', NEW.project_id;
  END IF;
  
  IF NEW.tenant_id != dev_tenant_id THEN
    RAISE EXCEPTION 'Tenant alignment violation: unit tenant_id (%) does not match development tenant_id (%)',
      NEW.tenant_id, dev_tenant_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS units_tenant_alignment_trigger ON units;
CREATE TRIGGER units_tenant_alignment_trigger
  BEFORE INSERT OR UPDATE ON units
  FOR EACH ROW
  EXECUTE FUNCTION validate_unit_tenant_alignment();

CREATE OR REPLACE FUNCTION validate_house_type_tenant_alignment()
RETURNS TRIGGER AS $$
DECLARE
  dev_tenant_id UUID;
BEGIN
  -- tenant_id is required
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'House type requires tenant_id';
  END IF;
  
  -- development_id is required
  IF NEW.development_id IS NULL THEN
    RAISE EXCEPTION 'House type requires development_id';
  END IF;
  
  -- Validate tenant alignment with development
  SELECT tenant_id INTO dev_tenant_id FROM developments WHERE id = NEW.development_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid development_id: % - development does not exist', NEW.development_id;
  END IF;
  
  IF NEW.tenant_id != dev_tenant_id THEN
    RAISE EXCEPTION 'Tenant alignment violation: house_type tenant_id (%) does not match development tenant_id (%)',
      NEW.tenant_id, dev_tenant_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS house_types_tenant_alignment_trigger ON house_types;
CREATE TRIGGER house_types_tenant_alignment_trigger
  BEFORE INSERT OR UPDATE ON house_types
  FOR EACH ROW
  EXECUTE FUNCTION validate_house_type_tenant_alignment();

-- Trigger for documents tenant alignment
CREATE OR REPLACE FUNCTION validate_document_tenant_alignment()
RETURNS TRIGGER AS $$
DECLARE
  dev_tenant_id UUID;
BEGIN
  -- tenant_id is required
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'Document requires tenant_id';
  END IF;
  
  -- If development_id is provided, validate tenant alignment
  IF NEW.development_id IS NOT NULL THEN
    SELECT tenant_id INTO dev_tenant_id FROM developments WHERE id = NEW.development_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid development_id: % - development does not exist', NEW.development_id;
    END IF;
    
    IF NEW.tenant_id != dev_tenant_id THEN
      RAISE EXCEPTION 'Tenant alignment violation: document tenant_id (%) does not match development tenant_id (%)',
        NEW.tenant_id, dev_tenant_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS documents_tenant_alignment_trigger ON documents;
CREATE TRIGGER documents_tenant_alignment_trigger
  BEFORE INSERT OR UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION validate_document_tenant_alignment();

-- Trigger for analytics_events tenant alignment (may not exist)
DO $$
BEGIN
  EXECUTE $func$
    CREATE OR REPLACE FUNCTION validate_analytics_event_tenant_alignment()
    RETURNS TRIGGER AS $trigger$
    DECLARE
      dev_tenant_id UUID;
    BEGIN
      -- tenant_id is required
      IF NEW.tenant_id IS NULL THEN
        RAISE EXCEPTION 'Analytics event requires tenant_id';
      END IF;
      
      -- development_id is required
      IF NEW.development_id IS NULL THEN
        RAISE EXCEPTION 'Analytics event requires development_id';
      END IF;
      
      -- Validate tenant alignment
      SELECT tenant_id INTO dev_tenant_id FROM developments WHERE id = NEW.development_id;
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid development_id: % - development does not exist', NEW.development_id;
      END IF;
      
      IF NEW.tenant_id != dev_tenant_id THEN
        RAISE EXCEPTION 'Tenant alignment violation: analytics_event tenant_id (%) does not match development tenant_id (%)',
          NEW.tenant_id, dev_tenant_id;
      END IF;
      
      RETURN NEW;
    END;
    $trigger$ LANGUAGE plpgsql;
  $func$;
  
  DROP TRIGGER IF EXISTS analytics_events_tenant_alignment_trigger ON analytics_events;
  CREATE TRIGGER analytics_events_tenant_alignment_trigger
    BEFORE INSERT OR UPDATE ON analytics_events
    FOR EACH ROW
    EXECUTE FUNCTION validate_analytics_event_tenant_alignment();
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'analytics_events table does not exist - skipping trigger creation';
END $$;

-- -----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY POLICIES - TENANT SCOPED
-- -----------------------------------------------------------------------------

-- Enable RLS on tenant-scoped tables
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE developments ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE noticeboard_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE house_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive_folders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate with proper scoping
DROP POLICY IF EXISTS messages_service_role_all ON messages;
DROP POLICY IF EXISTS documents_service_role_all ON documents;
DROP POLICY IF EXISTS developments_service_role_all ON developments;
DROP POLICY IF EXISTS units_service_role_all ON units;
DROP POLICY IF EXISTS noticeboard_service_role_all ON noticeboard_posts;
DROP POLICY IF EXISTS analytics_events_service_role_all ON analytics_events;
DROP POLICY IF EXISTS house_types_service_role_all ON house_types;
DROP POLICY IF EXISTS archive_folders_service_role_all ON archive_folders;

-- SERVICE ROLE: Full access for backend operations
-- These bypass tenant restrictions for server-side operations

CREATE POLICY messages_service_bypass ON messages
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY documents_service_bypass ON documents
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY developments_service_bypass ON developments
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY units_service_bypass ON units
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY noticeboard_service_bypass ON noticeboard_posts
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY analytics_events_service_bypass ON analytics_events
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY house_types_service_bypass ON house_types
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY archive_folders_service_bypass ON archive_folders
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- AUTHENTICATED USERS: Tenant-scoped access with safe defaults
-- Users can only access data matching their tenant claim
-- If tenant_id claim is missing, deny access (safe default)

-- Messages: tenant-scoped read/write
CREATE POLICY messages_authenticated_read ON messages
  FOR SELECT TO authenticated
  USING (
    auth.jwt()->>'tenant_id' IS NOT NULL 
    AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
  );

CREATE POLICY messages_authenticated_write ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.jwt()->>'tenant_id' IS NOT NULL 
    AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
  );

CREATE POLICY messages_authenticated_update ON messages
  FOR UPDATE TO authenticated
  USING (
    auth.jwt()->>'tenant_id' IS NOT NULL 
    AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
  )
  WITH CHECK (
    auth.jwt()->>'tenant_id' IS NOT NULL 
    AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
  );

-- Documents: tenant-scoped read, write requires tenant claim
CREATE POLICY documents_authenticated_read ON documents
  FOR SELECT TO authenticated
  USING (
    auth.jwt()->>'tenant_id' IS NOT NULL 
    AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
  );

CREATE POLICY documents_authenticated_write ON documents
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.jwt()->>'tenant_id' IS NOT NULL 
    AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
  );

-- Developments: read-only for authenticated with tenant claim required
CREATE POLICY developments_authenticated_read ON developments
  FOR SELECT TO authenticated
  USING (
    is_active = true 
    AND auth.jwt()->>'tenant_id' IS NOT NULL 
    AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
  );

-- Units: read-only for authenticated with tenant claim required
CREATE POLICY units_authenticated_read ON units
  FOR SELECT TO authenticated
  USING (
    auth.jwt()->>'tenant_id' IS NOT NULL 
    AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
  );

-- Noticeboard: tenant-scoped with safe default
CREATE POLICY noticeboard_authenticated_read ON noticeboard_posts
  FOR SELECT TO authenticated
  USING (
    auth.jwt()->>'tenant_id' IS NOT NULL 
    AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
  );

CREATE POLICY noticeboard_authenticated_write ON noticeboard_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.jwt()->>'tenant_id' IS NOT NULL 
    AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
  );

-- Analytics events: tenant-scoped
CREATE POLICY analytics_events_authenticated_read ON analytics_events
  FOR SELECT TO authenticated
  USING (
    auth.jwt()->>'tenant_id' IS NOT NULL 
    AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
  );

CREATE POLICY analytics_events_authenticated_write ON analytics_events
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.jwt()->>'tenant_id' IS NOT NULL 
    AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
  );

-- House types: read-only for authenticated with tenant claim required
CREATE POLICY house_types_authenticated_read ON house_types
  FOR SELECT TO authenticated
  USING (
    auth.jwt()->>'tenant_id' IS NOT NULL 
    AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
  );

-- Archive folders: tenant-scoped
CREATE POLICY archive_folders_authenticated_read ON archive_folders
  FOR SELECT TO authenticated
  USING (
    auth.jwt()->>'tenant_id' IS NOT NULL 
    AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
  );

-- -----------------------------------------------------------------------------
-- ANON POLICIES: INTENTIONALLY REMOVED
-- -----------------------------------------------------------------------------
-- Anonymous access to tenant data (developments, units, house_types) is BLOCKED.
-- The purchaser portal QR flow uses the service role via server-side API routes,
-- which bypasses RLS. This ensures:
-- 1. No anonymous enumeration of tenant data
-- 2. QR code lookups go through controlled server endpoints
-- 3. Rate limiting and validation happens at the API layer
--
-- If anon access is truly needed for a specific flow, add a policy that:
-- - Scopes to a specific, validated identifier (e.g., unit_uid from QR)
-- - Uses a function that validates the request context
-- - Never allows full table enumeration
--
-- Example of SAFE anon policy (disabled, for reference):
-- CREATE POLICY units_anon_qr_lookup ON units
--   FOR SELECT TO anon
--   USING (
--     -- Only allow lookup by specific unit_uid, never full enumeration
--     current_setting('request.claims.unit_uid', true) IS NOT NULL
--     AND unit_uid = current_setting('request.claims.unit_uid', true)
--   );
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 4. RECOVERY_MAP TABLE WITH TENANT SCOPING
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS recovery_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  original_data JSONB NOT NULL,
  proposed_fix JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  match_method VARCHAR(100),
  match_confidence DECIMAL(5,2),
  applied_at TIMESTAMP WITH TIME ZONE,
  applied_by VARCHAR(255),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS recovery_map_entity_idx ON recovery_map(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS recovery_map_status_idx ON recovery_map(status);
CREATE INDEX IF NOT EXISTS recovery_map_created_idx ON recovery_map(created_at DESC);
CREATE INDEX IF NOT EXISTS recovery_map_tenant_idx ON recovery_map(tenant_id);

-- Enable RLS on recovery_map
ALTER TABLE recovery_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY recovery_map_service_bypass ON recovery_map
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 5. DEMO_SEED_LOG TABLE
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS demo_seed_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  seed_identifier VARCHAR(255) NOT NULL UNIQUE,
  seed_type VARCHAR(50) NOT NULL,
  seed_data JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'in_progress' NOT NULL,
  created_entities JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS demo_seed_log_identifier_idx ON demo_seed_log(seed_identifier);
CREATE INDEX IF NOT EXISTS demo_seed_log_type_idx ON demo_seed_log(seed_type);
CREATE INDEX IF NOT EXISTS demo_seed_log_tenant_idx ON demo_seed_log(tenant_id);

-- Enable RLS on demo_seed_log
ALTER TABLE demo_seed_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY demo_seed_log_service_bypass ON demo_seed_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 6. TRANSACTIONAL DEVELOPMENT CREATION FUNCTION
-- -----------------------------------------------------------------------------

-- This function creates a development with all related entities in a single transaction
-- If any step fails, the entire operation is rolled back

CREATE OR REPLACE FUNCTION create_development_transactional(
  p_seed_identifier TEXT,
  p_tenant_name TEXT,
  p_tenant_slug TEXT,
  p_dev_code TEXT,
  p_dev_name TEXT,
  p_dev_slug TEXT,
  p_dev_address TEXT DEFAULT NULL,
  p_house_types JSONB DEFAULT '[]'::jsonb,
  p_units JSONB DEFAULT '[]'::jsonb
) RETURNS JSONB AS $$
DECLARE
  v_tenant_id UUID;
  v_dev_id UUID;
  v_ht_id UUID;
  v_unit_id UUID;
  v_ht JSONB;
  v_unit JSONB;
  v_result JSONB;
  v_house_type_ids UUID[] := '{}';
  v_unit_ids UUID[] := '{}';
  v_existing_seed TEXT;
BEGIN
  -- Check idempotency
  SELECT seed_identifier INTO v_existing_seed
  FROM demo_seed_log 
  WHERE seed_identifier = p_seed_identifier AND status = 'completed';
  
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'skipped', 'reason', 'already_completed');
  END IF;
  
  -- Get or create tenant
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = p_tenant_slug;
  IF NOT FOUND THEN
    INSERT INTO tenants (name, slug) VALUES (p_tenant_name, p_tenant_slug)
    RETURNING id INTO v_tenant_id;
  END IF;
  
  -- Get or create development
  SELECT id INTO v_dev_id FROM developments WHERE code = p_dev_code;
  IF NOT FOUND THEN
    INSERT INTO developments (tenant_id, code, name, slug, address, is_active)
    VALUES (v_tenant_id, p_dev_code, p_dev_name, p_dev_slug, p_dev_address, true)
    RETURNING id INTO v_dev_id;
  END IF;
  
  -- Create house types
  FOR v_ht IN SELECT * FROM jsonb_array_elements(p_house_types)
  LOOP
    SELECT id INTO v_ht_id FROM house_types 
    WHERE development_id = v_dev_id AND house_type_code = v_ht->>'code';
    
    IF NOT FOUND THEN
      INSERT INTO house_types (tenant_id, development_id, house_type_code, name, total_floor_area_sqm)
      VALUES (
        v_tenant_id, 
        v_dev_id, 
        v_ht->>'code', 
        v_ht->>'name',
        (v_ht->>'floor_area_sqm')::decimal
      )
      RETURNING id INTO v_ht_id;
    END IF;
    
    v_house_type_ids := array_append(v_house_type_ids, v_ht_id);
  END LOOP;
  
  -- Create units
  FOR v_unit IN SELECT * FROM jsonb_array_elements(p_units)
  LOOP
    DECLARE
      v_unit_uid TEXT := p_dev_code || '-' || LPAD(v_unit->>'unit_number', 3, '0');
    BEGIN
      SELECT id INTO v_unit_id FROM units WHERE unit_uid = v_unit_uid;
      
      IF NOT FOUND THEN
        INSERT INTO units (
          tenant_id, project_id, unit_number, unit_code, unit_uid,
          address, purchaser_name, house_type_code
        )
        VALUES (
          v_tenant_id,
          v_dev_id,
          v_unit->>'unit_number',
          LPAD(v_unit->>'unit_number', 3, '0'),
          v_unit_uid,
          v_unit->>'address_line_1',
          COALESCE(v_unit->>'purchaser_name', 'TBD'),
          v_unit->>'house_type_code'
        )
        RETURNING id INTO v_unit_id;
      END IF;
      
      v_unit_ids := array_append(v_unit_ids, v_unit_id);
    END;
  END LOOP;
  
  -- Log completion
  INSERT INTO demo_seed_log (tenant_id, seed_identifier, seed_type, seed_data, status, created_entities, completed_at)
  VALUES (
    v_tenant_id,
    p_seed_identifier,
    'full_development',
    jsonb_build_object(
      'tenant', jsonb_build_object('name', p_tenant_name, 'slug', p_tenant_slug),
      'development', jsonb_build_object('code', p_dev_code, 'name', p_dev_name)
    ),
    'completed',
    jsonb_build_object(
      'tenant_id', v_tenant_id,
      'development_id', v_dev_id,
      'house_type_ids', v_house_type_ids,
      'unit_ids', v_unit_ids
    ),
    NOW()
  )
  ON CONFLICT (seed_identifier) DO UPDATE SET
    status = 'completed',
    created_entities = EXCLUDED.created_entities,
    completed_at = NOW();
  
  RETURN jsonb_build_object(
    'status', 'created',
    'tenant_id', v_tenant_id,
    'development_id', v_dev_id,
    'house_types_count', array_length(v_house_type_ids, 1),
    'units_count', array_length(v_unit_ids, 1)
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Log failure
  INSERT INTO demo_seed_log (seed_identifier, seed_type, seed_data, status, error_message)
  VALUES (p_seed_identifier, 'full_development', '{}'::jsonb, 'failed', SQLERRM)
  ON CONFLICT (seed_identifier) DO UPDATE SET
    status = 'failed',
    error_message = SQLERRM;
  
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 7. ATOMIC RECOVERY APPLICATION FUNCTION
-- -----------------------------------------------------------------------------

-- This function applies a single recovery fix atomically, updating both the
-- message and the recovery_map audit trail in one transaction.

CREATE OR REPLACE FUNCTION apply_message_recovery(
  p_recovery_id UUID,
  p_applied_by TEXT DEFAULT 'recovery-script'
) RETURNS JSONB AS $$
DECLARE
  v_recovery RECORD;
  v_fix JSONB;
  v_original JSONB;
  v_unit_tenant UUID;
  v_dev_tenant UUID;
  v_update_data JSONB := '{}'::jsonb;
BEGIN
  -- Get the recovery record
  SELECT * INTO v_recovery FROM recovery_map WHERE id = p_recovery_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'skipped', 'reason', 'not_found_or_not_pending');
  END IF;
  
  v_fix := v_recovery.proposed_fix;
  v_original := v_recovery.original_data;
  
  -- Validate tenant consistency at apply time
  IF v_fix->>'unit_id' IS NOT NULL THEN
    SELECT tenant_id INTO v_unit_tenant FROM units WHERE id = (v_fix->>'unit_id')::uuid;
    
    IF NOT FOUND OR v_unit_tenant != (v_original->>'tenant_id')::uuid THEN
      UPDATE recovery_map SET 
        status = 'rejected', 
        error_message = 'Unit tenant mismatch at apply time'
      WHERE id = p_recovery_id;
      
      RETURN jsonb_build_object('status', 'rejected', 'reason', 'unit_tenant_mismatch');
    END IF;
    
    v_update_data := v_update_data || jsonb_build_object('unit_id', v_fix->>'unit_id');
  END IF;
  
  IF v_fix->>'development_id' IS NOT NULL AND v_fix->>'unit_id' IS NULL THEN
    SELECT tenant_id INTO v_dev_tenant FROM developments WHERE id = (v_fix->>'development_id')::uuid;
    
    IF NOT FOUND OR v_dev_tenant != (v_original->>'tenant_id')::uuid THEN
      UPDATE recovery_map SET 
        status = 'rejected', 
        error_message = 'Development tenant mismatch at apply time'
      WHERE id = p_recovery_id;
      
      RETURN jsonb_build_object('status', 'rejected', 'reason', 'development_tenant_mismatch');
    END IF;
    
    v_update_data := v_update_data || jsonb_build_object('development_id', v_fix->>'development_id');
  END IF;
  
  -- Check if we have anything to update
  IF v_update_data = '{}'::jsonb THEN
    UPDATE recovery_map SET 
      status = 'rejected', 
      error_message = 'No valid changes in proposed_fix'
    WHERE id = p_recovery_id;
    
    RETURN jsonb_build_object('status', 'rejected', 'reason', 'no_changes');
  END IF;
  
  -- When both unit_id and development_id are provided, validate they match
  IF v_update_data ? 'unit_id' AND v_fix->>'development_id' IS NOT NULL THEN
    DECLARE
      v_unit_dev_id UUID;
    BEGIN
      SELECT project_id INTO v_unit_dev_id FROM units WHERE id = (v_update_data->>'unit_id')::uuid;
      
      IF v_unit_dev_id != (v_fix->>'development_id')::uuid THEN
        UPDATE recovery_map SET 
          status = 'rejected', 
          error_message = 'Unit development_id does not match proposed development_id'
        WHERE id = p_recovery_id;
        
        RETURN jsonb_build_object('status', 'rejected', 'reason', 'unit_development_mismatch');
      END IF;
    END;
  END IF;
  
  -- Apply the fix to the message
  IF v_update_data ? 'unit_id' AND v_update_data ? 'development_id' THEN
    UPDATE messages SET 
      unit_id = (v_update_data->>'unit_id')::uuid,
      development_id = (v_update_data->>'development_id')::uuid
    WHERE id = v_recovery.entity_id;
  ELSIF v_update_data ? 'unit_id' THEN
    UPDATE messages SET 
      unit_id = (v_update_data->>'unit_id')::uuid
    WHERE id = v_recovery.entity_id;
  ELSIF v_update_data ? 'development_id' THEN
    UPDATE messages SET 
      development_id = (v_update_data->>'development_id')::uuid
    WHERE id = v_recovery.entity_id;
  END IF;
  
  -- Mark recovery as applied
  UPDATE recovery_map SET 
    status = 'applied',
    applied_at = NOW(),
    applied_by = p_applied_by
  WHERE id = p_recovery_id;
  
  RETURN jsonb_build_object('status', 'applied', 'entity_id', v_recovery.entity_id);
  
EXCEPTION WHEN OTHERS THEN
  -- Mark as failed with error
  UPDATE recovery_map SET 
    status = 'failed', 
    error_message = SQLERRM
  WHERE id = p_recovery_id;
  
  RETURN jsonb_build_object('status', 'failed', 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 8. ORPHANED DATA SUMMARY VIEW
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW orphaned_data_summary AS
SELECT 
  'messages' as table_name,
  COUNT(*) FILTER (WHERE unit_id IS NULL AND house_id IS NULL) as orphan_count,
  COUNT(*) as total_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE unit_id IS NULL AND house_id IS NULL) / NULLIF(COUNT(*), 0), 2) as orphan_pct
FROM messages
UNION ALL
SELECT 
  'documents' as table_name,
  COUNT(*) FILTER (WHERE development_id IS NULL) as orphan_count,
  COUNT(*) as total_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE development_id IS NULL) / NULLIF(COUNT(*), 0), 2) as orphan_pct
FROM documents
UNION ALL
SELECT
  'analytics_events' as table_name,
  COUNT(*) FILTER (WHERE development_id IS NULL OR tenant_id IS NULL) as orphan_count,
  COUNT(*) as total_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE development_id IS NULL OR tenant_id IS NULL) / NULLIF(COUNT(*), 0), 2) as orphan_pct
FROM analytics_events;

-- -----------------------------------------------------------------------------
-- 8. ADDITIONAL INDEXES FOR PERFORMANCE
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS documents_tenant_dev_type_idx 
ON documents(tenant_id, development_id, document_type);

CREATE INDEX IF NOT EXISTS analytics_events_tenant_dev_created_idx 
ON analytics_events(tenant_id, development_id, created_at DESC);

CREATE INDEX IF NOT EXISTS units_tenant_dev_unit_uid_idx 
ON units(tenant_id, development_id, unit_uid);

COMMIT;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
