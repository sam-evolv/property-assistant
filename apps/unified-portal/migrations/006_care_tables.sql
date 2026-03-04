-- Care tables migration
CREATE TABLE IF NOT EXISTS installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  job_reference TEXT UNIQUE NOT NULL,
  access_code TEXT UNIQUE,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  address_line_1 TEXT,
  city TEXT,
  county TEXT,
  system_type TEXT NOT NULL,
  system_size_kwp DECIMAL,
  system_model TEXT,
  capacity TEXT,
  inverter_model TEXT,
  panel_model TEXT,
  panel_count INTEGER,
  install_date DATE,
  installation_date DATE,
  warranty_expiry DATE,
  health_status TEXT DEFAULT 'healthy',
  portal_status TEXT DEFAULT 'active',
  is_active BOOLEAN DEFAULT true,
  system_specs JSONB DEFAULT '{}',
  component_specs JSONB DEFAULT '{}',
  performance_baseline JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS care_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID REFERENCES installations(id) ON DELETE CASCADE,
  title TEXT,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS care_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES care_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  content TEXT,
  structured_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_installations_access_code ON installations(access_code);
CREATE INDEX IF NOT EXISTS idx_installations_tenant_id ON installations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_care_conversations_installation_id ON care_conversations(installation_id);
CREATE INDEX IF NOT EXISTS idx_care_messages_conversation_id ON care_messages(conversation_id);
ALTER TABLE installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS installations_service_role ON installations TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS care_conversations_service_role ON care_conversations TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS care_messages_service_role ON care_messages TO service_role USING (true) WITH CHECK (true);
