-- ============================================
-- Care Installations Schema
-- Supports solar, heat pump, HVAC, EV chargers
-- ============================================

-- installations table: core system record
CREATE TABLE IF NOT EXISTS installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  development_id UUID REFERENCES developments(id) ON DELETE SET NULL,
  
  -- System identification
  system_type TEXT NOT NULL CHECK (system_type IN ('solar', 'heat_pump', 'hvac', 'ev_charger')),
  system_model TEXT NOT NULL,           -- "SolarEdge SE6000H"
  capacity TEXT,                        -- "6.6 kWp", "15 kW heat pump", etc.
  serial_number TEXT UNIQUE,            -- Inverter/system serial
  
  -- Installation metadata
  installer_id UUID,
  homeowner_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  installation_date DATE NOT NULL,
  warranty_expiry DATE,
  
  -- Performance data integration
  telemetry_source TEXT,                -- 'solarEdge', 'fronius', 'mock'
  telemetry_api_key TEXT,               -- Encrypted API key if needed
  
  -- Specifications (JSONB for flexibility)
  component_specs JSONB DEFAULT '{}',   -- {inverter: {...}, panels: {...}, etc.}
  performance_baseline JSONB DEFAULT '{}', -- {daily_avg_kWh: 22, monthly_avg: 660, etc.}
  
  -- QR & onboarding
  qr_code TEXT UNIQUE,                  -- QR code identifier
  homeowner_email TEXT,
  handover_date TIMESTAMPTZ,            -- When customer received keys
  adoption_status TEXT DEFAULT 'pending' CHECK (adoption_status IN ('pending', 'adopted', 'active')),
  adopted_at TIMESTAMPTZ,               -- When homeowner first opened app
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_installations_tenant ON installations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_installations_development ON installations(development_id);
CREATE INDEX IF NOT EXISTS idx_installations_system_type ON installations(system_type);
CREATE INDEX IF NOT EXISTS idx_installations_homeowner ON installations(homeowner_id);
CREATE INDEX IF NOT EXISTS idx_installations_qr ON installations(qr_code);
CREATE INDEX IF NOT EXISTS idx_installations_adoption ON installations(adoption_status);

-- installation_telemetry: time-series performance data
CREATE TABLE IF NOT EXISTS installation_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
  
  -- Metrics (system-type specific)
  generation_kwh NUMERIC(10, 2),        -- Solar only
  consumption_kwh NUMERIC(10, 2),       -- Heat pump / general
  self_consumption_pct NUMERIC(5, 2),   -- Solar only
  cop NUMERIC(4, 2),                    -- Heat pump COP (>3 is good)
  flow_temp_c NUMERIC(5, 1),            -- Heat pump flow temperature
  return_temp_c NUMERIC(5, 1),          -- Heat pump return temp
  inverter_status TEXT,                 -- "OK", "ERROR_F32", etc.
  
  -- Context
  weather_status TEXT,                  -- "sunny", "cloudy", "rainy"
  outdoor_temp_c NUMERIC(5, 1),
  
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_installation ON installation_telemetry(installation_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_recorded ON installation_telemetry(installation_id, recorded_at DESC);

-- installation_alerts: issues/warnings
CREATE TABLE IF NOT EXISTS installation_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
  
  alert_type TEXT NOT NULL,             -- 'error', 'warning', 'info'
  title TEXT NOT NULL,
  description TEXT,
  error_code TEXT,                      -- "F32", "ERR_COMM_LOST", etc.
  
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  requires_technician BOOLEAN DEFAULT false,
  
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_installation ON installation_alerts(installation_id);
CREATE INDEX IF NOT EXISTS idx_alerts_unresolved ON installation_alerts(installation_id, resolved_at) WHERE resolved_at IS NULL;

-- RLS
ALTER TABLE installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE installation_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE installation_alerts ENABLE ROW LEVEL SECURITY;

-- Grants for service role (API use)
GRANT ALL ON installations TO service_role;
GRANT ALL ON installation_telemetry TO service_role;
GRANT ALL ON installation_alerts TO service_role;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_installations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_installations_updated_at ON installations;
CREATE TRIGGER update_installations_updated_at
    BEFORE UPDATE ON installations
    FOR EACH ROW
    EXECUTE FUNCTION update_installations_updated_at();
