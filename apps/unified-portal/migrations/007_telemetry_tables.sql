-- Installation telemetry (time-series readings)
CREATE TABLE IF NOT EXISTS installation_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID REFERENCES installations(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Solar
  generation_kwh DECIMAL,
  export_kwh DECIMAL,
  self_consumption_pct DECIMAL,
  irradiance_wm2 DECIMAL,
  -- Heat pump
  cop DECIMAL,
  flow_temp_c DECIMAL,
  return_temp_c DECIMAL,
  heat_output_kwh DECIMAL,
  -- General
  power_w DECIMAL,
  voltage_v DECIMAL,
  status TEXT DEFAULT 'ok',
  raw_data JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_telemetry_installation_id ON installation_telemetry(installation_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_recorded_at ON installation_telemetry(recorded_at DESC);

-- Installation alerts
CREATE TABLE IF NOT EXISTS installation_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID REFERENCES installations(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'fault', 'warning', 'info'
  code TEXT,
  message TEXT NOT NULL,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_installation_id ON installation_alerts(installation_id);
CREATE INDEX IF NOT EXISTS idx_alerts_unresolved ON installation_alerts(installation_id) WHERE resolved = false;

ALTER TABLE installation_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE installation_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS telemetry_service_role ON installation_telemetry TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS alerts_service_role ON installation_alerts TO service_role USING (true) WITH CHECK (true);

-- Add telemetry credential fields to installations
ALTER TABLE installations
  ADD COLUMN IF NOT EXISTS telemetry_source TEXT, -- 'solarEdge', 'fronius', 'mock', null
  ADD COLUMN IF NOT EXISTS serial_number TEXT,
  ADD COLUMN IF NOT EXISTS telemetry_api_key TEXT,
  ADD COLUMN IF NOT EXISTS last_telemetry_at TIMESTAMPTZ;
