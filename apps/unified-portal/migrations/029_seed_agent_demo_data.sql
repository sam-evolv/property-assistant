-- ============================================================
-- Agent Intelligence — Demo Data Seed
-- Run in Supabase SQL Editor
-- ============================================================
-- This script:
--   1. Looks up existing user, tenant, and development IDs
--   2. Creates an agent_profile for Sam Donworth
--   3. Creates agent_scheme_assignments for ALL developments
--   4. Verifies the result
-- ============================================================

-- Step 1: Inspect existing data (run these SELECTs first to get the IDs)
-- Uncomment and run individually if needed:
-- SELECT id, email FROM auth.users LIMIT 10;
-- SELECT id, name FROM tenants LIMIT 10;
-- SELECT id, name, tenant_id FROM developments LIMIT 20;

-- Step 2 & 3: Insert agent profile + assignments in one transaction
-- Replace the literal UUIDs below if your IDs differ.

DO $$
DECLARE
  v_user_id     UUID;
  v_tenant_id   UUID;
  v_agent_id    UUID;
  v_dev         RECORD;
BEGIN
  -- ── Find the admin user (adjust email if needed) ──
  SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = 'sam@openhouseai.ie'
    LIMIT 1;

  -- Fallback: grab the first admin user if exact email not found
  IF v_user_id IS NULL THEN
    SELECT au.id INTO v_user_id
      FROM auth.users au
      JOIN admins a ON a.email = au.email
      ORDER BY au.created_at ASC
      LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found in auth.users. Seed at least one admin user first.';
  END IF;

  RAISE NOTICE 'Using user_id: %', v_user_id;

  -- ── Find the tenant ──
  SELECT id INTO v_tenant_id
    FROM tenants
    ORDER BY created_at ASC
    LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant found. Seed at least one tenant first.';
  END IF;

  RAISE NOTICE 'Using tenant_id: %', v_tenant_id;

  -- ── Create agent profile (upsert to avoid duplicates) ──
  INSERT INTO agent_profiles (user_id, tenant_id, display_name, agency_name, email, phone, preferred_tone)
  VALUES (
    v_user_id,
    v_tenant_id,
    'Sam Donworth',
    'OpenHouse AI',
    'sam@openhouseai.ie',
    '+353 87 123 4567',
    'professional'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_agent_id;

  -- If already existed, look it up
  IF v_agent_id IS NULL THEN
    SELECT id INTO v_agent_id
      FROM agent_profiles
      WHERE user_id = v_user_id AND tenant_id = v_tenant_id
      LIMIT 1;
  END IF;

  RAISE NOTICE 'Agent profile id: %', v_agent_id;

  -- ── Assign agent to ALL developments in this tenant ──
  FOR v_dev IN
    SELECT id FROM developments WHERE tenant_id = v_tenant_id
  LOOP
    INSERT INTO agent_scheme_assignments (agent_id, development_id, tenant_id, assigned_by, role, is_active)
    VALUES (v_agent_id, v_dev.id, v_tenant_id, v_user_id, 'lead_agent', true)
    ON CONFLICT (agent_id, development_id) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Done. Agent assigned to all developments.';
END $$;

-- ── Step 4: Verify ──
SELECT
  ap.id AS agent_id,
  ap.display_name,
  ap.agency_name,
  ap.email,
  d.name AS scheme_name,
  asa.role,
  asa.is_active
FROM agent_profiles ap
JOIN agent_scheme_assignments asa ON asa.agent_id = ap.id
JOIN developments d ON d.id = asa.development_id
WHERE ap.display_name = 'Sam Donworth'
ORDER BY d.name;
