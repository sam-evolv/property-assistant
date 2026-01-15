-- ============================================================================
-- MIGRATION 002: AUDIT EVENTS - APPEND-ONLY AUDIT LOG
-- ============================================================================
-- Purpose: Enterprise-grade audit logging for all tenant-scoped mutations
-- 
-- Features:
-- - Append-only (no UPDATE/DELETE allowed)
-- - Tracks actor, tenant, table, operation, before/after states
-- - Immutable audit trail for compliance and forensics
-- ============================================================================

-- Create audit_events table
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who performed the action
  actor TEXT NOT NULL DEFAULT 'system',
  actor_type TEXT NOT NULL DEFAULT 'service_role' CHECK (actor_type IN ('service_role', 'admin', 'user', 'system', 'automation')),
  
  -- Tenant context
  tenant_id UUID REFERENCES tenants(id),
  
  -- What was affected
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  record_id TEXT NOT NULL,
  
  -- State capture (JSONB for flexibility)
  before_state JSONB,
  after_state JSONB,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_id TEXT,
  ip_address INET,
  user_agent TEXT
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_id ON audit_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_table_name ON audit_events(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor);
CREATE INDEX IF NOT EXISTS idx_audit_events_operation ON audit_events(operation);
CREATE INDEX IF NOT EXISTS idx_audit_events_record_id ON audit_events(record_id);

-- Composite index for common audit queries
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_table_time 
  ON audit_events(tenant_id, table_name, created_at DESC);

-- ============================================================================
-- APPEND-ONLY ENFORCEMENT
-- ============================================================================
-- Block all UPDATE operations on audit_events
CREATE OR REPLACE FUNCTION prevent_audit_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'SECURITY VIOLATION: audit_events table is append-only. UPDATE operations are prohibited.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_events_no_update ON audit_events;
CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_update();

-- Block all DELETE operations on audit_events
CREATE OR REPLACE FUNCTION prevent_audit_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'SECURITY VIOLATION: audit_events table is append-only. DELETE operations are prohibited.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_events_no_delete ON audit_events;
CREATE TRIGGER audit_events_no_delete
  BEFORE DELETE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_delete();

-- ============================================================================
-- HELPER FUNCTION FOR LOGGING
-- ============================================================================
CREATE OR REPLACE FUNCTION log_audit_event(
  p_actor TEXT,
  p_actor_type TEXT,
  p_tenant_id UUID,
  p_table_name TEXT,
  p_operation TEXT,
  p_record_id TEXT,
  p_before_state JSONB DEFAULT NULL,
  p_after_state JSONB DEFAULT NULL,
  p_request_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO audit_events (
    actor,
    actor_type,
    tenant_id,
    table_name,
    operation,
    record_id,
    before_state,
    after_state,
    request_id
  ) VALUES (
    p_actor,
    p_actor_type,
    p_tenant_id,
    p_table_name,
    p_operation,
    p_record_id,
    p_before_state,
    p_after_state,
    p_request_id
  ) RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RLS FOR AUDIT_EVENTS (Service role only)
-- ============================================================================
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Only service role can insert (for backend logging)
CREATE POLICY audit_events_service_insert ON audit_events
  FOR INSERT TO service_role
  USING (true) WITH CHECK (true);

-- Only service role can read (for admin dashboards)
CREATE POLICY audit_events_service_select ON audit_events
  FOR SELECT TO service_role
  USING (true);

-- No authenticated user access to audit logs directly
-- Admin access should be via backend APIs with proper authorization

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 002: audit_events table created with append-only enforcement';
  RAISE NOTICE '  - UPDATE trigger: active (will block all updates)';
  RAISE NOTICE '  - DELETE trigger: active (will block all deletes)';
  RAISE NOTICE '  - RLS: enabled (service_role only)';
  RAISE NOTICE '  - Helper function: log_audit_event() available';
END $$;
