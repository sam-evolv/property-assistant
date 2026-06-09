-- 071_demo_openhouse_demo_park.sql
-- ============================================================================
-- DEMO DATA ONLY — "OpenHouse Demo Park" (code OHDEMO)
-- Teardown: 071_demo_openhouse_demo_park_teardown.sql (deletes by code OHDEMO)
-- Applied to the live project via the Supabase MCP on 2026-06-09.
-- ============================================================================
-- A fresh 6-unit scheme owned by the existing demo developer account, used for
-- the IGBC/HPI demo (see docs/DEMO_SCRIPT_IGBC.md). Real schemes are never
-- touched. Dates are relative to now() so the "sale agreed last week" and
-- QA 8.0 readiness demos stay fresh — re-run teardown + this file to reset.
--
-- Evidence state by design:
--   Units 1-4  fully evidenced (issued guide + demo + aftercare + keys)  → QA8 READY
--   Unit  5    demo logged, no guide                                     → INCOMPLETE
--   Unit  6    nothing                                                   → INCOMPLETE (the live on-stage flip)
--   Unit  3    sale_agreed_date 6 days ago → the "last week" intelligence answer
--
-- Live-schema notes (verified via information_schema on 2026-06-09):
--   units.address / project_id / tier are NOT NULL (project_id self-maps to the
--   development id, Árdan View pattern); issue_reports.status check allows
--   open|resolved|reopened|homeowner_new and source allows homeowner_assistant|
--   site_team_snag|snagger_external|homeowner_escalated.

-- ---------------------------------------------------------------------------
-- 1. Development (owner = the account that owns the existing demo schemes)
-- ---------------------------------------------------------------------------
INSERT INTO developments (id, tenant_id, code, name, slug, address, description, is_active, developer_user_id)
VALUES (
  'dd000000-0000-4000-a000-000000000001',
  '4cee69c6-be4b-486e-9c33-2b5a7d30e287',
  'OHDEMO',
  'OpenHouse Demo Park',
  'openhouse-demo-park',
  'Carrigaline, Co. Cork',
  'Demo scheme for HPI / IGBC walkthroughs. Safe to evidence, reset via teardown.',
  true,
  '780f1fe9-8b1e-42aa-8230-8d6e7e24e6e8'
);

-- ---------------------------------------------------------------------------
-- 1b. Legacy projects row — units.project_id has an FK into projects, and the
--     RAG/document tooling keys off it (development ↔ project self-mapping,
--     same pattern as Árdan View).
-- ---------------------------------------------------------------------------
INSERT INTO projects (id, organization_id, name, address, development_id)
VALUES (
  'dd000000-0000-4000-a000-000000000001',
  '4cee69c6-be4b-486e-9c33-2b5a7d30e287',
  'OpenHouse Demo Park',
  'Carrigaline, Co. Cork',
  'dd000000-0000-4000-a000-000000000001'
);

-- ---------------------------------------------------------------------------
-- 2. Units (1-4 house type A, 3-bed semi · 5-6 house type B, 4-bed detached)
-- ---------------------------------------------------------------------------
INSERT INTO units (id, development_id, project_id, tenant_id, development_code, unit_number, unit_code, unit_uid, address, address_line_1, city, eircode, house_type_code, tier, unit_status, purchaser_name)
VALUES
  ('dd000000-0000-4000-a000-000000000011', 'dd000000-0000-4000-a000-000000000001', 'dd000000-0000-4000-a000-000000000001', '4cee69c6-be4b-486e-9c33-2b5a7d30e287', 'OHDEMO', '1', 'OHDEMO-01', 'ohdemo-1', '1 Demo Park', '1 Demo Park', 'Carrigaline', 'P43 DM01', 'A', 'standard', 'handed_over', 'Aoife & Conor Murphy'),
  ('dd000000-0000-4000-a000-000000000012', 'dd000000-0000-4000-a000-000000000001', 'dd000000-0000-4000-a000-000000000001', '4cee69c6-be4b-486e-9c33-2b5a7d30e287', 'OHDEMO', '2', 'OHDEMO-02', 'ohdemo-2', '2 Demo Park', '2 Demo Park', 'Carrigaline', 'P43 DM02', 'A', 'standard', 'sale_agreed', 'Sinead O''Brien'),
  ('dd000000-0000-4000-a000-000000000013', 'dd000000-0000-4000-a000-000000000001', 'dd000000-0000-4000-a000-000000000001', '4cee69c6-be4b-486e-9c33-2b5a7d30e287', 'OHDEMO', '3', 'OHDEMO-03', 'ohdemo-3', '3 Demo Park', '3 Demo Park', 'Carrigaline', 'P43 DM03', 'A', 'standard', 'sale_agreed', 'Liam & Niamh Walsh'),
  ('dd000000-0000-4000-a000-000000000014', 'dd000000-0000-4000-a000-000000000001', 'dd000000-0000-4000-a000-000000000001', '4cee69c6-be4b-486e-9c33-2b5a7d30e287', 'OHDEMO', '4', 'OHDEMO-04', 'ohdemo-4', '4 Demo Park', '4 Demo Park', 'Carrigaline', 'P43 DM04', 'A', 'standard', 'sale_agreed', 'Padraig Kelly'),
  ('dd000000-0000-4000-a000-000000000015', 'dd000000-0000-4000-a000-000000000001', 'dd000000-0000-4000-a000-000000000001', '4cee69c6-be4b-486e-9c33-2b5a7d30e287', 'OHDEMO', '5', 'OHDEMO-05', 'ohdemo-5', '5 Demo Park', '5 Demo Park', 'Carrigaline', 'P43 DM05', 'B', 'standard', 'in_progress', 'Emma Byrne'),
  ('dd000000-0000-4000-a000-000000000016', 'dd000000-0000-4000-a000-000000000001', 'dd000000-0000-4000-a000-000000000001', '4cee69c6-be4b-486e-9c33-2b5a7d30e287', 'OHDEMO', '6', 'OHDEMO-06', 'ohdemo-6', '6 Demo Park', '6 Demo Park', 'Carrigaline', 'P43 DM06', 'B', 'standard', 'available', NULL);

-- ---------------------------------------------------------------------------
-- 3. Sales pipeline (now()-relative; unit 3 = "sale agreed last week")
-- ---------------------------------------------------------------------------
INSERT INTO unit_sales_pipeline (tenant_id, development_id, unit_id, purchaser_name, release_date, sale_agreed_date, deposit_date, contracts_issued_date, signed_contracts_date, counter_signed_date, kitchen_date, snag_date, drawdown_date, handover_date)
SELECT u.tenant_id, u.development_id, u.id, u.purchaser_name,
  CASE u.unit_number WHEN '1' THEN now() - interval '21 days' WHEN '2' THEN now() - interval '21 days' WHEN '3' THEN now() - interval '14 days' WHEN '4' THEN now() - interval '21 days' WHEN '5' THEN now() - interval '25 days' ELSE now() - interval '3 days' END,
  CASE u.unit_number WHEN '1' THEN now() - interval '20 days' WHEN '2' THEN now() - interval '9 days'  WHEN '3' THEN now() - interval '6 days'  WHEN '4' THEN now() - interval '13 days' WHEN '5' THEN now() - interval '20 days' ELSE NULL END,
  CASE u.unit_number WHEN '1' THEN now() - interval '18 days' WHEN '2' THEN now() - interval '7 days'  WHEN '4' THEN now() - interval '10 days' ELSE NULL END,
  CASE u.unit_number WHEN '1' THEN now() - interval '15 days' WHEN '2' THEN now() - interval '6 days'  ELSE NULL END,
  CASE u.unit_number WHEN '1' THEN now() - interval '12 days' WHEN '2' THEN now() - interval '5 days'  ELSE NULL END,
  CASE u.unit_number WHEN '1' THEN now() - interval '10 days' ELSE NULL END,
  CASE u.unit_number WHEN '1' THEN now() - interval '8 days'  ELSE NULL END,
  CASE u.unit_number WHEN '1' THEN now() - interval '5 days'  ELSE NULL END,
  CASE u.unit_number WHEN '1' THEN now() - interval '3 days'  ELSE NULL END,
  CASE u.unit_number WHEN '1' THEN now() - interval '2 days'  ELSE NULL END
FROM units u WHERE u.development_id = 'dd000000-0000-4000-a000-000000000001';

-- ---------------------------------------------------------------------------
-- 4. Installed systems (3 per unit: heat pump, MVHR, solar PV)
-- ---------------------------------------------------------------------------
INSERT INTO unit_systems (tenant_id, unit_id, system_type, make, model, serial_number, key_settings, commissioning_date, warranty_start, warranty_end, maintenance_interval_months, notes)
SELECT u.tenant_id, u.id, 'heat_pump', 'Mitsubishi', 'Ecodan PUZ-WM85VAA', 'OHD-HP-000' || u.unit_number,
  '{"flow_temp_c": 45, "dhw_target_c": 50}'::jsonb,
  (now() - interval '40 days')::date, (now() - interval '40 days')::date, (now() + interval '5 years')::date, 12,
  'Commissioned by OpenHouse Demo M&E.'
FROM units u WHERE u.development_id = 'dd000000-0000-4000-a000-000000000001';

INSERT INTO unit_systems (tenant_id, unit_id, system_type, make, model, serial_number, key_settings, commissioning_date, warranty_start, warranty_end, maintenance_interval_months, notes)
SELECT u.tenant_id, u.id, 'mvhr', 'Vent-Axia', 'Sentinel Kinetic B', 'OHD-MV-000' || u.unit_number,
  '{"boost_mode": "humidity", "filters": "G4"}'::jsonb,
  (now() - interval '38 days')::date, (now() - interval '38 days')::date, (now() + interval '2 years')::date, 6,
  'Filter clean every 6 months; replace annually.'
FROM units u WHERE u.development_id = 'dd000000-0000-4000-a000-000000000001';

INSERT INTO unit_systems (tenant_id, unit_id, system_type, make, model, serial_number, key_settings, commissioning_date, warranty_start, warranty_end, maintenance_interval_months, notes)
SELECT u.tenant_id, u.id, 'solar_pv', 'SolarEdge', 'SE3680H', 'OHD-PV-000' || u.unit_number,
  '{"panels": 8, "battery": false, "export_limit_kw": 3.68}'::jsonb,
  (now() - interval '32 days')::date, (now() - interval '32 days')::date, (now() + interval '10 years')::date, NULL,
  'Inverter app on the homeowner''s phone at handover.'
FROM units u WHERE u.development_id = 'dd000000-0000-4000-a000-000000000001';

-- ---------------------------------------------------------------------------
-- 5. Home User Guides — units 1-4, issued (static content; no model call)
-- ---------------------------------------------------------------------------
INSERT INTO home_user_guides (tenant_id, unit_id, version, status, issued_at, model, generated_by, content)
SELECT u.tenant_id, u.id, 1, 'issued', now() - interval '9 days', 'demo-static', NULL,
  jsonb_build_object(
    'title', 'Your Home User Guide — ' || u.address_line_1,
    'introduction', 'Welcome to your new A-rated home at OpenHouse Demo Park. This guide covers the three systems that keep your home warm, fresh and efficient — your heat pump, your ventilation system and your solar panels — in plain language. Keep it handy for the first year.',
    'systems_covered', jsonb_build_array('heat_pump', 'mvhr', 'solar_pv'),
    'sections', jsonb_build_array(
      jsonb_build_object(
        'heading', 'Your heat pump (Mitsubishi Ecodan)',
        'system_type', 'heat_pump',
        'summary', 'The heat pump heats your radiators/underfloor and your hot water. It runs best low and steady — it is not a boiler.',
        'how_to_use', jsonb_build_array('Set room temperature once and leave it — 19-20C is typical', 'Hot water reheats automatically; use Boost only for guests', 'Use the timer for small setbacks, not big swings'),
        'do_not', jsonb_build_array('Do not switch the heat pump off in winter — it costs more to recover than to maintain', 'Do not set flow temperature above the commissioned 45C without advice'),
        'seasonal_tips', jsonb_build_array('Autumn: check the outdoor unit is clear of leaves', 'Winter: a defrost cycle with steam from the outdoor unit is normal'),
        'maintenance', jsonb_build_array('Annual service — first one is due 12 months after commissioning'),
        'warranty', '5-year manufacturer warranty from commissioning'
      ),
      jsonb_build_object(
        'heading', 'Your ventilation (Vent-Axia MVHR)',
        'system_type', 'mvhr',
        'summary', 'The MVHR quietly changes the air in your home all day while keeping the heat. It must stay on.',
        'how_to_use', jsonb_build_array('Leave it running 24/7 — it is designed for that', 'Boost runs automatically with humidity (showers, cooking)'),
        'do_not', jsonb_build_array('Do not switch it off at the fused spur', 'Do not block the ceiling valves, even in winter'),
        'seasonal_tips', jsonb_build_array('Summer: use summer bypass mode for cooler night air'),
        'maintenance', jsonb_build_array('Clean filters every 6 months (vacuum gently)', 'Replace filters every 12 months'),
        'warranty', '2-year manufacturer warranty'
      ),
      jsonb_build_object(
        'heading', 'Your solar panels (SolarEdge)',
        'system_type', 'solar_pv',
        'summary', '8 roof panels generate free daytime electricity; surplus exports to the grid for credit.',
        'how_to_use', jsonb_build_array('Run the dishwasher and washing machine in daylight hours when you can', 'Track generation in the SolarEdge app set up at handover'),
        'do_not', jsonb_build_array('Do not switch off the inverter isolator unless instructed'),
        'seasonal_tips', jsonb_build_array('Output is naturally lower November-January — that is normal'),
        'maintenance', jsonb_build_array('No routine maintenance; rain keeps panels clean'),
        'warranty', '10-year inverter warranty; 25-year panel performance warranty'
      )
    ),
    'general_tips', jsonb_build_array(
      'Your home is airtight by design — use the MVHR rather than leaving windows open in winter',
      'Hairline cracks in the first 12-18 months are normal settlement; report anything wider than 3mm',
      'Know where your water stopcock is: under the kitchen sink'
    ),
    'who_to_contact', 'Aftercare: report any issue through your OpenHouse home assistant — it goes straight to the site team. Emergencies: ESB Networks 1800 372 999, Gas Networks Ireland 1800 20 50 50.',
    'generated_at', to_char(now() - interval '9 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'model', 'demo-static'
  )
FROM units u
WHERE u.development_id = 'dd000000-0000-4000-a000-000000000001' AND u.unit_number IN ('1','2','3','4');

-- ---------------------------------------------------------------------------
-- 6. Handover evidence trail (QA 8.0): units 1-4 full, unit 5 demo only
-- ---------------------------------------------------------------------------
INSERT INTO handover_events (tenant_id, unit_id, event_type, occurred_at, conducted_by_name, attended_by, acknowledgement_ref, notes)
SELECT u.tenant_id, u.id, 'demo_completed', now() - (interval '1 day' * (2 + u.unit_number::int)), 'Site Manager — OpenHouse Demo', u.purchaser_name, 'ACK-2026-000' || u.unit_number,
  'Heating, ventilation and PV walked through at the kitchen island; homeowner questions answered.'
FROM units u
WHERE u.development_id = 'dd000000-0000-4000-a000-000000000001' AND u.unit_number IN ('1','2','3','4','5');

INSERT INTO handover_events (tenant_id, unit_id, event_type, occurred_at, conducted_by_name, attended_by, home_user_guide_version, notes)
SELECT u.tenant_id, u.id, 'guide_issued', now() - interval '9 days', 'Site Manager — OpenHouse Demo', u.purchaser_name, 1,
  'Home User Guide v1 issued via the OpenHouse purchaser portal.'
FROM units u
WHERE u.development_id = 'dd000000-0000-4000-a000-000000000001' AND u.unit_number IN ('1','2','3','4');

INSERT INTO handover_events (tenant_id, unit_id, event_type, occurred_at, conducted_by_name, attended_by, notes)
SELECT u.tenant_id, u.id, 'keys_handed', now() - (interval '1 day' * (1 + u.unit_number::int)), 'Site Manager — OpenHouse Demo', u.purchaser_name, NULL
FROM units u
WHERE u.development_id = 'dd000000-0000-4000-a000-000000000001' AND u.unit_number IN ('1','2','3','4');

INSERT INTO handover_events (tenant_id, unit_id, event_type, occurred_at, conducted_by_name, notes)
SELECT u.tenant_id, u.id, 'aftercare_activated', now() - (interval '1 day' * u.unit_number::int), 'OpenHouse', 'Homeowner assistant + issue reporting switched on.'
FROM units u
WHERE u.development_id = 'dd000000-0000-4000-a000-000000000001' AND u.unit_number IN ('1','2','3','4');

-- ---------------------------------------------------------------------------
-- 7. Snags (canonical issue_reports; live status check: open|resolved|reopened|homeowner_new)
-- ---------------------------------------------------------------------------
INSERT INTO issue_reports (tenant_id, development_id, unit_id, title, description, room, status, priority, source, severity_label, safety_risk, likely_trade, resolved, resolved_at, logged_by_role)
SELECT u.tenant_id, u.development_id, u.id, v.title, v.description, v.room, v.status, v.priority, v.source, v.severity_label, v.safety_risk, v.likely_trade, v.resolved, v.resolved_at, v.logged_by_role
FROM (VALUES
  ('2', 'Exposed wiring at consumer unit', 'Cover plate missing on the consumer unit in the hall press; conductors visible.', 'Hallway', 'open', 'high', 'site_team_snag', 'high', true, 'electrician', false, NULL::timestamptz, 'site_team'),
  ('1', 'Touch up paint on landing wall', 'Scuff marks at the top of the stairs from furniture delivery.', 'Landing', 'resolved', 'low', 'site_team_snag', 'low', false, 'painter', true, now() - interval '4 days', 'site_team'),
  ('3', 'Ensuite door not closing', 'Door catches on the frame at the latch side; needs adjustment.', 'Ensuite', 'open', 'medium', 'site_team_snag', 'medium', false, 'carpenter', false, NULL, 'site_team'),
  ('5', 'Sealant gap at kitchen worktop', 'Sealant bead incomplete behind the hob; risk of water tracking behind units.', 'Kitchen', 'homeowner_new', 'low', 'homeowner_assistant', 'low', false, 'plumber', false, NULL, 'homeowner')
) AS v(unit_number, title, description, room, status, priority, source, severity_label, safety_risk, likely_trade, resolved, resolved_at, logged_by_role)
JOIN units u ON u.development_id = 'dd000000-0000-4000-a000-000000000001' AND u.unit_number = v.unit_number;
