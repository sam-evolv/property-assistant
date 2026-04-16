-- ============================================================================
-- MIGRATION 041: Normalise Care installation demo data
-- Run manually in the Supabase SQL Editor.
--
-- Context: Pre-meeting cleanup for the SE Systems Cork demo.
--   1. Rename the placeholder reference SE-2024-DEMO-001 to SE-2024-0847, set
--      a realistic Cork address and add the Mitsubishi Ecodan inverter model.
--   2. Normalise any health_status value of 'activated' to 'active' so the
--      status column is consistent across rows (PL-2023-0014 was the outlier).
-- ============================================================================

UPDATE public.installations
SET
  job_reference   = 'SE-2024-0847',
  address_line_1  = '23 Millbrook Gardens',
  city            = 'Douglas',
  county          = 'Cork',
  system_type     = 'heat_pump',
  system_size_kwp = NULL,
  inverter_model  = 'Mitsubishi Ecodan 8 kW'
WHERE job_reference = 'SE-2024-DEMO-001';

UPDATE public.installations
SET health_status = 'active'
WHERE health_status = 'activated';
