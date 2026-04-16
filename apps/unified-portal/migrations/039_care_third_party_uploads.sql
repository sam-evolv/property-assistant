-- Migration: Third-party installer upload portal
-- Creates the care_third_party_uploads table used by the public upload form
-- (portal.openhouseai.ie/care/sesystems/upload) and the Care Dashboard
-- Smart Archive Inbox at /care-dashboard/smart-archive/inbox.
--
-- Run manually in the Supabase SQL Editor. Run as a single query block.

create table if not exists public.care_third_party_uploads (
  id uuid primary key default gen_random_uuid(),
  installer_tenant_id uuid not null,
  submitter_name text not null,
  submitter_company text,
  submitter_email text not null,
  submitter_phone text,
  job_reference text,
  property_address text,
  job_type text,
  document_name text not null,
  document_category text not null,
  document_size_bytes bigint,
  storage_path text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'filed')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tpu_installer_status
  on public.care_third_party_uploads(installer_tenant_id, status);
create index if not exists idx_tpu_created
  on public.care_third_party_uploads(created_at desc);

alter table public.care_third_party_uploads enable row level security;

-- Installer staff read/update their tenant's uploads.
-- user_contexts has no tenant_id column; tenant membership lives on admins.tenant_id.
drop policy if exists "Installer staff read tenant uploads" on public.care_third_party_uploads;
create policy "Installer staff read tenant uploads"
  on public.care_third_party_uploads for select
  using (
    installer_tenant_id in (
      select tenant_id from public.admins
      where id = auth.uid() and tenant_id is not null
    )
  );

drop policy if exists "Installer staff update tenant uploads" on public.care_third_party_uploads;
create policy "Installer staff update tenant uploads"
  on public.care_third_party_uploads for update
  using (
    installer_tenant_id in (
      select tenant_id from public.admins
      where id = auth.uid() and tenant_id is not null
    )
  );

-- Service role bypasses RLS; writes from the public upload form are made via
-- the service-role API routes, so no anon insert policy is needed.
drop policy if exists "Service role manages uploads" on public.care_third_party_uploads;
create policy "Service role manages uploads"
  on public.care_third_party_uploads for all
  to service_role
  using (true)
  with check (true);

-- Keep updated_at in sync.
create or replace function public.care_tpu_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists care_tpu_updated_at on public.care_third_party_uploads;
create trigger care_tpu_updated_at
  before update on public.care_third_party_uploads
  for each row execute function public.care_tpu_set_updated_at();
