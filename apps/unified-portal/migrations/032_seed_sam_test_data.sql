-- ================================================================
-- Seed test data for sam@evolvai.ie — run in Supabase SQL Editor
-- ================================================================
-- This creates:
-- 1. A care installation so sam@evolvai.ie can log into the Care portal
-- 2. Ensures a homeowner unit exists with a known code for testing
-- ================================================================

-- 1. Care installation for sam@evolvai.ie
-- First check if one already exists
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Use an existing tenant (the first one found)
  SELECT id INTO v_tenant_id FROM tenants LIMIT 1;

  IF v_tenant_id IS NULL THEN
    -- Create a minimal tenant if none exist
    INSERT INTO tenants (id, name, slug)
    VALUES (gen_random_uuid(), 'SE Systems Demo', 'se-systems-demo')
    RETURNING id INTO v_tenant_id;
  END IF;

  -- Insert care installation if not already present
  IF NOT EXISTS (
    SELECT 1 FROM installations WHERE customer_email = 'sam@evolvai.ie'
  ) THEN
    INSERT INTO installations (
      id, tenant_id, system_type, system_model, capacity,
      customer_name, customer_email, homeowner_email,
      address_line_1, city, county, eircode,
      installation_date, warranty_expiry,
      adoption_status, created_at
    ) VALUES (
      gen_random_uuid(),
      v_tenant_id,
      'heat_pump',
      'Daikin Altherma 3 R',
      '8kW',
      'Mary Murphy',
      'sam@evolvai.ie',
      'sam@evolvai.ie',
      '14 Innishmore Rise',
      'Cork',
      'Co. Cork',
      'T12 AB34',
      '2024-11-15',
      '2029-11-15',
      'active',
      NOW()
    );
    RAISE NOTICE 'Created care installation for sam@evolvai.ie';
  ELSE
    RAISE NOTICE 'Care installation for sam@evolvai.ie already exists';
  END IF;
END $$;

-- 2. Ensure a homeowner unit exists with a test code
-- The homeowner login requires email + unit_code
DO $$
DECLARE
  v_tenant_id UUID;
  v_dev_id UUID;
BEGIN
  -- Use an existing development (Meadow View if it exists)
  SELECT d.id, d.tenant_id INTO v_dev_id, v_tenant_id
  FROM developments d
  WHERE d.name ILIKE '%Meadow%'
  LIMIT 1;

  IF v_dev_id IS NULL THEN
    SELECT d.id, d.tenant_id INTO v_dev_id, v_tenant_id
    FROM developments d
    LIMIT 1;
  END IF;

  IF v_dev_id IS NOT NULL THEN
    -- Check if a test unit code already exists
    IF NOT EXISTS (
      SELECT 1 FROM units WHERE unit_code = 'SAM-TEST-001'
    ) THEN
      INSERT INTO units (
        id, tenant_id, development_id,
        unit_number, unit_code,
        address_line_1,
        resident_name, resident_email,
        created_at
      ) VALUES (
        gen_random_uuid(),
        v_tenant_id,
        v_dev_id,
        '14',
        'SAM-TEST-001',
        '14 Innishmore Rise, Meadow View',
        'Sam Donworth',
        'sam@evolvai.ie',
        NOW()
      );
      RAISE NOTICE 'Created homeowner test unit SAM-TEST-001 for sam@evolvai.ie';
    ELSE
      -- Update the existing unit to ensure email is correct
      UPDATE units SET resident_email = 'sam@evolvai.ie', resident_name = 'Sam Donworth'
      WHERE unit_code = 'SAM-TEST-001';
      RAISE NOTICE 'Updated existing unit SAM-TEST-001';
    END IF;
  ELSE
    RAISE NOTICE 'No developments found — create one first';
  END IF;
END $$;
