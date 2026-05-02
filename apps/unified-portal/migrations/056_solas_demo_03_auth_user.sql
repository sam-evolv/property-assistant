-- Solas Renewables demo tenant: create auth user + admin profile.
-- Mirrors the structure of sesystems@test.ie (admins.id == auth.users.id, role=admin, preferred_role=installer).

-- Fixed UUID for solas-demo@test.ie so the admins join is deterministic.
DO $$
DECLARE
  v_user_id  uuid := 'f1e2d3c4-b5a6-7890-fedc-ba9876543210';
  v_tenant   uuid := 'c1d2e3f4-a5b6-7890-cdef-123456789012';
  v_email    text := 'solas-demo@test.ie';
  v_password text := 'caretest123';
BEGIN
  -- 1. Auth user (bcrypt password via pgcrypto, email pre-confirmed for demo).
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, is_sso_user
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_password, gen_salt('bf')),
    now(), now(), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    false,
    false
  );

  -- 2. Identity row (Supabase requires this for password sign-in).
  INSERT INTO auth.identities (
    id, user_id, provider, provider_id, identity_data,
    last_sign_in_at, created_at, updated_at
  )
  VALUES (
    gen_random_uuid(),
    v_user_id,
    'email',
    v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    NULL, now(), now()
  );

  -- 3. Admin profile row, linking the user to the Solas tenant.
  INSERT INTO public.admins (id, tenant_id, email, role, preferred_role, created_at)
  VALUES (v_user_id, v_tenant, v_email, 'admin', 'installer', now());
END $$;
