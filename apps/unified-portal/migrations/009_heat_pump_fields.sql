-- Migration: add heat pump fields to installations + create service tables
-- Run in Supabase SQL Editor

-- Heat pump fields on installations
ALTER TABLE installations
  ADD COLUMN IF NOT EXISTS system_category TEXT DEFAULT 'solar',
  ADD COLUMN IF NOT EXISTS heat_pump_model TEXT,
  ADD COLUMN IF NOT EXISTS heat_pump_serial TEXT,
  ADD COLUMN IF NOT EXISTS heat_pump_cop NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS flow_temp_current INTEGER,
  ADD COLUMN IF NOT EXISTS zones_total INTEGER,
  ADD COLUMN IF NOT EXISTS zones_active INTEGER,
  ADD COLUMN IF NOT EXISTS hot_water_cylinder_model TEXT,
  ADD COLUMN IF NOT EXISTS hot_water_temp_current INTEGER,
  ADD COLUMN IF NOT EXISTS controls_model TEXT,
  ADD COLUMN IF NOT EXISTS controls_issue TEXT,
  ADD COLUMN IF NOT EXISTS last_service_date DATE,
  ADD COLUMN IF NOT EXISTS next_service_due DATE,
  ADD COLUMN IF NOT EXISTS warranty_years INTEGER,
  ADD COLUMN IF NOT EXISTS annual_service_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS seai_grant_amount INTEGER,
  ADD COLUMN IF NOT EXISTS seai_grant_status TEXT,
  ADD COLUMN IF NOT EXISTS seai_grant_ref TEXT,
  ADD COLUMN IF NOT EXISTS seai_application_date DATE,
  ADD COLUMN IF NOT EXISTS ber_rating TEXT,
  ADD COLUMN IF NOT EXISTS active_safety_alerts JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS indoor_temp_current NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS indoor_temp_target NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS daily_running_cost_cents INTEGER,
  ADD COLUMN IF NOT EXISTS co2_saved_today_grams INTEGER,
  ADD COLUMN IF NOT EXISTS monthly_running_cost_cents INTEGER,
  ADD COLUMN IF NOT EXISTS monthly_budget_cents INTEGER,
  ADD COLUMN IF NOT EXISTS installer_name TEXT,
  ADD COLUMN IF NOT EXISTS installer_contact JSONB;

-- Service records table
CREATE TABLE IF NOT EXISTS service_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID REFERENCES installations(id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  service_type TEXT NOT NULL,
  engineer_name TEXT,
  company TEXT,
  outcome TEXT,
  notes TEXT,
  report_url TEXT,
  warranty_validated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE service_records ENABLE ROW LEVEL SECURITY;

-- Safety alerts table
CREATE TABLE IF NOT EXISTS safety_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID REFERENCES installations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT NOT NULL,
  action_label TEXT,
  action_url TEXT,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE safety_alerts ENABLE ROW LEVEL SECURITY;

-- Service bookings table
CREATE TABLE IF NOT EXISTS service_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID REFERENCES installations(id) ON DELETE CASCADE,
  requested_slot TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE service_bookings ENABLE ROW LEVEL SECURITY;
