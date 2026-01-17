-- Developer Settings Table
-- Stores key-value settings per tenant for feature configuration

CREATE TABLE IF NOT EXISTS developer_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, key)
);

-- Index for fast lookup by tenant and key
CREATE INDEX IF NOT EXISTS developer_settings_tenant_key_idx ON developer_settings(tenant_id, key);

-- Add RLS policies (optional, can be enabled if using Supabase RLS)
-- ALTER TABLE developer_settings ENABLE ROW LEVEL SECURITY;
