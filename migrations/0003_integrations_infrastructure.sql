-- ============================================
-- OpenHouse AI Integration Infrastructure
-- Migration: 0003_integrations_infrastructure
-- Date: 2026-02-24
-- ============================================

-- 1. Master table for all integration connections
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  development_id UUID REFERENCES developments(id) ON DELETE CASCADE,

  type TEXT NOT NULL CHECK (type IN (
    'excel_onedrive', 'excel_sharepoint', 'google_sheets',
    'dynamics_365', 'salesforce', 'hubspot', 'property_crm_ireland',
    'api_key', 'webhook', 'custom'
  )),

  name TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'connected', 'syncing', 'error', 'paused', 'disconnected'
  )),

  credentials JSONB DEFAULT '{}',

  sync_direction TEXT NOT NULL DEFAULT 'bidirectional' CHECK (sync_direction IN (
    'inbound', 'outbound', 'bidirectional'
  )),
  sync_frequency TEXT NOT NULL DEFAULT 'realtime' CHECK (sync_frequency IN (
    'realtime', 'hourly', 'daily', 'manual'
  )),

  external_ref TEXT,

  last_error TEXT,
  last_error_at TIMESTAMPTZ,

  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- RLS policies use the admins table to resolve tenant ownership.
-- All API routes use service_role client which bypasses RLS, but these
-- policies provide defense-in-depth for any non-admin client access.
CREATE POLICY "Tenant can manage own integrations"
  ON integrations FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM admins WHERE email = auth.jwt()->>'email'))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM admins WHERE email = auth.jwt()->>'email'));

CREATE INDEX IF NOT EXISTS idx_integrations_tenant ON integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integrations_development ON integrations(development_id);
CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(type);

-- 2. Field mapping between external system and OpenHouse
CREATE TABLE IF NOT EXISTS integration_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,

  external_field TEXT NOT NULL,
  external_field_label TEXT,

  oh_table TEXT NOT NULL,
  oh_field TEXT NOT NULL,

  direction TEXT NOT NULL DEFAULT 'bidirectional' CHECK (direction IN (
    'inbound', 'outbound', 'bidirectional'
  )),

  transform_rule JSONB,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE integration_field_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access via integration ownership"
  ON integration_field_mappings FOR ALL
  USING (
    integration_id IN (
      SELECT id FROM integrations WHERE tenant_id IN (
        SELECT tenant_id FROM admins WHERE email = auth.jwt()->>'email'
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_field_mappings_integration ON integration_field_mappings(integration_id);

-- 3. Sync log for monitoring and debugging
CREATE TABLE IF NOT EXISTS integration_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,

  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'manual')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'partial')),

  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  records_errored INTEGER DEFAULT 0,

  conflicts JSONB DEFAULT '[]',

  error_message TEXT,
  error_details JSONB,

  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER
);

ALTER TABLE integration_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access via integration ownership"
  ON integration_sync_log FOR ALL
  USING (
    integration_id IN (
      SELECT id FROM integrations WHERE tenant_id IN (
        SELECT tenant_id FROM admins WHERE email = auth.jwt()->>'email'
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_sync_log_integration ON integration_sync_log(integration_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_started ON integration_sync_log(started_at DESC);

-- 4. Sync conflicts for user resolution
CREATE TABLE IF NOT EXISTS integration_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  sync_log_id UUID REFERENCES integration_sync_log(id),

  oh_table TEXT NOT NULL,
  oh_record_id UUID NOT NULL,
  oh_field TEXT NOT NULL,

  local_value TEXT,
  remote_value TEXT,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved_local', 'resolved_remote', 'ignored')),
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE integration_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access via integration ownership"
  ON integration_conflicts FOR ALL
  USING (
    integration_id IN (
      SELECT id FROM integrations WHERE tenant_id IN (
        SELECT tenant_id FROM admins WHERE email = auth.jwt()->>'email'
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_conflicts_integration ON integration_conflicts(integration_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_status ON integration_conflicts(status) WHERE status = 'pending';

-- 5. API keys for Open API access
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,

  scopes TEXT[] NOT NULL DEFAULT ARRAY['read'],
  allowed_developments UUID[],

  rate_limit_per_minute INTEGER DEFAULT 60,

  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can manage own API keys"
  ON api_keys FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM admins WHERE email = auth.jwt()->>'email'))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM admins WHERE email = auth.jwt()->>'email'));

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- 6. Webhook subscriptions
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  url TEXT NOT NULL,
  secret TEXT NOT NULL,

  events TEXT[] NOT NULL,

  development_ids UUID[],

  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  consecutive_failures INTEGER DEFAULT 0,
  last_failure_reason TEXT,

  max_failures INTEGER DEFAULT 10,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can manage own webhooks"
  ON webhooks FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM admins WHERE email = auth.jwt()->>'email'))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM admins WHERE email = auth.jwt()->>'email'));

-- 7. Webhook delivery log
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,

  status TEXT NOT NULL CHECK (status IN ('pending', 'delivered', 'failed')),
  http_status INTEGER,
  response_body TEXT,

  attempt_number INTEGER DEFAULT 1,
  next_retry_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access via webhook ownership"
  ON webhook_deliveries FOR ALL
  USING (
    webhook_id IN (
      SELECT id FROM webhooks WHERE tenant_id IN (
        SELECT tenant_id FROM admins WHERE email = auth.jwt()->>'email'
      )
    )
  );

CREATE POLICY "System can manage deliveries"
  ON webhook_deliveries FOR ALL
  USING (current_setting('role', true) = 'service_role');

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending ON webhook_deliveries(status, next_retry_at)
  WHERE status = 'pending';

-- 8. Comprehensive audit trail for integration activity
CREATE TABLE IF NOT EXISTS integration_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  action TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'api_key', 'webhook')),
  actor_id TEXT,

  resource_type TEXT,
  resource_id TEXT,

  metadata JSONB DEFAULT '{}',
  ip_address TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE integration_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can view own audit logs"
  ON integration_audit_log FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM admins WHERE email = auth.jwt()->>'email'));

CREATE POLICY "System can insert audit logs"
  ON integration_audit_log FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_integration_audit_log_tenant ON integration_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_audit_log_action ON integration_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_integration_audit_log_created ON integration_audit_log(created_at DESC);
