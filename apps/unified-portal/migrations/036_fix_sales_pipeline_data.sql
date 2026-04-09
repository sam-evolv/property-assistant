-- ============================================================================
-- MIGRATION 036: Fix Sales Pipeline — Development links + Pipeline records
-- Run in Supabase SQL Editor against project mddxbilpjukwskeefakz
--
-- The unit_status and purchaser_name data has ALREADY been entered.
-- This migration ONLY fixes:
--   A. Development names (idempotent)
--   B. Unit → development_id linkage (by address pattern)
--   C. Pipeline record creation (so pipeline page shows data)
--   D. Pipeline dates for Árdan View (from N5 spreadsheet)
--
-- WARNING: DO NOT touch Harbour View Apartments
-- ============================================================================

BEGIN;

-- ============================================================
-- PART 0: Ensure address column exists on units table
-- (Some code paths use 'address', but base schema only has 'address_line_1')
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'units' AND column_name = 'address'
  ) THEN
    ALTER TABLE units ADD COLUMN address TEXT;
    UPDATE units SET address = address_line_1 WHERE address IS NULL AND address_line_1 IS NOT NULL;
    RAISE NOTICE 'Added address column to units table';
  END IF;
END $$;

-- ============================================================
-- PART A: Ensure development names are correct (idempotent)
-- ============================================================
DO $$
DECLARE v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM admins WHERE email = 'sam@evolvai.ie' LIMIT 1;
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'Tenant for sam@evolvai.ie not found'; END IF;

  UPDATE developments SET name = 'Longview Park'
    WHERE name NOT IN ('Longview Park','Árdan View','Rathárd Park','Rathárd Lawn','Harbour View Apartments')
    AND (name ILIKE '%meadow%' OR name ILIKE '%longview%')
    AND tenant_id = v_tenant_id;
  UPDATE developments SET name = 'Árdan View'
    WHERE name NOT IN ('Longview Park','Árdan View','Rathárd Park','Rathárd Lawn','Harbour View Apartments')
    AND (name ILIKE '%oak hill%' OR name ILIKE '%ardan%' OR name ILIKE '%árdan%')
    AND tenant_id = v_tenant_id;
  UPDATE developments SET name = 'Rathárd Park'
    WHERE name NOT IN ('Longview Park','Árdan View','Rathárd Park','Rathárd Lawn','Harbour View Apartments')
    AND (name ILIKE '%riverside%' OR name ILIKE '%rathard park%' OR name ILIKE '%rathárd park%')
    AND tenant_id = v_tenant_id;
  UPDATE developments SET name = 'Rathárd Lawn'
    WHERE name NOT IN ('Longview Park','Árdan View','Rathárd Park','Rathárd Lawn','Harbour View Apartments')
    AND (name ILIKE '%willow%' OR name ILIKE '%rathard lawn%' OR name ILIKE '%rathárd lawn%')
    AND tenant_id = v_tenant_id;

  RAISE NOTICE 'Development names verified for tenant %', v_tenant_id;
END $$;

-- ============================================================
-- PART B: Link units to correct development_id by address
-- Uses address_line_1 (guaranteed column) with fallback to address
-- DO NOT touch Harbour View Apartments units
-- ============================================================

-- Longview Park
UPDATE units SET development_id = d.id
FROM developments d
WHERE d.name = 'Longview Park'
  AND (units.address_line_1 ILIKE '%Longview Park%' OR COALESCE(units.address, '') ILIKE '%Longview Park%')
  AND units.development_id IS DISTINCT FROM d.id;

-- Árdan View (match both fada and non-fada)
UPDATE units SET development_id = d.id
FROM developments d
WHERE d.name = 'Árdan View'
  AND (units.address_line_1 ILIKE '%rdan View%' OR COALESCE(units.address, '') ILIKE '%rdan View%')
  AND units.development_id IS DISTINCT FROM d.id;

-- Rathárd Park (but NOT Rathárd Lawn)
UPDATE units SET development_id = d.id
FROM developments d
WHERE d.name = 'Rathárd Park'
  AND (units.address_line_1 ILIKE '%athard Park%' OR units.address_line_1 ILIKE '%athárd Park%'
    OR COALESCE(units.address, '') ILIKE '%athard Park%' OR COALESCE(units.address, '') ILIKE '%athárd Park%')
  AND NOT (units.address_line_1 ILIKE '%Lawn%' OR COALESCE(units.address, '') ILIKE '%Lawn%')
  AND units.development_id IS DISTINCT FROM d.id;

-- Rathárd Lawn
UPDATE units SET development_id = d.id
FROM developments d
WHERE d.name = 'Rathárd Lawn'
  AND (units.address_line_1 ILIKE '%athard Lawn%' OR units.address_line_1 ILIKE '%athárd Lawn%'
    OR COALESCE(units.address, '') ILIKE '%athard Lawn%' OR COALESCE(units.address, '') ILIKE '%athárd Lawn%')
  AND units.development_id IS DISTINCT FROM d.id;

-- Also update tenant_id on units to match their development
UPDATE units SET tenant_id = d.tenant_id
FROM developments d
WHERE units.development_id = d.id
  AND units.tenant_id IS DISTINCT FROM d.tenant_id;

-- ============================================================
-- PART C: Create pipeline records for ALL non-available units
-- Uses ON CONFLICT (unit_id) DO UPDATE to be idempotent
-- Pipeline records are what make units appear in the pipeline view
-- ============================================================

-- Create pipeline records for all units that have a status indicating
-- they should be in the pipeline (complete, sale_agreed, in_progress, social_housing)
-- Skip available/null status units
INSERT INTO unit_sales_pipeline (id, tenant_id, development_id, unit_id, purchaser_name, release_date)
SELECT
  gen_random_uuid(),
  u.tenant_id,
  u.development_id,
  u.id,
  u.purchaser_name,
  NOW()
FROM units u
JOIN developments d ON u.development_id = d.id
WHERE d.name IN ('Longview Park', 'Árdan View', 'Rathárd Park', 'Rathárd Lawn')
  AND u.unit_status IS NOT NULL
  AND u.unit_status != 'available'
ON CONFLICT (unit_id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  development_id = EXCLUDED.development_id,
  purchaser_name = EXCLUDED.purchaser_name;

-- ============================================================
-- PART D: Árdan View — Update pipeline records with real dates
-- Source: N5_Data (Sales Progress - N5) spreadsheet
-- ============================================================
UPDATE unit_sales_pipeline SET
    sale_price = 485000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-11-10'::timestamptz,
    sale_agreed_date = '2025-11-11'::timestamptz,
    contracts_issued_date = '2025-11-11'::timestamptz,
    queries_raised_date = '2025-11-14'::timestamptz,
    queries_replied_date = '2025-11-19'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '1'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 445000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-11-26'::timestamptz,
    sale_agreed_date = '2025-11-26'::timestamptz,
    contracts_issued_date = '2025-11-27'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '3'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 445000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-10-10'::timestamptz,
    sale_agreed_date = '2025-10-10'::timestamptz,
    contracts_issued_date = '2025-10-13'::timestamptz,
    queries_raised_date = '2025-12-02'::timestamptz,
    queries_replied_date = '2025-12-10'::timestamptz,
    signed_contracts_date = '2026-01-16'::timestamptz,
    counter_signed_date = '2026-01-16'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '4'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 445000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-10-19'::timestamptz,
    sale_agreed_date = '2025-10-20'::timestamptz,
    contracts_issued_date = '2025-11-04'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '5'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 445000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-10-20'::timestamptz,
    sale_agreed_date = '2025-10-20'::timestamptz,
    contracts_issued_date = '2025-10-21'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '6'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 485000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-09-15'::timestamptz,
    sale_agreed_date = '2025-09-15'::timestamptz,
    contracts_issued_date = '2025-09-19'::timestamptz,
    signed_contracts_date = '2025-10-03'::timestamptz,
    counter_signed_date = '2025-10-14'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '8'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 500000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-12-22'::timestamptz,
    sale_agreed_date = '2025-12-23'::timestamptz,
    contracts_issued_date = '2025-12-22'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '9'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 445000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-09-17'::timestamptz,
    sale_agreed_date = '2025-09-17'::timestamptz,
    contracts_issued_date = '2025-09-22'::timestamptz,
    queries_raised_date = '2025-09-25'::timestamptz,
    queries_replied_date = '2025-10-13'::timestamptz,
    signed_contracts_date = '2025-11-10'::timestamptz,
    counter_signed_date = '2025-11-12'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '10'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 445000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-09-15'::timestamptz,
    sale_agreed_date = '2025-09-16'::timestamptz,
    contracts_issued_date = '2025-09-22'::timestamptz,
    queries_raised_date = '2025-10-07'::timestamptz,
    queries_replied_date = '2025-10-22'::timestamptz,
    signed_contracts_date = '2025-11-17'::timestamptz,
    counter_signed_date = '2025-11-18'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '12'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 445000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-10-01'::timestamptz,
    sale_agreed_date = '2025-10-02'::timestamptz,
    contracts_issued_date = '2025-10-02'::timestamptz,
    queries_raised_date = '2025-10-15'::timestamptz,
    queries_replied_date = '2025-10-21'::timestamptz,
    signed_contracts_date = '2025-12-03'::timestamptz,
    counter_signed_date = '2025-12-05'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '13'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 485000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-10-03'::timestamptz,
    sale_agreed_date = '2025-10-03'::timestamptz,
    contracts_issued_date = '2025-10-03'::timestamptz,
    queries_raised_date = '2025-10-08'::timestamptz,
    signed_contracts_date = '2025-10-16'::timestamptz,
    counter_signed_date = '2025-10-20'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '15'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 530000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-12-15'::timestamptz,
    sale_agreed_date = '2025-12-15'::timestamptz,
    contracts_issued_date = '2025-12-15'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '16'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 445000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-09-17'::timestamptz,
    sale_agreed_date = '2025-09-18'::timestamptz,
    contracts_issued_date = '2025-09-22'::timestamptz,
    queries_raised_date = '2025-10-09'::timestamptz,
    queries_replied_date = '2025-10-13'::timestamptz,
    signed_contracts_date = '2025-12-19'::timestamptz,
    counter_signed_date = '2026-01-08'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '17'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 445000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-11-10'::timestamptz,
    sale_agreed_date = '2025-11-11'::timestamptz,
    contracts_issued_date = '2025-11-11'::timestamptz,
    queries_raised_date = '2025-11-18'::timestamptz,
    queries_replied_date = '2025-11-28'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '18'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 445000,
    release_date = '2025-09-12'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '19'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 445000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2026-01-21'::timestamptz,
    sale_agreed_date = '2026-01-22'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '20'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 445000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2026-01-13'::timestamptz,
    sale_agreed_date = '2026-01-13'::timestamptz,
    contracts_issued_date = '2026-01-14'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '21'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 445000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-10-17'::timestamptz,
    sale_agreed_date = '2025-10-20'::timestamptz,
    contracts_issued_date = '2025-10-20'::timestamptz,
    signed_contracts_date = '2025-01-12'::timestamptz,
    counter_signed_date = '2025-01-12'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '22'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 445000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-12-10'::timestamptz,
    sale_agreed_date = '2025-12-12'::timestamptz,
    contracts_issued_date = '2025-12-12'::timestamptz,
    signed_contracts_date = '2025-01-12'::timestamptz,
    counter_signed_date = '2025-01-12'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '23'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 445000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-12-18'::timestamptz,
    sale_agreed_date = '2025-12-19'::timestamptz,
    contracts_issued_date = '2025-12-22'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '24'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 445000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-10-20'::timestamptz,
    sale_agreed_date = '2025-10-28'::timestamptz,
    contracts_issued_date = '2025-10-28'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '25'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 445000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-01-09'::timestamptz,
    sale_agreed_date = '2026-01-12'::timestamptz,
    contracts_issued_date = '2026-01-12'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '26'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 430000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-11-03'::timestamptz,
    sale_agreed_date = '2025-11-04'::timestamptz,
    contracts_issued_date = '2025-11-04'::timestamptz,
    queries_raised_date = '2025-11-14'::timestamptz,
    queries_replied_date = '2025-11-19'::timestamptz,
    signed_contracts_date = '2025-12-09'::timestamptz,
    counter_signed_date = '2025-12-10'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '27'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 335000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-09-15'::timestamptz,
    sale_agreed_date = '2025-09-15'::timestamptz,
    contracts_issued_date = '2025-09-19'::timestamptz,
    queries_raised_date = '2025-09-29'::timestamptz,
    queries_replied_date = '2025-10-14'::timestamptz,
    signed_contracts_date = '2025-10-24'::timestamptz,
    counter_signed_date = '2025-10-29'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '28'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 335000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-10-23'::timestamptz,
    sale_agreed_date = '2025-10-23'::timestamptz,
    contracts_issued_date = '2025-10-28'::timestamptz,
    queries_raised_date = '2025-11-10'::timestamptz,
    queries_replied_date = '2025-11-19'::timestamptz,
    signed_contracts_date = '2025-11-27'::timestamptz,
    counter_signed_date = '2025-11-28'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '29'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 445000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-09-15'::timestamptz,
    sale_agreed_date = '2025-09-15'::timestamptz,
    contracts_issued_date = '2025-09-22'::timestamptz,
    queries_raised_date = '2025-09-25'::timestamptz,
    queries_replied_date = '2025-10-10'::timestamptz,
    signed_contracts_date = '2025-11-05'::timestamptz,
    counter_signed_date = '2025-11-13'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '31'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 445000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-09-12'::timestamptz,
    sale_agreed_date = '2025-09-12'::timestamptz,
    contracts_issued_date = '2025-09-19'::timestamptz,
    queries_raised_date = '2025-10-10'::timestamptz,
    queries_replied_date = '2025-10-15'::timestamptz,
    signed_contracts_date = '2025-10-31'::timestamptz,
    counter_signed_date = '2025-11-04'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '32'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 480000,
    release_date = '2025-11-17'::timestamptz,
    deposit_date = '2025-12-11'::timestamptz,
    sale_agreed_date = '2025-12-12'::timestamptz,
    contracts_issued_date = '2025-12-12'::timestamptz,
    handover_date = '2026-03-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '33'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 335000,
    release_date = '2025-11-17'::timestamptz,
    deposit_date = '2025-11-25'::timestamptz,
    sale_agreed_date = '2025-11-25'::timestamptz,
    contracts_issued_date = '2025-11-25'::timestamptz,
    queries_raised_date = '2025-11-27'::timestamptz,
    queries_replied_date = '2025-11-28'::timestamptz,
    signed_contracts_date = '2025-01-09'::timestamptz,
    counter_signed_date = '2025-01-09'::timestamptz,
    handover_date = '2026-03-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '34'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 335000,
    release_date = '2025-11-17'::timestamptz,
    deposit_date = '2025-12-15'::timestamptz,
    sale_agreed_date = '2025-12-15'::timestamptz,
    contracts_issued_date = '2025-12-16'::timestamptz,
    handover_date = '2026-03-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '35'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 335000,
    release_date = '2025-11-17'::timestamptz,
    deposit_date = '2025-11-28'::timestamptz,
    sale_agreed_date = '2025-11-29'::timestamptz,
    contracts_issued_date = '2025-12-08'::timestamptz,
    handover_date = '2026-03-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '38'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 335000,
    release_date = '2025-11-17'::timestamptz,
    deposit_date = '2025-11-29'::timestamptz,
    sale_agreed_date = '2025-12-01'::timestamptz,
    contracts_issued_date = '2025-12-02'::timestamptz,
    signed_contracts_date = '2026-01-14'::timestamptz,
    counter_signed_date = '2026-01-14'::timestamptz,
    handover_date = '2026-03-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '39'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 415000,
    release_date = '2025-11-17'::timestamptz,
    deposit_date = '2025-12-01'::timestamptz,
    sale_agreed_date = '2025-12-01'::timestamptz,
    contracts_issued_date = '2025-12-02'::timestamptz,
    queries_raised_date = '2026-01-08'::timestamptz,
    handover_date = '2026-03-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '40'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 335000,
    release_date = '2025-11-17'::timestamptz,
    deposit_date = '2025-11-24'::timestamptz,
    sale_agreed_date = '2025-11-25'::timestamptz,
    contracts_issued_date = '2025-11-27'::timestamptz,
    queries_raised_date = '2025-12-05'::timestamptz,
    queries_replied_date = '2025-12-11'::timestamptz,
    signed_contracts_date = '2026-01-13'::timestamptz,
    counter_signed_date = '2026-01-13'::timestamptz,
    handover_date = '2026-03-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '44'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 335000,
    release_date = '2025-11-17'::timestamptz,
    deposit_date = '2025-11-26'::timestamptz,
    sale_agreed_date = '2025-11-26'::timestamptz,
    contracts_issued_date = '2025-11-27'::timestamptz,
    queries_raised_date = '2025-12-03'::timestamptz,
    queries_replied_date = '2025-12-10'::timestamptz,
    handover_date = '2026-03-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '45'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 430000,
    release_date = '2025-11-17'::timestamptz,
    handover_date = '2026-03-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '47'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 335000,
    release_date = '2026-01-15'::timestamptz,
    handover_date = '2026-04-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '51'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 335000,
    release_date = '2026-01-15'::timestamptz,
    deposit_date = '2026-01-15'::timestamptz,
    sale_agreed_date = '2026-01-16'::timestamptz,
    contracts_issued_date = '2026-01-20'::timestamptz,
    handover_date = '2026-04-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '52'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 425000,
    release_date = '2026-01-15'::timestamptz,
    deposit_date = '2026-01-21'::timestamptz,
    sale_agreed_date = '2026-01-22'::timestamptz,
    handover_date = '2026-04-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '54'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 485000,
    release_date = '2026-01-15'::timestamptz,
    deposit_date = '2026-01-21'::timestamptz,
    sale_agreed_date = '2026-01-22'::timestamptz,
    handover_date = '2026-04-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '55'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 415000,
    release_date = '2026-01-15'::timestamptz,
    deposit_date = '2026-01-16'::timestamptz,
    sale_agreed_date = '2026-01-16'::timestamptz,
    contracts_issued_date = '2026-01-20'::timestamptz,
    handover_date = '2026-04-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '57'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 335000,
    release_date = '2026-01-15'::timestamptz,
    handover_date = '2026-04-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '58'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 485000,
    release_date = '2026-01-15'::timestamptz,
    deposit_date = '2026-01-15'::timestamptz,
    sale_agreed_date = '2026-01-16'::timestamptz,
    contracts_issued_date = '2026-01-20'::timestamptz,
    handover_date = '2026-04-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '60'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 495000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-10-11'::timestamptz,
    sale_agreed_date = '2025-10-13'::timestamptz,
    contracts_issued_date = '2025-10-14'::timestamptz,
    queries_raised_date = '2025-10-22'::timestamptz,
    queries_replied_date = '2025-10-23'::timestamptz,
    signed_contracts_date = '2025-12-19'::timestamptz,
    counter_signed_date = '2025-12-19'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '61'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 495000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-10-21'::timestamptz,
    sale_agreed_date = '2025-10-21'::timestamptz,
    contracts_issued_date = '2025-10-22'::timestamptz,
    queries_raised_date = '2025-11-04'::timestamptz,
    queries_replied_date = '2025-11-07'::timestamptz,
    signed_contracts_date = '2025-12-11'::timestamptz,
    counter_signed_date = '2025-12-18'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '62'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 425000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2026-01-19'::timestamptz,
    sale_agreed_date = '2026-01-20'::timestamptz,
    contracts_issued_date = '2026-01-20'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '63'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 410000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-09-18'::timestamptz,
    sale_agreed_date = '2025-09-23'::timestamptz,
    contracts_issued_date = '2025-09-26'::timestamptz,
    queries_raised_date = '2025-10-07'::timestamptz,
    queries_replied_date = '2025-10-22'::timestamptz,
    signed_contracts_date = '2025-11-18'::timestamptz,
    counter_signed_date = '2025-11-19'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '64'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 335000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-09-15'::timestamptz,
    sale_agreed_date = '2025-09-15'::timestamptz,
    contracts_issued_date = '2025-09-26'::timestamptz,
    queries_raised_date = '2025-10-06'::timestamptz,
    queries_replied_date = '2025-10-21'::timestamptz,
    signed_contracts_date = '2025-11-25'::timestamptz,
    counter_signed_date = '2025-11-28'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '65'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 335000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-11-11'::timestamptz,
    sale_agreed_date = '2025-11-11'::timestamptz,
    contracts_issued_date = '2025-11-12'::timestamptz,
    signed_contracts_date = '2026-01-13'::timestamptz,
    counter_signed_date = '2026-01-13'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '66'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 410000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-09-15'::timestamptz,
    sale_agreed_date = '2025-09-15'::timestamptz,
    contracts_issued_date = '2025-09-26'::timestamptz,
    signed_contracts_date = '2025-10-31'::timestamptz,
    counter_signed_date = '2025-11-04'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '67'
    LIMIT 1
  );
UPDATE unit_sales_pipeline SET
    sale_price = 475000,
    release_date = '2025-09-12'::timestamptz,
    deposit_date = '2025-10-03'::timestamptz,
    sale_agreed_date = '2025-10-03'::timestamptz,
    contracts_issued_date = '2025-10-13'::timestamptz,
    handover_date = '2026-02-01'::timestamptz
  WHERE unit_id = (
    SELECT u.id FROM units u
    JOIN developments d ON u.development_id = d.id
    WHERE d.name = 'Árdan View' AND u.unit_number = '68'
    LIMIT 1
  );

-- ============================================================
-- PART E: Ensure available units with purchasers also get pipeline records
-- (Showhouses, Longview Estates, etc.)
-- ============================================================
INSERT INTO unit_sales_pipeline (id, tenant_id, development_id, unit_id, purchaser_name, release_date)
SELECT
  gen_random_uuid(),
  u.tenant_id,
  u.development_id,
  u.id,
  u.purchaser_name,
  NOW()
FROM units u
JOIN developments d ON u.development_id = d.id
WHERE d.name IN ('Longview Park', 'Árdan View', 'Rathárd Park', 'Rathárd Lawn')
  AND (u.unit_status = 'available' AND u.purchaser_name IS NOT NULL AND u.purchaser_name != '')
ON CONFLICT (unit_id) DO NOTHING;

-- ============================================================
-- PART F: Clean up any orphaned pipeline records
-- Remove pipeline records where the unit's development_id doesn't match
-- ============================================================
DELETE FROM unit_sales_pipeline usp
WHERE usp.development_id != (SELECT u.development_id FROM units u WHERE u.id = usp.unit_id)
  AND EXISTS (SELECT 1 FROM units u WHERE u.id = usp.unit_id);

-- Update pipeline records with correct development_id
UPDATE unit_sales_pipeline usp SET
  development_id = u.development_id,
  tenant_id = u.tenant_id
FROM units u
WHERE usp.unit_id = u.id
  AND (usp.development_id != u.development_id OR usp.tenant_id != u.tenant_id);

-- ============================================================
-- PART G: Verification queries
-- ============================================================

-- 1. Development overview
SELECT d.name,
  COUNT(u.id) as total_units,
  SUM(CASE WHEN u.unit_status='complete' THEN 1 ELSE 0 END) as complete,
  SUM(CASE WHEN u.unit_status='sale_agreed' THEN 1 ELSE 0 END) as sale_agreed,
  SUM(CASE WHEN u.unit_status='in_progress' THEN 1 ELSE 0 END) as in_progress,
  SUM(CASE WHEN u.unit_status='available' THEN 1 ELSE 0 END) as available,
  SUM(CASE WHEN u.unit_status='social_housing' THEN 1 ELSE 0 END) as social_housing
FROM developments d
LEFT JOIN units u ON u.development_id = d.id
GROUP BY d.id, d.name
ORDER BY d.name;

-- 2. Pipeline records per development
SELECT d.name,
  COUNT(usp.id) as pipeline_records,
  COUNT(CASE WHEN usp.release_date IS NOT NULL THEN 1 END) as released,
  COUNT(CASE WHEN usp.handover_date IS NOT NULL THEN 1 END) as handed_over
FROM developments d
LEFT JOIN unit_sales_pipeline usp ON usp.development_id = d.id
GROUP BY d.id, d.name
ORDER BY d.name;

-- 3. Available count check (should NOT be negative)
SELECT d.name,
  COUNT(u.id) as total_units,
  (SELECT COUNT(*) FROM unit_sales_pipeline WHERE development_id = d.id AND release_date IS NOT NULL) as released,
  COUNT(u.id) - (SELECT COUNT(*) FROM unit_sales_pipeline WHERE development_id = d.id AND release_date IS NOT NULL) as available_calc
FROM developments d
LEFT JOIN units u ON u.development_id = d.id
GROUP BY d.id, d.name
ORDER BY d.name;

COMMIT;
