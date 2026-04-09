-- ============================================================================
-- MIGRATION 037: Add missing columns to units table
-- Run in Supabase SQL Editor against project mddxbilpjukwskeefakz
--
-- ALREADY EXECUTED 2026-04-09 via Supabase MCP
--
-- Root cause: The Drizzle ORM schema (packages/db/schema.ts) defines columns
-- that don't exist in the actual DB units table. This causes SELECT * to fail
-- silently, making the pipeline drill-down return "0 units".
--
-- The overview page works because it only does SELECT COUNT(*).
-- ============================================================================

ALTER TABLE units ADD COLUMN IF NOT EXISTS state_province TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS property_designation TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS property_type TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS square_footage INTEGER;
ALTER TABLE units ADD COLUMN IF NOT EXISTS floor_area_m2 NUMERIC(10,2);
ALTER TABLE units ADD COLUMN IF NOT EXISTS purchaser_email TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS purchaser_phone TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;
ALTER TABLE units ADD COLUMN IF NOT EXISTS mrpn TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS electricity_account TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS esb_eirgrid_number TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS last_chat_at TIMESTAMPTZ;
ALTER TABLE units ADD COLUMN IF NOT EXISTS important_docs_agreed_version INTEGER DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS important_docs_agreed_at TIMESTAMPTZ;
