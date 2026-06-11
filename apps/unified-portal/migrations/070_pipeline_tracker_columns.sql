-- ============================================================================
-- MIGRATION 070: Pipeline tracker columns (solicitor + transactional dates)
-- Run this in the Supabase SQL Editor.
--
-- Context: developers run their schemes on a ~23-column sales tracker
-- (solicitor info, SADRL, proof of funds, deposit receipt, loan approval,
-- one-part contract returned, projected handover, snagging start, mortgage
-- expiry). These columns complete unit_sales_pipeline so the whole tracker
-- imports in one drop and is editable in the pipeline grid.
-- Queries dates, sale_type, housing_agency and sale_price were already added
-- in migration 033. All columns are additive and nullable.
-- ============================================================================

ALTER TABLE unit_sales_pipeline
  ADD COLUMN IF NOT EXISTS solicitor_firm TEXT,
  ADD COLUMN IF NOT EXISTS solicitor_name TEXT,
  ADD COLUMN IF NOT EXISTS solicitor_email TEXT,
  ADD COLUMN IF NOT EXISTS solicitor_phone TEXT,
  ADD COLUMN IF NOT EXISTS sadrl_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proof_of_funds_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deposit_receipt_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS loan_approved_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS one_part_returned_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS projected_handover_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS snagging_start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mortgage_expiry_date TIMESTAMPTZ;

-- Audit pairs for the new stage-like dates (matches the existing pattern)
ALTER TABLE unit_sales_pipeline
  ADD COLUMN IF NOT EXISTS sadrl_updated_by UUID REFERENCES admins(id),
  ADD COLUMN IF NOT EXISTS sadrl_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proof_of_funds_updated_by UUID REFERENCES admins(id),
  ADD COLUMN IF NOT EXISTS proof_of_funds_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deposit_receipt_updated_by UUID REFERENCES admins(id),
  ADD COLUMN IF NOT EXISTS deposit_receipt_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS loan_approved_updated_by UUID REFERENCES admins(id),
  ADD COLUMN IF NOT EXISTS loan_approved_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS one_part_returned_updated_by UUID REFERENCES admins(id),
  ADD COLUMN IF NOT EXISTS one_part_returned_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS snagging_start_updated_by UUID REFERENCES admins(id),
  ADD COLUMN IF NOT EXISTS snagging_start_updated_at TIMESTAMPTZ;

-- Mortgage expiry is the date most worth alerting on
CREATE INDEX IF NOT EXISTS unit_pipeline_mortgage_expiry_idx
  ON unit_sales_pipeline (mortgage_expiry_date)
  WHERE mortgage_expiry_date IS NOT NULL;

-- Scheme phase on units (Property Designation already exists)
ALTER TABLE units
  ADD COLUMN IF NOT EXISTS phase TEXT;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'unit_sales_pipeline'
  AND column_name IN (
    'solicitor_firm', 'solicitor_name', 'solicitor_email', 'solicitor_phone',
    'sadrl_date', 'proof_of_funds_date', 'deposit_receipt_date',
    'loan_approved_date', 'one_part_returned_date', 'projected_handover_date',
    'snagging_start_date', 'mortgage_expiry_date'
  )
ORDER BY column_name;
