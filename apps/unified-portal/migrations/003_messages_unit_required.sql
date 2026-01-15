-- ============================================================================
-- MIGRATION 003: MESSAGES SAFETY - ENFORCE UNIT_ID NOT NULL + SAFE DELETES
-- ============================================================================
-- Purpose: Every message must belong to a unit. No exceptions.
-- 
-- Guarantees:
-- - messages.unit_id is NOT NULL
-- - FK to units.id with ON DELETE RESTRICT (prevents accidental cascade)
-- - FK to developments.id with ON DELETE RESTRICT
-- - FK to tenants.id with ON DELETE RESTRICT
-- - No orphaned messages possible
-- ============================================================================

-- ============================================================================
-- PRE-FLIGHT CHECK: Detect any messages without unit_id
-- ============================================================================
DO $$
DECLARE
  v_null_count INTEGER;
  v_sample TEXT;
BEGIN
  SELECT COUNT(*), string_agg(id::text, ', ' ORDER BY created_at DESC)
  INTO v_null_count, v_sample
  FROM messages
  WHERE unit_id IS NULL
  LIMIT 10;
  
  IF v_null_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % messages have NULL unit_id. Sample IDs: %. Fix these before applying migration.', 
      v_null_count, COALESCE(v_sample, 'N/A');
  END IF;
  
  RAISE NOTICE 'Pre-flight check passed: No messages with NULL unit_id';
END $$;

-- ============================================================================
-- STEP 1: ADD NOT NULL CONSTRAINT ON unit_id
-- ============================================================================
DO $$
BEGIN
  -- Check if column already has NOT NULL constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' 
    AND column_name = 'unit_id'
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE messages ALTER COLUMN unit_id SET NOT NULL;
    RAISE NOTICE 'Added NOT NULL constraint to messages.unit_id';
  ELSE
    RAISE NOTICE 'messages.unit_id already has NOT NULL constraint';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: ADD/UPDATE FOREIGN KEY CONSTRAINTS WITH RESTRICT
-- ============================================================================

-- Drop existing FK if it exists (to recreate with correct ON DELETE)
ALTER TABLE messages DROP CONSTRAINT IF EXISTS fk_messages_unit;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_unit_id_fkey;

-- Create FK with ON DELETE RESTRICT
ALTER TABLE messages 
  ADD CONSTRAINT fk_messages_unit 
  FOREIGN KEY (unit_id) 
  REFERENCES units(id) 
  ON DELETE RESTRICT;

-- Ensure tenant FK has RESTRICT (recreate if needed)
ALTER TABLE messages DROP CONSTRAINT IF EXISTS fk_messages_tenant;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_tenant_id_fkey;

ALTER TABLE messages 
  ADD CONSTRAINT fk_messages_tenant 
  FOREIGN KEY (tenant_id) 
  REFERENCES tenants(id) 
  ON DELETE RESTRICT;

-- Ensure development FK has RESTRICT (recreate if needed)
ALTER TABLE messages DROP CONSTRAINT IF EXISTS fk_messages_development;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_development_id_fkey;

ALTER TABLE messages 
  ADD CONSTRAINT fk_messages_development 
  FOREIGN KEY (development_id) 
  REFERENCES developments(id) 
  ON DELETE RESTRICT;

-- ============================================================================
-- STEP 3: ADD NOT NULL TO TENANT_ID AND DEVELOPMENT_ID IF NEEDED
-- ============================================================================
DO $$
BEGIN
  -- Add NOT NULL to tenant_id if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' 
    AND column_name = 'tenant_id'
    AND is_nullable = 'YES'
  ) THEN
    -- Verify no nulls first
    IF EXISTS (SELECT 1 FROM messages WHERE tenant_id IS NULL LIMIT 1) THEN
      RAISE EXCEPTION 'Cannot add NOT NULL: messages with NULL tenant_id exist';
    END IF;
    ALTER TABLE messages ALTER COLUMN tenant_id SET NOT NULL;
    RAISE NOTICE 'Added NOT NULL constraint to messages.tenant_id';
  ELSE
    RAISE NOTICE 'messages.tenant_id already has NOT NULL constraint';
  END IF;
  
  -- Add NOT NULL to development_id if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' 
    AND column_name = 'development_id'
    AND is_nullable = 'YES'
  ) THEN
    IF EXISTS (SELECT 1 FROM messages WHERE development_id IS NULL LIMIT 1) THEN
      RAISE EXCEPTION 'Cannot add NOT NULL: messages with NULL development_id exist';
    END IF;
    ALTER TABLE messages ALTER COLUMN development_id SET NOT NULL;
    RAISE NOTICE 'Added NOT NULL constraint to messages.development_id';
  ELSE
    RAISE NOTICE 'messages.development_id already has NOT NULL constraint';
  END IF;
  
  RAISE NOTICE 'Verification passed: All message columns are NOT NULL';
END $$;

-- ============================================================================
-- STEP 4: CREATE INDEX FOR UNIT LOOKUPS
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_messages_unit_id ON messages(unit_id);
CREATE INDEX IF NOT EXISTS idx_messages_unit_tenant ON messages(unit_id, tenant_id);

-- ============================================================================
-- VERIFICATION SUMMARY
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 003: Message safety enforced';
  RAISE NOTICE '  - messages.unit_id: NOT NULL';
  RAISE NOTICE '  - messages.tenant_id: NOT NULL';
  RAISE NOTICE '  - messages.development_id: NOT NULL';
  RAISE NOTICE '  - FK unit_id -> units.id: ON DELETE RESTRICT';
  RAISE NOTICE '  - FK tenant_id -> tenants.id: ON DELETE RESTRICT';
  RAISE NOTICE '  - FK development_id -> developments.id: ON DELETE RESTRICT';
  RAISE NOTICE '  - Delete protection: Active (cannot delete units/tenants/developments with messages)';
END $$;
