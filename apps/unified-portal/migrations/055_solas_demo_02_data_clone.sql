-- Solas Renewables demo tenant: clone customer/install/job data from SE Systems.
-- SE Systems tenant a1b2c3d4-... is the source. Solas tenant c1d2e3f4-... is the target.
-- We never UPDATE or DELETE any SE Systems row; we only INSERT clones.

-- 1. Create the Solas tenant.
INSERT INTO public.tenants (id, name, slug, tenant_type, description, theme_color, primary_color, brand, contact, created_at)
VALUES (
  'c1d2e3f4-a5b6-7890-cdef-123456789012',
  'Solas Renewables',
  'solas-renewables',
  'installer',
  'Solar PV and heat pump installation company based in Cork, Ireland',
  '#16a34a',
  '#16a34a',
  jsonb_build_object('region', 'Cork, Ireland', 'primary_color', '#16a34a'),
  jsonb_build_object(
    'name',    'Aoife Walsh',
    'email',   'hello@solasrenewables.ie',
    'phone',   '+353 87 555 0145',
    'address', 'Unit 4, Riverside Business Park, Cork'
  ),
  now()
);

-- 2. Build deterministic mapping: SE install id -> Solas install id, with stable customer name.
CREATE TEMP TABLE _solas_install_map ON COMMIT DROP AS
SELECT
  id    AS old_id,
  gen_random_uuid() AS new_id,
  ROW_NUMBER() OVER (ORDER BY install_date, id) AS rn
FROM public.installations
WHERE tenant_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

CREATE TEMP TABLE _solas_name_map ON COMMIT DROP AS
SELECT * FROM (VALUES
  (1,  'Aoife Walsh',          'aoife.walsh@email.ie'),
  (2,  'Liam Murphy',           'liam.murphy@email.ie'),
  (3,  'Niamh Byrne',           'niamh.byrne@email.ie'),
  (4,  'Conor Kelly',           'conor.kelly@email.ie'),
  (5,  'Saoirse O''Connor',     'saoirse.oconnor@email.ie'),
  (6,  'Cian O''Reilly',        'cian.oreilly@email.ie'),
  (7,  'Eimear Doyle',          'eimear.doyle@email.ie'),
  (8,  'Aisling Power',         'aisling.power@email.ie'),
  (9,  'Diarmuid Lynch',        'diarmuid.lynch@email.ie'),
  (10, 'Caoimhe Hughes',        'caoimhe.hughes@email.ie'),
  (11, 'Oisin Cassidy',         'oisin.cassidy@email.ie'),
  (12, 'Tadhg Ryan',            'tadhg.ryan@email.ie'),
  (13, 'Sinead Donovan',        'sinead.donovan@email.ie'),
  (14, 'Fiachra Moore',         'fiachra.moore@email.ie'),
  (15, 'Roisin Quinn',          'roisin.quinn@email.ie')
) AS t(rn, customer_name, customer_email);

-- 3. Clone installations (PII swapped, install/system data identical).
INSERT INTO public.installations (
  id, tenant_id, job_reference, customer_name, customer_email, customer_phone,
  address_line_1, address_line_2, city, county, eircode,
  system_type, system_size_kwp, inverter_model, panel_model, panel_count, system_specs,
  install_date, warranty_expiry, portal_status, portal_activated_at, health_status, source,
  unit_id, region, notes, created_at, updated_at,
  energy_generated_kwh, savings_eur, system_category,
  heat_pump_model, heat_pump_serial, heat_pump_cop, flow_temp_current, zones_total, zones_active,
  hot_water_cylinder_model, hot_water_temp_current, controls_model, controls_issue,
  last_service_date, next_service_due, warranty_years, annual_service_required,
  seai_grant_amount, seai_grant_status, seai_grant_ref, seai_application_date, ber_rating,
  active_safety_alerts, indoor_temp_current, indoor_temp_target,
  daily_running_cost_cents, co2_saved_today_grams, monthly_running_cost_cents, monthly_budget_cents,
  installer_name, installer_contact
)
SELECT
  m.new_id,
  'c1d2e3f4-a5b6-7890-cdef-123456789012'::uuid,
  REPLACE(REPLACE(i.job_reference, 'SE-', 'SOL-'), 'PL-', 'SOL-'),
  n.customer_name,
  n.customer_email,
  i.customer_phone,
  i.address_line_1, i.address_line_2, i.city, i.county, i.eircode,
  i.system_type, i.system_size_kwp, i.inverter_model, i.panel_model, i.panel_count, i.system_specs,
  i.install_date, i.warranty_expiry, i.portal_status, i.portal_activated_at, i.health_status, i.source,
  NULL::uuid,
  i.region, i.notes, i.created_at, i.updated_at,
  i.energy_generated_kwh, i.savings_eur, i.system_category,
  i.heat_pump_model, i.heat_pump_serial, i.heat_pump_cop, i.flow_temp_current, i.zones_total, i.zones_active,
  i.hot_water_cylinder_model, i.hot_water_temp_current, i.controls_model, i.controls_issue,
  i.last_service_date, i.next_service_due, i.warranty_years, i.annual_service_required,
  i.seai_grant_amount, i.seai_grant_status, i.seai_grant_ref, i.seai_application_date, i.ber_rating,
  i.active_safety_alerts, i.indoor_temp_current, i.indoor_temp_target,
  i.daily_running_cost_cents, i.co2_saved_today_grams, i.monthly_running_cost_cents, i.monthly_budget_cents,
  CASE WHEN i.installer_name IS NOT NULL THEN 'Solas Renewables' END,
  CASE WHEN i.installer_contact IS NOT NULL THEN
    jsonb_build_object('email', 'hello@solasrenewables.ie', 'phone', '021 555 0145')
  END
FROM public.installations i
JOIN _solas_install_map m ON m.old_id = i.id
JOIN _solas_name_map     n ON n.rn    = m.rn
WHERE i.tenant_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- 4. Clone service_records (linked via installation_id).
INSERT INTO public.service_records (id, installation_id, service_date, service_type, engineer_name, company, outcome, notes, report_url, warranty_validated, created_at)
SELECT
  gen_random_uuid(),
  m.new_id,
  sr.service_date, sr.service_type,
  sr.engineer_name,
  CASE WHEN sr.company ILIKE '%SE Systems%' THEN 'Solas Renewables' ELSE sr.company END,
  sr.outcome, sr.notes, sr.report_url, sr.warranty_validated, sr.created_at
FROM public.service_records sr
JOIN _solas_install_map m ON m.old_id = sr.installation_id;

-- 5. Clone service_bookings.
INSERT INTO public.service_bookings (id, installation_id, requested_slot, status, notes, created_at)
SELECT gen_random_uuid(), m.new_id, sb.requested_slot, sb.status, sb.notes, sb.created_at
FROM public.service_bookings sb
JOIN _solas_install_map m ON m.old_id = sb.installation_id;

-- 6. Clone safety_alerts.
INSERT INTO public.safety_alerts (id, installation_id, title, body, severity, action_label, action_url, dismissed_at, created_at)
SELECT gen_random_uuid(), m.new_id, sa.title, sa.body, sa.severity, sa.action_label, sa.action_url, sa.dismissed_at, sa.created_at
FROM public.safety_alerts sa
JOIN _solas_install_map m ON m.old_id = sa.installation_id;

-- 7. Clone care_conversations + care_messages (need conversation id mapping).
CREATE TEMP TABLE _solas_conv_map ON COMMIT DROP AS
SELECT cc.id AS old_id, gen_random_uuid() AS new_id, m.new_id AS new_install_id
FROM public.care_conversations cc
JOIN _solas_install_map m ON m.old_id = cc.installation_id;

INSERT INTO public.care_conversations (id, installation_id, title, message_count, created_at, updated_at)
SELECT cm.new_id, cm.new_install_id, cc.title, cc.message_count, cc.created_at, cc.updated_at
FROM public.care_conversations cc
JOIN _solas_conv_map cm ON cm.old_id = cc.id;

INSERT INTO public.care_messages (id, conversation_id, role, message_type, content, structured_data, created_at)
SELECT gen_random_uuid(), cm.new_id, msg.role, msg.message_type, msg.content, msg.structured_data, msg.created_at
FROM public.care_messages msg
JOIN _solas_conv_map cm ON cm.old_id = msg.conversation_id;

-- 8. Clone support_queries (escalation_id backfilled in step 10).
CREATE TEMP TABLE _solas_query_map ON COMMIT DROP AS
SELECT id AS old_id, gen_random_uuid() AS new_id
FROM public.support_queries
WHERE tenant_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

INSERT INTO public.support_queries (id, installation_id, tenant_id, query_text, ai_response, response_source, resolved, escalated, escalation_id, query_category, created_at, resolved_without_callout)
SELECT
  qm.new_id,
  m.new_id,
  'c1d2e3f4-a5b6-7890-cdef-123456789012'::uuid,
  sq.query_text, sq.ai_response, sq.response_source, sq.resolved, sq.escalated,
  NULL,
  sq.query_category, sq.created_at, sq.resolved_without_callout
FROM public.support_queries sq
JOIN _solas_query_map qm ON qm.old_id = sq.id
LEFT JOIN _solas_install_map m ON m.old_id = sq.installation_id
WHERE sq.tenant_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- 9. Clone escalations.
CREATE TEMP TABLE _solas_esc_map ON COMMIT DROP AS
SELECT id AS old_id, gen_random_uuid() AS new_id
FROM public.escalations
WHERE tenant_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

INSERT INTO public.escalations (
  id, installation_id, tenant_id, support_query_id,
  title, description, diagnostic_context, priority, status,
  assigned_to, assigned_at, scheduled_date, resolved_at, resolution_notes,
  created_at, updated_at
)
SELECT
  em.new_id,
  m.new_id,
  'c1d2e3f4-a5b6-7890-cdef-123456789012'::uuid,
  qm.new_id,
  e.title, e.description, e.diagnostic_context, e.priority, e.status,
  CASE WHEN e.assigned_to ILIKE '%SE Systems%' THEN REPLACE(REPLACE(e.assigned_to, 'SE Systems', 'Solas Renewables'), 'sesystems', 'solasrenewables') ELSE e.assigned_to END,
  e.assigned_at, e.scheduled_date, e.resolved_at, e.resolution_notes,
  e.created_at, e.updated_at
FROM public.escalations e
JOIN _solas_esc_map em       ON em.old_id = e.id
LEFT JOIN _solas_install_map m  ON m.old_id  = e.installation_id
LEFT JOIN _solas_query_map qm   ON qm.old_id = e.support_query_id
WHERE e.tenant_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- 10. Backfill the escalation_id on the newly-cloned support_queries (Solas only).
UPDATE public.support_queries sq_new
SET escalation_id = em.new_id
FROM public.support_queries sq_old
JOIN _solas_query_map qm ON qm.old_id = sq_old.id
JOIN _solas_esc_map   em ON em.old_id = sq_old.escalation_id
WHERE sq_new.id = qm.new_id
  AND sq_old.escalation_id IS NOT NULL
  AND sq_new.tenant_id = 'c1d2e3f4-a5b6-7890-cdef-123456789012';

-- 11. Clone diagnostic_completions.
INSERT INTO public.diagnostic_completions (id, diagnostic_flow_id, installation_id, tenant_id, steps_completed, outcome, completed_at_step, created_at)
SELECT
  gen_random_uuid(),
  dc.diagnostic_flow_id,
  m.new_id,
  'c1d2e3f4-a5b6-7890-cdef-123456789012'::uuid,
  dc.steps_completed, dc.outcome, dc.completed_at_step, dc.created_at
FROM public.diagnostic_completions dc
JOIN _solas_install_map m ON m.old_id = dc.installation_id
WHERE dc.tenant_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- 12. Clone activity_log (installation_id may be NULL on tenant-level activity).
INSERT INTO public.activity_log (id, tenant_id, installation_id, activity_type, description, created_at)
SELECT
  gen_random_uuid(),
  'c1d2e3f4-a5b6-7890-cdef-123456789012'::uuid,
  m.new_id,
  al.activity_type, al.description, al.created_at
FROM public.activity_log al
LEFT JOIN _solas_install_map m ON m.old_id = al.installation_id
WHERE al.tenant_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- 13. Clone installer_content (manuals, guides, brand-agnostic — clone as-is for the demo).
INSERT INTO public.installer_content (id, tenant_id, title, description, content_type, category, system_type, brand, model, file_url, status, view_count, created_at)
SELECT
  gen_random_uuid(),
  'c1d2e3f4-a5b6-7890-cdef-123456789012'::uuid,
  ic.title, ic.description, ic.content_type, ic.category, ic.system_type, ic.brand, ic.model, ic.file_url, ic.status, ic.view_count, ic.created_at
FROM public.installer_content ic
WHERE ic.tenant_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- 14. Clone care_third_party_uploads (third-party docs submitted to this installer).
INSERT INTO public.care_third_party_uploads (
  id, installer_tenant_id,
  submitter_name, submitter_company, submitter_email, submitter_phone,
  job_reference, property_address, job_type,
  document_name, document_category, document_size_bytes, storage_path,
  status, reviewed_by, reviewed_at, review_notes,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  'c1d2e3f4-a5b6-7890-cdef-123456789012'::uuid,
  ctpu.submitter_name, ctpu.submitter_company, ctpu.submitter_email, ctpu.submitter_phone,
  ctpu.job_reference, ctpu.property_address, ctpu.job_type,
  ctpu.document_name, ctpu.document_category, ctpu.document_size_bytes, ctpu.storage_path,
  ctpu.status,
  NULL,
  ctpu.reviewed_at, ctpu.review_notes,
  ctpu.created_at, ctpu.updated_at
FROM public.care_third_party_uploads ctpu
WHERE ctpu.installer_tenant_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
