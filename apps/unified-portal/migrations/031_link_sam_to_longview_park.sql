-- Migration: Link sam@evolvai.ie to unit LP-008-9F9A (8 Longview Park)
-- Run manually in Supabase SQL Editor

-- Step 1: Set purchaser_email on the unit so the homeowner login finds it
UPDATE units
SET purchaser_email = 'sam@evolvai.ie',
    purchaser_name = 'Sam'
WHERE unit_code = 'LP-008-9F9A';

-- Step 2: If the user already exists in auth.users, create the user_contexts link
DO $$
DECLARE
  v_user_id UUID;
  v_unit_id UUID;
  v_address TEXT;
BEGIN
  -- Find the auth user
  SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = 'sam@evolvai.ie'
    LIMIT 1;

  -- Find the unit
  SELECT id, address_line_1 INTO v_unit_id, v_address
    FROM units
    WHERE unit_code = 'LP-008-9F9A'
    LIMIT 1;

  IF v_user_id IS NOT NULL AND v_unit_id IS NOT NULL THEN
    INSERT INTO user_contexts (
      auth_user_id, product, context_type, context_id,
      display_name, display_subtitle, display_icon, last_active_at, linked_at
    ) VALUES (
      v_user_id, 'homeowner', 'unit', v_unit_id,
      COALESCE(v_address, '8 Longview Park'), 'Homeowner', 'home',
      now(), now()
    )
    ON CONFLICT (auth_user_id, context_type, context_id) DO UPDATE
    SET display_name = COALESCE(v_address, '8 Longview Park'),
        last_active_at = now();

    RAISE NOTICE 'Linked user % to unit % (%)', v_user_id, v_unit_id, v_address;
  ELSE
    IF v_user_id IS NULL THEN
      RAISE NOTICE 'User sam@evolvai.ie not found in auth.users';
    END IF;
    IF v_unit_id IS NULL THEN
      RAISE NOTICE 'Unit LP-008-9F9A not found in units table';
    END IF;
  END IF;
END $$;

-- Verify
SELECT u.unit_code, u.address_line_1, u.purchaser_email, u.purchaser_name
FROM units u
WHERE u.unit_code = 'LP-008-9F9A';
