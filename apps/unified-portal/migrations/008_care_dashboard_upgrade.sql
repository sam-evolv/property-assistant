-- Care dashboard upgrade: add missing columns and tables for SE Systems demo
-- Run in Supabase SQL Editor

-- Add missing columns to installations
ALTER TABLE installations
  ADD COLUMN IF NOT EXISTS energy_generated_kwh INTEGER,
  ADD COLUMN IF NOT EXISTS savings_eur INTEGER;

-- Support queries table
CREATE TABLE IF NOT EXISTS support_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  installation_id UUID REFERENCES installations(id) ON DELETE CASCADE,
  customer_ref TEXT NOT NULL,
  address TEXT,
  query_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_queries_tenant ON support_queries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_queries_installation ON support_queries(installation_id);
CREATE INDEX IF NOT EXISTS idx_support_queries_status ON support_queries(status);

ALTER TABLE support_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS support_queries_service_role ON support_queries TO service_role USING (true) WITH CHECK (true);

-- Diagnostic flows table
CREATE TABLE IF NOT EXISTS diagnostic_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  flow_name TEXT NOT NULL,
  system_type TEXT NOT NULL,
  step_count INTEGER DEFAULT 0,
  times_triggered INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_flows_tenant ON diagnostic_flows(tenant_id);

ALTER TABLE diagnostic_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS diagnostic_flows_service_role ON diagnostic_flows TO service_role USING (true) WITH CHECK (true);
