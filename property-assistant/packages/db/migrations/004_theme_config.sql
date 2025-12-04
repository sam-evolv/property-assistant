-- Create theme_config table
CREATE TABLE IF NOT EXISTS theme_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  primary_color VARCHAR(7) NOT NULL DEFAULT '#3b82f6',
  secondary_color VARCHAR(7) DEFAULT '#8b5cf6',
  accent_color VARCHAR(7) DEFAULT '#06b6d4',
  logo_url TEXT,
  dark_mode BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index on tenant_id
CREATE INDEX IF NOT EXISTS theme_config_tenant_idx ON theme_config(tenant_id);

-- Add RLS policies
ALTER TABLE theme_config ENABLE ROW LEVEL SECURITY;

-- Policy: Tenants can read their own theme config
CREATE POLICY "tenant_read_own_theme" ON theme_config
  FOR SELECT
  USING (
    tenant_id::text = COALESCE(
      (current_setting('request.jwt.claims', true)::json->>'tenant_id'),
      ''
    )
    OR
    (current_setting('request.jwt.claims', true)::json->>'role') = 'super_admin'
  );

-- Policy: Tenants can update their own theme config
CREATE POLICY "tenant_update_own_theme" ON theme_config
  FOR UPDATE
  USING (
    tenant_id::text = COALESCE(
      (current_setting('request.jwt.claims', true)::json->>'tenant_id'),
      ''
    )
    OR
    (current_setting('request.jwt.claims', true)::json->>'role') = 'super_admin'
  );

-- Policy: Tenants can insert their own theme config
CREATE POLICY "tenant_insert_own_theme" ON theme_config
  FOR INSERT
  WITH CHECK (
    tenant_id::text = COALESCE(
      (current_setting('request.jwt.claims', true)::json->>'tenant_id'),
      ''
    )
    OR
    (current_setting('request.jwt.claims', true)::json->>'role') = 'super_admin'
  );

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_theme_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS theme_config_updated_at ON theme_config;
CREATE TRIGGER theme_config_updated_at
  BEFORE UPDATE ON theme_config
  FOR EACH ROW
  EXECUTE FUNCTION update_theme_config_updated_at();

-- Insert default theme configs for existing tenants
INSERT INTO theme_config (tenant_id, primary_color, secondary_color, accent_color, dark_mode)
SELECT id, '#3b82f6', '#8b5cf6', '#06b6d4', false
FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;
