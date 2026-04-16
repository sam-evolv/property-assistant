-- Seed three example third-party uploads for the SE Systems Cork demo.
-- Run manually in the Supabase SQL Editor after 039_care_third_party_uploads.sql.

do $$
declare
  v_tenant_id uuid;
begin
  select id into v_tenant_id from public.tenants where name = 'SE Systems Cork' limit 1;
  if v_tenant_id is null then
    insert into public.tenants(name) values ('SE Systems Cork') returning id into v_tenant_id;
  end if;

  -- 1. Pending, 2 hours ago, Liam Walsh (Mitsubishi Ecodan commissioning)
  insert into public.care_third_party_uploads (
    installer_tenant_id, submitter_name, submitter_company, submitter_email,
    submitter_phone, job_reference, property_address, job_type,
    document_name, document_category, document_size_bytes, storage_path,
    status, created_at, updated_at
  )
  select
    v_tenant_id,
    'Liam Walsh',
    'Walsh Plumbing & Heating Ltd',
    'liam@walshplumbing.ie',
    '+353 87 123 4567',
    'SE-2026-0412',
    '17 Willow Grove, Douglas, Cork',
    'Heat Pump Installation',
    'Mitsubishi Ecodan Commissioning Cert — 17 Willow Grove, Douglas.pdf',
    'Commissioning Certificate',
    1258291,
    'seed/liam-walsh/SE-2026-0412-mitsubishi-commissioning.pdf',
    'pending',
    now() - interval '2 hours',
    now() - interval '2 hours'
  where not exists (
    select 1 from public.care_third_party_uploads
    where job_reference = 'SE-2026-0412'
      and document_name = 'Mitsubishi Ecodan Commissioning Cert — 17 Willow Grove, Douglas.pdf'
  );

  -- 2. Pending, 1 day ago, Sarah Kelly (SEAI grant, no job reference)
  insert into public.care_third_party_uploads (
    installer_tenant_id, submitter_name, submitter_company, submitter_email,
    submitter_phone, job_reference, property_address, job_type,
    document_name, document_category, document_size_bytes, storage_path,
    status, created_at, updated_at
  )
  select
    v_tenant_id,
    'Sarah Kelly',
    'Kelly Electrical',
    'sarah@kellyelectrical.ie',
    '+353 86 555 1234',
    null,
    '42 Westgate Avenue, Bishopstown, Cork',
    'Solar PV Installation',
    'SEAI Grant Confirmation — SE003291.pdf',
    'SEAI Grant Documentation',
    348160,
    'seed/sarah-kelly/SE003291-seai-grant.pdf',
    'pending',
    now() - interval '1 day',
    now() - interval '1 day'
  where not exists (
    select 1 from public.care_third_party_uploads
    where submitter_email = 'sarah@kellyelectrical.ie'
      and document_name = 'SEAI Grant Confirmation — SE003291.pdf'
  );

  -- 3. Approved (not yet filed), 3 days ago, Daniel O'Brien (Panasonic warranty)
  insert into public.care_third_party_uploads (
    installer_tenant_id, submitter_name, submitter_company, submitter_email,
    submitter_phone, job_reference, property_address, job_type,
    document_name, document_category, document_size_bytes, storage_path,
    status, reviewed_at, created_at, updated_at
  )
  select
    v_tenant_id,
    'Daniel O''Brien',
    'OB Renewables',
    'daniel@obrenewables.ie',
    '+353 85 222 3344',
    'SE-2026-0389',
    null,
    'Heat Pump Installation',
    'Panasonic Aquarea Warranty Pack.pdf',
    'Manufacturer Warranty',
    911360,
    'seed/daniel-obrien/SE-2026-0389-panasonic-warranty.pdf',
    'approved',
    now() - interval '2 days',
    now() - interval '3 days',
    now() - interval '2 days'
  where not exists (
    select 1 from public.care_third_party_uploads
    where job_reference = 'SE-2026-0389'
      and document_name = 'Panasonic Aquarea Warranty Pack.pdf'
  );
end $$;
