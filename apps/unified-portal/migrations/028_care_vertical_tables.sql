-- ============================================================
-- OpenHouse Care Vertical — Database Schema
-- Migration 028: Care tables for installer dashboard + customer app
-- ============================================================

-- 1. Add tenant_type to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tenant_type TEXT DEFAULT 'developer';
-- Valid values: 'developer', 'installer', 'mixed'

-- ============================================================
-- 2. INSTALLATIONS — Core record for every installer job
-- ============================================================
CREATE TABLE IF NOT EXISTS installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  job_reference TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  city TEXT NOT NULL,
  county TEXT,
  eircode TEXT,
  system_type TEXT NOT NULL DEFAULT 'solar_pv',
  system_size_kwp DECIMAL(5,2),
  inverter_model TEXT,
  panel_model TEXT,
  panel_count INTEGER,
  system_specs JSONB DEFAULT '{}',
  install_date DATE NOT NULL,
  warranty_expiry DATE,
  portal_status TEXT DEFAULT 'pending',
  portal_activated_at TIMESTAMPTZ,
  health_status TEXT DEFAULT 'healthy',
  source TEXT DEFAULT 'private',
  unit_id UUID REFERENCES units(id),
  region TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_installations_tenant ON installations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_installations_health ON installations(tenant_id, health_status);
CREATE INDEX IF NOT EXISTS idx_installations_region ON installations(tenant_id, region);
CREATE INDEX IF NOT EXISTS idx_installations_portal ON installations(tenant_id, portal_status);

-- ============================================================
-- 3. ESCALATIONS — Unresolved queries needing technician attention
-- ============================================================
CREATE TABLE IF NOT EXISTS escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID REFERENCES installations(id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  support_query_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  diagnostic_context JSONB DEFAULT '{}',
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',
  assigned_to TEXT,
  assigned_at TIMESTAMPTZ,
  scheduled_date DATE,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escalations_tenant_status ON escalations(tenant_id, status);

-- ============================================================
-- 4. SUPPORT_QUERIES — Every question asked through the Care app
-- ============================================================
CREATE TABLE IF NOT EXISTS support_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID REFERENCES installations(id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  query_text TEXT NOT NULL,
  ai_response TEXT,
  response_source TEXT DEFAULT 'ai',
  resolved BOOLEAN DEFAULT true,
  escalated BOOLEAN DEFAULT false,
  escalation_id UUID REFERENCES escalations(id),
  query_category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_queries_tenant ON support_queries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_queries_installation ON support_queries(installation_id);
CREATE INDEX IF NOT EXISTS idx_support_queries_created ON support_queries(tenant_id, created_at DESC);

-- Add FK from escalations to support_queries now that both tables exist
ALTER TABLE escalations
  ADD CONSTRAINT fk_escalations_support_query
  FOREIGN KEY (support_query_id) REFERENCES support_queries(id);

-- ============================================================
-- 5. DIAGNOSTIC_FLOWS — Configurable step-by-step diagnostic trees
-- ============================================================
CREATE TABLE IF NOT EXISTS diagnostic_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  colour TEXT DEFAULT 'red',
  system_type TEXT DEFAULT 'solar_pv',
  status TEXT DEFAULT 'draft',
  steps JSONB NOT NULL DEFAULT '[]',
  stats_started INTEGER DEFAULT 0,
  stats_resolved INTEGER DEFAULT 0,
  stats_escalated INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 6. DIAGNOSTIC_COMPLETIONS — Tracks customer journeys through flows
-- ============================================================
CREATE TABLE IF NOT EXISTS diagnostic_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_flow_id UUID REFERENCES diagnostic_flows(id) NOT NULL,
  installation_id UUID REFERENCES installations(id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  steps_completed JSONB DEFAULT '[]',
  outcome TEXT NOT NULL,
  completed_at_step INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 7. INSTALLER_CONTENT — Guides, videos, documents
-- ============================================================
CREATE TABLE IF NOT EXISTS installer_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL,
  category TEXT,
  system_type TEXT DEFAULT 'solar_pv',
  brand TEXT,
  model TEXT,
  file_url TEXT,
  status TEXT DEFAULT 'live',
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 8. ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all Care tables
ALTER TABLE installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE installer_content ENABLE ROW LEVEL SECURITY;

-- Service role (used by Next.js server) can access everything
CREATE POLICY "service_role_installations" ON installations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_support_queries" ON support_queries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_escalations" ON escalations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_diagnostic_flows" ON diagnostic_flows FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_diagnostic_completions" ON diagnostic_completions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_installer_content" ON installer_content FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 9. SE SYSTEMS DEMO DATA
-- ============================================================

-- Insert SE Systems tenant (installer type)
INSERT INTO tenants (id, name, slug, tenant_type, description, theme_color, brand, contact)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'SE Systems',
  'se-systems',
  'installer',
  'Solar PV installation and maintenance company based in Cork, Ireland',
  '#D4AF37',
  '{"primary_color": "#D4AF37", "region": "Cork, Ireland"}',
  '{"phone": "+353 21 123 4567", "email": "info@sesystems.ie", "address": "Unit 5, Cork Business Park, Cork"}'
)
ON CONFLICT (slug) DO UPDATE SET tenant_type = 'installer';

-- Store tenant ID for reuse
DO $$
DECLARE
  se_tenant_id UUID;
  inst_1 UUID; inst_2 UUID; inst_3 UUID; inst_4 UUID; inst_5 UUID;
  inst_6 UUID; inst_7 UUID; inst_8 UUID; inst_9 UUID; inst_10 UUID;
  esc_1 UUID; esc_2 UUID; esc_3 UUID;
  sq_1 UUID; sq_2 UUID; sq_3 UUID;
  df_1 UUID; df_2 UUID; df_3 UUID; df_4 UUID; df_5 UUID;
BEGIN
  SELECT id INTO se_tenant_id FROM tenants WHERE slug = 'se-systems';

  -- Generate UUIDs for installations
  inst_1 := gen_random_uuid();
  inst_2 := gen_random_uuid();
  inst_3 := gen_random_uuid();
  inst_4 := gen_random_uuid();
  inst_5 := gen_random_uuid();
  inst_6 := gen_random_uuid();
  inst_7 := gen_random_uuid();
  inst_8 := gen_random_uuid();
  inst_9 := gen_random_uuid();
  inst_10 := gen_random_uuid();

  -- ============================================================
  -- INSTALLATIONS (10 records)
  -- ============================================================

  INSERT INTO installations (id, tenant_id, job_reference, customer_name, customer_email, customer_phone, address_line_1, city, county, system_type, system_size_kwp, inverter_model, panel_model, panel_count, install_date, warranty_expiry, portal_status, health_status, source, region, system_specs)
  VALUES
    (inst_1, se_tenant_id, 'SE-2026-0341', 'Eoghan McCarthy', 'eoghan.mccarthy@email.ie', '+353 87 123 4567', 'Unit 14, Longview Park, Ballincollig', 'Cork', 'Cork', 'solar_pv', 4.10, 'SolarEdge SE3680H', 'JA Solar 410W', 10, '2026-02-27', '2036-02-27', 'pending', 'healthy', 'development', 'cork_city',
     '{"battery": "none", "optimizer_count": 10, "roof_orientation": "south", "panel_warranty_years": 25, "inverter_warranty_years": 12, "workmanship_warranty_years": 10}'),

    (inst_2, se_tenant_id, 'SE-2026-0329', 'Colm Fitzgerald', 'colm.fitzgerald@email.ie', '+353 86 234 5678', '19 Ash Close, Midleton', 'Midleton', 'Cork', 'solar_pv', 3.28, 'SolarEdge SE3000H', 'JA Solar 410W', 8, '2026-02-05', '2036-02-05', 'active', 'healthy', 'private', 'cork_county',
     '{"battery": "none", "optimizer_count": 8, "roof_orientation": "south-east", "panel_warranty_years": 25, "inverter_warranty_years": 12, "workmanship_warranty_years": 10}'),

    (inst_3, se_tenant_id, 'SE-2026-0318', 'Niamh O''Callaghan', 'niamh.ocallaghan@email.ie', '+353 85 345 6789', '5 Willow Heights, Cobh', 'Cobh', 'Cork', 'solar_pv', 4.92, 'Fronius Primo 5.0', 'Trina Solar 410W', 12, '2026-01-18', '2036-01-18', 'active', 'healthy', 'private', 'cork_county',
     '{"battery": "none", "optimizer_count": 0, "roof_orientation": "south-west", "panel_warranty_years": 25, "inverter_warranty_years": 10, "workmanship_warranty_years": 10}'),

    (inst_4, se_tenant_id, 'SE-2026-0312', 'Mary Murphy', 'mary.murphy@email.ie', '+353 87 456 7890', '12 Meadow Drive, Ballincollig', 'Cork', 'Cork', 'solar_pv', 3.69, 'SolarEdge SE3680H', 'JA Solar 410W', 9, '2026-01-14', '2036-01-14', 'active', 'healthy', 'private', 'cork_city',
     '{"battery": "SolarEdge Home Battery 4.6kWh", "optimizer_count": 9, "roof_orientation": "south", "panel_warranty_years": 25, "inverter_warranty_years": 12, "workmanship_warranty_years": 10}'),

    (inst_5, se_tenant_id, 'SE-2025-1247', 'Pádraig O''Sullivan', 'padraig.osullivan@email.ie', '+353 86 567 8901', '8 Oak Grove, Bishopstown', 'Cork', 'Cork', 'solar_pv', 4.10, 'Huawei SUN2000-4KTL', 'Longi Hi-MO5 410W', 10, '2025-12-03', '2035-12-03', 'active', 'healthy', 'private', 'cork_city',
     '{"battery": "Huawei LUNA2000-5kWh", "optimizer_count": 0, "roof_orientation": "south", "panel_warranty_years": 25, "inverter_warranty_years": 10, "workmanship_warranty_years": 10}'),

    (inst_6, se_tenant_id, 'SE-2025-1198', 'Siobhán Kelleher', 'siobhan.kelleher@email.ie', '+353 85 678 9012', '3 Riverside Walk, Ballincollig', 'Cork', 'Cork', 'solar_pv', 3.69, 'SolarEdge SE3680H', 'JA Solar 410W', 9, '2025-11-14', '2035-11-14', 'active', 'issue', 'development', 'cork_city',
     '{"battery": "none", "optimizer_count": 9, "roof_orientation": "south-east", "panel_warranty_years": 25, "inverter_warranty_years": 12, "workmanship_warranty_years": 10}'),

    (inst_7, se_tenant_id, 'SE-2025-1142', 'Dermot Crowley', 'dermot.crowley@email.ie', '+353 87 789 0123', '22 Hazel Park, Carrigaline', 'Carrigaline', 'Cork', 'solar_pv', 5.74, 'SolarEdge SE5000H', 'JA Solar 410W', 14, '2025-10-08', '2035-10-08', 'active', 'issue', 'private', 'cork_county',
     '{"battery": "SolarEdge Home Battery 9.7kWh", "optimizer_count": 14, "roof_orientation": "south", "panel_warranty_years": 25, "inverter_warranty_years": 12, "workmanship_warranty_years": 10}'),

    (inst_8, se_tenant_id, 'SE-2025-1089', 'Aoife Brennan', 'aoife.brennan@email.ie', '+353 86 890 1234', '7 Birch Lane, Douglas', 'Cork', 'Cork', 'solar_pv', 4.10, 'SolarEdge SE3680H', 'JA Solar 410W', 10, '2025-09-22', '2035-09-22', 'active', 'monitoring', 'private', 'cork_city',
     '{"battery": "none", "optimizer_count": 10, "roof_orientation": "south-west", "panel_warranty_years": 25, "inverter_warranty_years": 12, "workmanship_warranty_years": 10}'),

    (inst_9, se_tenant_id, 'SE-2025-0987', 'Brendan Daly', 'brendan.daly@email.ie', '+353 85 901 2345', '4 Pine Road, Mallow', 'Mallow', 'Cork', 'solar_pv', 5.74, 'Fronius Primo 5.0', 'Trina Solar 410W', 14, '2025-08-19', '2035-08-19', 'active', 'healthy', 'private', 'cork_county',
     '{"battery": "BYD HVS 5.1kWh", "optimizer_count": 0, "roof_orientation": "south", "panel_warranty_years": 25, "inverter_warranty_years": 10, "workmanship_warranty_years": 10}'),

    (inst_10, se_tenant_id, 'SE-2025-0892', 'Róisín Walsh', 'roisin.walsh@email.ie', '+353 87 012 3456', '11 Cedar Avenue, Glanmire', 'Cork', 'Cork', 'solar_pv', 3.69, 'SolarEdge SE3680H', 'JA Solar 410W', 9, '2026-02-12', '2036-02-12', 'pending', 'healthy', 'private', 'cork_county',
     '{"battery": "none", "optimizer_count": 9, "roof_orientation": "south-east", "panel_warranty_years": 25, "inverter_warranty_years": 12, "workmanship_warranty_years": 10}')
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- ESCALATIONS (3 active)
  -- ============================================================
  esc_1 := gen_random_uuid();
  esc_2 := gen_random_uuid();
  esc_3 := gen_random_uuid();

  INSERT INTO escalations (id, tenant_id, installation_id, title, description, priority, status, assigned_to, assigned_at, scheduled_date, diagnostic_context)
  VALUES
    (esc_1, se_tenant_id, inst_6, 'Inverter not restarting after power cut',
     'Customer reports inverter shows red fault light and will not restart after area-wide power cut. AC isolator toggled, 5 min wait performed. SolarEdge SE3680H.',
     'critical', 'open', NULL, NULL, NULL,
     '{"steps_attempted": ["AC isolator check - confirmed ON", "Restart attempted - still red after 5 min"], "system": "SolarEdge SE3680H", "install_date": "2025-11-14"}'),

    (esc_2, se_tenant_id, inst_7, 'No generation for 48 hours',
     'System showing 0 kWh generation for 48+ hours despite clear weather. Customer completed diagnostic flow. SolarEdge SE5000H with 9.7kWh battery.',
     'critical', 'assigned', 'Dan Kelly', now() - interval '2 hours', NULL,
     '{"steps_attempted": ["Visual check - no error lights", "AC isolator restart - no change", "Monitoring app shows offline"], "system": "SolarEdge SE5000H", "install_date": "2025-10-08"}'),

    (esc_3, se_tenant_id, inst_8, 'Unusual buzzing noise from inverter',
     'Customer reports intermittent buzzing noise from inverter unit, mainly during peak generation hours. No error lights visible.',
     'high', 'assigned', 'Mike Lynch', now() - interval '1 day', CURRENT_DATE + interval '3 days',
     '{"steps_attempted": ["Visual check - no visible damage", "Noise occurs during 11am-2pm peak"], "system": "SolarEdge SE3680H", "install_date": "2025-09-22"}')
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- SUPPORT QUERIES (sample recent queries)
  -- ============================================================
  sq_1 := gen_random_uuid();
  sq_2 := gen_random_uuid();
  sq_3 := gen_random_uuid();

  INSERT INTO support_queries (id, tenant_id, installation_id, query_text, ai_response, response_source, resolved, escalated, query_category)
  VALUES
    (sq_1, se_tenant_id, inst_4, 'How much energy did my system generate today?',
     'Based on your SolarEdge SE3680H system at 12 Meadow Drive, your 3.69 kWp system typically generates between 3-5 kWh on a day like today. You can check your exact real-time generation in the SolarEdge monitoring app.',
     'ai', true, false, 'energy_tips'),

    (sq_2, se_tenant_id, inst_2, 'What does the green light on my inverter mean?',
     'A steady green light on your SolarEdge SE3000H inverter means everything is working normally — your system is generating solar power. If the light changes to red or starts flashing, that indicates an issue and you should use our diagnostic tool.',
     'ai', true, false, 'inverter_error'),

    (sq_3, se_tenant_id, inst_6, 'My inverter has a red light after the power cut',
     'I can see your SolarEdge SE3680H is showing a fault light. Let me walk you through some troubleshooting steps. First, can you check if the AC isolator switch is in the ON position?',
     'ai', false, true, 'inverter_error')
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- DIAGNOSTIC FLOWS (5 flows)
  -- ============================================================
  df_1 := gen_random_uuid();
  df_2 := gen_random_uuid();
  df_3 := gen_random_uuid();
  df_4 := gen_random_uuid();
  df_5 := gen_random_uuid();

  INSERT INTO diagnostic_flows (id, tenant_id, name, description, icon, colour, system_type, status, stats_started, stats_resolved, stats_escalated, steps)
  VALUES
    (df_1, se_tenant_id, 'Inverter Error Light',
     'Guides customer through AC isolator check, restart procedure, and escalation if unresolved.',
     'alert-triangle', 'red', 'solar_pv', 'live', 342, 277, 65,
     '[{"id": 1, "title": "AC Isolator Check", "question": "Is the AC isolator switch in the ON position?", "type": "yes_no", "yes_next": 2, "no_action": "quick_fix", "quick_fix_text": "Turn the AC isolator switch to the ON position. Your inverter should restart within 2 minutes."},
       {"id": 2, "title": "Restart Procedure", "question": "Turn AC isolator OFF, wait 30 seconds, then turn ON again. Is the light now green?", "type": "yes_no", "yes_action": "resolved", "no_next": 3},
       {"id": 3, "title": "Escalation", "type": "escalate", "message": "The inverter fault persists after restart. A technician visit is needed."}]'),

    (df_2, se_tenant_id, 'No Power Generating',
     'Step-by-step check for zero generation issues including weather, inverter status, and meter verification.',
     'zap-off', 'amber', 'solar_pv', 'live', 218, 157, 61,
     '[{"id": 1, "title": "Weather Check", "question": "Is it currently daytime with some sunlight?", "type": "yes_no", "yes_next": 2, "no_action": "resolved", "resolved_text": "Solar panels need daylight to generate. Generation will resume when the sun rises."},
       {"id": 2, "title": "Inverter Status", "question": "What colour is the light on your inverter?", "type": "multiple_choice", "options": [{"label": "Green", "next": 3}, {"label": "Red/Flashing", "next": 4}, {"label": "No light at all", "next": 5}]},
       {"id": 3, "title": "Generation Check", "question": "Check your monitoring app. Does it show any generation today?", "type": "yes_no", "yes_action": "resolved", "resolved_text": "Your system appears to be generating. The issue may be with your meter reading.", "no_next": 5},
       {"id": 4, "title": "Error Light", "message": "Your inverter is showing an error. Please use the Inverter Error Light diagnostic flow for detailed troubleshooting.", "type": "redirect", "redirect_flow": "Inverter Error Light"},
       {"id": 5, "title": "Escalation", "type": "escalate", "message": "Your system may need a technician inspection to diagnose the generation issue."}]'),

    (df_3, se_tenant_id, 'Display Not Responding',
     'Troubleshooting for unresponsive inverter displays and monitoring connectivity issues.',
     'monitor-off', 'blue', 'solar_pv', 'live', 156, 133, 23,
     '[{"id": 1, "title": "Power Check", "question": "Is the inverter making any sounds or showing any lights?", "type": "yes_no", "yes_next": 2, "no_next": 3},
       {"id": 2, "title": "Display Reset", "question": "Press and hold the display button for 10 seconds. Did the display come back?", "type": "yes_no", "yes_action": "resolved", "no_next": 4},
       {"id": 3, "title": "AC Isolator", "question": "Toggle the AC isolator OFF, wait 30 seconds, then ON. Any change?", "type": "yes_no", "yes_action": "resolved", "no_next": 4},
       {"id": 4, "title": "Escalation", "type": "escalate", "message": "The display issue requires a technician to inspect the inverter unit."}]'),

    (df_4, se_tenant_id, 'Unusual Noise',
     'Helps identify and categorise inverter noise issues — buzzing, clicking, or humming.',
     'volume-2', 'purple', 'solar_pv', 'live', 89, 57, 32,
     '[{"id": 1, "title": "Noise Type", "question": "What best describes the noise?", "type": "multiple_choice", "options": [{"label": "Quiet humming", "next": 2}, {"label": "Loud buzzing", "next": 3}, {"label": "Clicking or rattling", "next": 3}]},
       {"id": 2, "title": "Normal Operation", "message": "A quiet hum during generation is normal for most inverters. It should stop at night.", "type": "info", "next": 4},
       {"id": 3, "title": "Abnormal Noise", "message": "This type of noise may indicate an issue that needs inspection.", "type": "escalate"},
       {"id": 4, "title": "Timing Check", "question": "Does the humming only occur during daytime when generating?", "type": "yes_no", "yes_action": "resolved", "resolved_text": "This is normal inverter operation. The hum occurs during power conversion and stops at night.", "no_action": "escalate"}]'),

    (df_5, se_tenant_id, 'Energy Bill Concerns',
     'Guides customers through understanding their energy bills and solar savings expectations.',
     'receipt', 'green', 'solar_pv', 'live', 42, 38, 4,
     '[{"id": 1, "title": "Bill Period", "question": "Does this bill cover a period when your solar was installed and generating?", "type": "yes_no", "yes_next": 2, "no_action": "resolved", "resolved_text": "Your bill may cover a period before your solar was installed. You should see savings on your next bill cycle."},
       {"id": 2, "title": "Usage Check", "question": "Have you recently added new appliances or changed your usage patterns?", "type": "yes_no", "yes_action": "resolved", "resolved_text": "Increased usage can offset solar savings. Try running high-energy appliances during daylight hours to maximise self-consumption.", "no_next": 3},
       {"id": 3, "title": "Tariff Review", "question": "We recommend checking your tariff rate with your energy supplier. Would you like tips on choosing the best tariff for solar?", "type": "yes_no", "yes_action": "resolved", "resolved_text": "Look for tariffs with a high export rate and low unit rate. Day/night meters work well with solar as you can export during the day.", "no_action": "resolved"}]')
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- INSTALLER CONTENT (sample content for SE Systems)
  -- ============================================================
  INSERT INTO installer_content (tenant_id, title, description, content_type, category, system_type, brand, model, status, view_count)
  VALUES
    (se_tenant_id, 'Understanding Your Inverter', 'A comprehensive guide to how your solar inverter works, what the status lights mean, and basic troubleshooting.', 'video', 'how_to', 'solar_pv', 'SolarEdge', NULL, 'live', 234),
    (se_tenant_id, 'How to Read Your Energy Meter', 'Learn how to read your import and export meter readings to track your solar savings.', 'video', 'how_to', 'solar_pv', NULL, NULL, 'live', 189),
    (se_tenant_id, 'Resetting After a Power Cut', 'Step-by-step video guide for restarting your solar system after an area power cut.', 'video', 'troubleshooting', 'solar_pv', NULL, NULL, 'live', 156),
    (se_tenant_id, 'Installation Certificate', 'Your official solar PV installation certificate and compliance documentation.', 'document', 'product_manual', 'solar_pv', NULL, NULL, 'live', 89),
    (se_tenant_id, 'SEAI Grant Confirmation', 'Solar PV grant approval documentation from the Sustainable Energy Authority of Ireland.', 'document', 'product_manual', 'solar_pv', NULL, NULL, 'live', 67),
    (se_tenant_id, 'SolarEdge Inverter Error Codes', 'Complete reference guide for all SolarEdge inverter error codes and their meanings.', 'guide', 'troubleshooting', 'solar_pv', 'SolarEdge', NULL, 'live', 312),
    (se_tenant_id, 'Maximising Your Solar Savings', 'Tips and strategies for getting the most financial benefit from your solar installation.', 'guide', 'how_to', 'solar_pv', NULL, NULL, 'live', 201),
    (se_tenant_id, 'Winter Solar Performance Guide', 'What to expect from your solar panels during winter months and how to optimise performance.', 'guide', 'how_to', 'solar_pv', NULL, NULL, 'live', 145),
    (se_tenant_id, 'Fronius Primo Quick Start Guide', 'Getting started with your Fronius Primo inverter — setup, monitoring, and basic operations.', 'document', 'product_manual', 'solar_pv', 'Fronius', 'Primo 5.0', 'live', 78),
    (se_tenant_id, 'Solar Panel Cleaning Guide', 'When and how to safely clean your solar panels for optimal performance.', 'faq', 'how_to', 'solar_pv', NULL, NULL, 'live', 167)
  ON CONFLICT DO NOTHING;

END $$;
