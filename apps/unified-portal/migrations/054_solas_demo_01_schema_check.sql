-- Solas Renewables demo tenant: preflight schema check.
-- Verifies the SE Systems Cork installer source data is present and that all
-- target Care tables / columns exist before we clone records.
DO $$
DECLARE
  v_se_tenant uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  v_solas_tenant uuid := 'c1d2e3f4-a5b6-7890-cdef-123456789012';
  v_se_user uuid := 'e8e4d355-8957-4752-9322-2c0e4fe4d570';
  v_install_count int;
  v_admin_count int;
BEGIN
  -- 1. Source tenant must exist and be the installer flavour.
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = v_se_tenant AND tenant_type = 'installer') THEN
    RAISE EXCEPTION 'Pre-check failed: SE Systems installer tenant % not found', v_se_tenant;
  END IF;

  -- 2. The sesystems@test.ie auth user must be linked via admins (id == auth.users.id).
  SELECT count(*) INTO v_admin_count
  FROM public.admins WHERE id = v_se_user AND tenant_id = v_se_tenant;
  IF v_admin_count <> 1 THEN
    RAISE EXCEPTION 'Pre-check failed: admins row for sesystems@test.ie not found (got %)', v_admin_count;
  END IF;

  -- 3. SE Systems must have at least one installation we can clone from.
  SELECT count(*) INTO v_install_count
  FROM public.installations WHERE tenant_id = v_se_tenant;
  IF v_install_count = 0 THEN
    RAISE EXCEPTION 'Pre-check failed: SE Systems has zero installations';
  END IF;

  -- 4. Target tenant id must NOT already exist (idempotency guard).
  IF EXISTS (SELECT 1 FROM public.tenants WHERE id = v_solas_tenant) THEN
    RAISE EXCEPTION 'Pre-check failed: Solas tenant % already exists', v_solas_tenant;
  END IF;

  -- 5. Target email must NOT already exist.
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'solas-demo@test.ie') THEN
    RAISE EXCEPTION 'Pre-check failed: solas-demo@test.ie already exists in auth.users';
  END IF;

  -- 6. All Care tables we plan to clone must exist with expected linkage column.
  PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='installations'        AND column_name='tenant_id';
  IF NOT FOUND THEN RAISE EXCEPTION 'installations.tenant_id missing'; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='support_queries'      AND column_name='tenant_id';
  IF NOT FOUND THEN RAISE EXCEPTION 'support_queries.tenant_id missing'; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='escalations'          AND column_name='tenant_id';
  IF NOT FOUND THEN RAISE EXCEPTION 'escalations.tenant_id missing'; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='diagnostic_completions' AND column_name='tenant_id';
  IF NOT FOUND THEN RAISE EXCEPTION 'diagnostic_completions.tenant_id missing'; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='activity_log'         AND column_name='tenant_id';
  IF NOT FOUND THEN RAISE EXCEPTION 'activity_log.tenant_id missing'; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='installer_content'    AND column_name='tenant_id';
  IF NOT FOUND THEN RAISE EXCEPTION 'installer_content.tenant_id missing'; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='care_third_party_uploads' AND column_name='installer_tenant_id';
  IF NOT FOUND THEN RAISE EXCEPTION 'care_third_party_uploads.installer_tenant_id missing'; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='care_conversations'   AND column_name='installation_id';
  IF NOT FOUND THEN RAISE EXCEPTION 'care_conversations.installation_id missing'; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='care_messages'        AND column_name='conversation_id';
  IF NOT FOUND THEN RAISE EXCEPTION 'care_messages.conversation_id missing'; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='service_records'      AND column_name='installation_id';
  IF NOT FOUND THEN RAISE EXCEPTION 'service_records.installation_id missing'; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='service_bookings'     AND column_name='installation_id';
  IF NOT FOUND THEN RAISE EXCEPTION 'service_bookings.installation_id missing'; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='safety_alerts'        AND column_name='installation_id';
  IF NOT FOUND THEN RAISE EXCEPTION 'safety_alerts.installation_id missing'; END IF;

  RAISE NOTICE 'Solas demo preflight passed: SE Systems has % installations, % admin', v_install_count, v_admin_count;
END $$;
