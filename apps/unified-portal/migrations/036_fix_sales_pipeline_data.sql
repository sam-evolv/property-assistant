-- ============================================================================
-- MIGRATION 036: Fix Sales Pipeline — EXECUTED 2026-04-09
-- Run against Supabase project mddxbilpjukwskeefakz
--
-- This migration was executed directly via Supabase MCP.
-- Keeping this file as a record of what was done.
--
-- WARNING: DO NOT re-run — all changes are already applied.
-- ============================================================================

-- ============================================================
-- STEP 1: Fix pipeline development_id mismatches
-- 86 pipeline records for Rathárd Park actually belonged to Árdan View units.
-- This caused Rathárd Park to show -35 available units.
-- ============================================================
UPDATE unit_sales_pipeline usp
SET development_id = u.development_id, tenant_id = u.tenant_id
FROM units u
WHERE usp.unit_id = u.id
  AND (usp.development_id != u.development_id OR usp.tenant_id != u.tenant_id);

-- ============================================================
-- STEP 2: Fix Rathárd Park unit statuses and purchaser names
-- DB addresses use "Rathard Park" (no fada), so user's PART 2 SQL
-- with ILIKE '%Rathárd Park%' never matched. Still had fake names
-- from migration 034.
-- ============================================================

-- Units 1-12: Clúid (social housing)
UPDATE units SET unit_status = 'social_housing', purchaser_name = 'Clúid'
WHERE development_id = '84a559d1-89f1-4eb6-a48b-7ca068bcc164'
  AND unit_number IN ('1','2','3','4','5','6','7','8','9','10','11','12');

-- Private sales — complete
UPDATE units SET unit_status = 'complete', purchaser_name = CASE unit_number
  WHEN '13' THEN 'Ms Primitha Mohan and Mr Gireesh Nadesan'
  WHEN '14' THEN 'Jack Redmond and Megan Gallagher'
  WHEN '15' THEN E'Rory O''Connor'
  WHEN '16' THEN 'Alison Forde'
  WHEN '17' THEN 'Artur Supernak'
  WHEN '19' THEN 'Mr Hussain Tariq'
  WHEN '20' THEN 'Jayalakshmi Sridharan and Mr Nijin Punnakkan'
  WHEN '21' THEN 'Prashant and Shivangi Singh'
  WHEN '22' THEN 'Ms Lu Wang'
  WHEN '23' THEN 'Rustu and Ozlem Irki'
  WHEN '24' THEN 'Sila Gokdeniz Cuze and Ahmet Cuse'
  WHEN '26' THEN E'Sarah Clair and Cian O''Rourke'
  WHEN '27' THEN 'Mr Andrei Erokhin and Ms Anna Chapurgina'
  WHEN '28' THEN 'Mr Chahin Chahin and Mrs Hazel Kim'
  WHEN '29' THEN 'Ms Nicole Obrien and Mr Jordan Ahern'
  WHEN '30' THEN 'Ms Aimee Purtil'
  WHEN '32' THEN 'Wagas Malik and Neelam Afzal'
  WHEN '33' THEN 'Cyriac Stephen'
  WHEN '34' THEN 'Mr Bibin Joy and Ms Soniya Johny'
  WHEN '35' THEN 'Mark Gleeson and Megan Macmonagle'
  WHEN '36' THEN 'Ms Siji Scaria and Mr Senju George'
  WHEN '41' THEN 'Shane Curtin'
  WHEN '42' THEN 'Maheep Bhagwani and Riya Tripathi'
  WHEN '43' THEN 'Mr Vikram Sharma and Ms Monika Goswami'
  WHEN '44' THEN 'Dean Murray and Danielle Browne'
  WHEN '45' THEN 'Nima Sal Sudhan and Samuel Aldana Delgado'
  WHEN '46' THEN 'Shauna Ring'
  WHEN '47' THEN 'Amy Dolan'
  WHEN '49' THEN 'Ms Jaye Sharon Hechanova'
  WHEN '50' THEN 'Cait Hooley and Christopher Dilworth'
  WHEN '51' THEN 'Mr Bilgihan Celebi'
  WHEN '52' THEN 'Amani Younssi'
  WHEN '53' THEN 'Kristine J Aguas and Cheerson Aguas'
  ELSE purchaser_name
END
WHERE development_id = '84a559d1-89f1-4eb6-a48b-7ca068bcc164'
  AND unit_number IN ('13','14','15','16','17','19','20','21','22','23','24','26','27','28','29','30','32','33','34','35','36','41','42','43','44','45','46','47','49','50','51','52','53');

-- Sale agreed units
UPDATE units SET unit_status = 'sale_agreed', purchaser_name = CASE unit_number
  WHEN '18' THEN 'Vivek Verma and Maniska Kamal'
  WHEN '25' THEN 'Kayla Smith and Aidan King'
  WHEN '31' THEN 'Ruby Rajan and Renji Arayanparambil Jacob'
  WHEN '37' THEN E'Billy O''Gorman and Jessica O''Callaghan'
  WHEN '39' THEN 'Ms Smruti Amin and Mr Bharat Pareek'
  WHEN '40' THEN 'Mr Umesh Chand Pant'
  WHEN '48' THEN 'Patrick Puearai and Pamela'
  ELSE purchaser_name
END
WHERE development_id = '84a559d1-89f1-4eb6-a48b-7ca068bcc164'
  AND unit_number IN ('18','25','31','37','39','40','48');

-- ============================================================
-- STEP 3: Fix Rathárd Lawn unit statuses
-- All units were 'available'. Most are Clúid (social_housing).
-- ============================================================
UPDATE units SET unit_status = 'social_housing', purchaser_name = 'Clúid'
WHERE development_id = '39c49eeb-54a6-4b04-a16a-119012c531cb'
  AND unit_number NOT IN ('21','24','41');

UPDATE units SET unit_status = 'complete', purchaser_name = 'Alexandra Ioana Dogaru and Urko Ullande Reveluata'
WHERE development_id = '39c49eeb-54a6-4b04-a16a-119012c531cb' AND unit_number = '21';

UPDATE units SET unit_status = 'complete', purchaser_name = 'Ling Xin Xue and Yanting Wang'
WHERE development_id = '39c49eeb-54a6-4b04-a16a-119012c531cb' AND unit_number = '24';

UPDATE units SET unit_status = 'complete', purchaser_name = E'Michael O''Reilly'
WHERE development_id = '39c49eeb-54a6-4b04-a16a-119012c531cb' AND unit_number = '41';

-- ============================================================
-- STEP 4: Sync pipeline purchaser_name with units table
-- ============================================================
UPDATE unit_sales_pipeline usp
SET purchaser_name = u.purchaser_name
FROM units u
WHERE usp.unit_id = u.id
  AND u.purchaser_name IS NOT NULL
  AND (usp.purchaser_name IS DISTINCT FROM u.purchaser_name);

-- ============================================================
-- STEP 5: Fix Árdan View NULL address_line_1
-- These units had address in 'address' column but NULL address_line_1
-- ============================================================
UPDATE units SET address_line_1 = address
WHERE development_id = '34316432-f1e8-4297-b993-d9b5c88ee2d8'
  AND address_line_1 IS NULL
  AND address IS NOT NULL;

-- ============================================================
-- STEP 6: Set release_date on pipeline records missing it
-- Pipeline page counts "released" as having a release_date
-- ============================================================
UPDATE unit_sales_pipeline
SET release_date = NOW()
WHERE release_date IS NULL;

-- ============================================================
-- VERIFICATION (results as of 2026-04-09):
--
-- Árdan View:      86 units | 53 sale_agreed, 21 in_progress, 12 available | 86 pipeline records
-- Longview Park:   76 units | 61 complete, 2 available, 13 social_housing  | 76 pipeline records
-- Rathárd Park:    51 units | 33 complete, 7 sale_agreed, 11 social_housing | 51 pipeline records
-- Rathárd Lawn:    43 units | 3 complete, 40 social_housing                | 43 pipeline records
-- Harbour View:    12 units | (untouched)                                  | 4 pipeline records
-- ============================================================
