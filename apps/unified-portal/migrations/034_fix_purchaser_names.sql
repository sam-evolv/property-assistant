-- ============================================================================
-- MIGRATION 034: Replace "Demo Purchaser" placeholder names with Irish names
-- Run this in the Supabase SQL Editor
--
-- Context: Kitchen Selections and Compliance pages show "Demo Purchaser 1f19"
-- style placeholder names. This replaces them with believable Irish names
-- for the demo tenant before the Hollybrook client call.
-- ============================================================================

DO $$
DECLARE
  v_unit RECORD;
  v_names TEXT[] := ARRAY[
    'John Murphy',
    'Sarah O''Brien',
    'Conor Walsh',
    'Aoife Kelly',
    'Liam Byrne',
    'Niamh Doyle',
    'Seán Fitzgerald',
    'Emma Ryan',
    'Patrick Connolly',
    'Ciara Gallagher',
    'Eoin McCarthy',
    'Sinéad Brennan',
    'Darragh O''Sullivan',
    'Fiona Nolan',
    'Ronan Healy',
    'Orla Quinn',
    'Ciarán Kennedy',
    'Mairéad Lynch',
    'Declan O''Connor',
    'Aisling Burke',
    'Brendan Murray',
    'Rachel Sheridan',
    'Tadhg Flanagan',
    'Laura Doherty',
    'Kevin O''Reilly',
    'Caoimhe Moran',
    'Fergal Brady',
    'Siobhán Clarke',
    'Cormac Higgins',
    'Áine Foley'
  ];
  v_idx INTEGER := 1;
BEGIN
  FOR v_unit IN
    SELECT id
    FROM units
    WHERE purchaser_name ILIKE 'Demo Purchaser%'
    ORDER BY unit_number ASC
  LOOP
    UPDATE units
    SET purchaser_name = v_names[v_idx]
    WHERE id = v_unit.id;

    -- Cycle through the names list
    v_idx := v_idx + 1;
    IF v_idx > array_length(v_names, 1) THEN
      v_idx := 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Updated purchaser names. Rows affected: %',
    (SELECT COUNT(*) FROM units WHERE purchaser_name NOT ILIKE 'Demo Purchaser%' AND purchaser_name IS NOT NULL);
END $$;

-- Also update unit_sales_pipeline purchaser_name to match
UPDATE unit_sales_pipeline usp
SET purchaser_name = u.purchaser_name
FROM units u
WHERE usp.unit_id = u.id
  AND u.purchaser_name IS NOT NULL
  AND (usp.purchaser_name ILIKE 'Demo Purchaser%' OR usp.purchaser_name IS NULL);

-- Verify
SELECT COUNT(*) AS remaining_demo_names
FROM units
WHERE purchaser_name ILIKE 'Demo Purchaser%';
