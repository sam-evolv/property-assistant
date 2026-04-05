-- Migration: Create user_contexts table for unified login system
-- Run manually in Supabase SQL Editor

create table if not exists public.user_contexts (
  id               uuid primary key default gen_random_uuid(),
  auth_user_id     uuid not null references auth.users(id) on delete cascade,
  product          text not null check (product in ('homeowner','select','care','agent','developer')),
  context_type     text not null check (context_type in ('unit','installation','agent_profile','development','organisation')),
  context_id       uuid not null,
  display_name     text not null,
  display_subtitle text,
  display_icon     text,
  context_aware    boolean not null default true,
  last_active_at   timestamptz,
  linked_at        timestamptz not null default now(),
  unique (auth_user_id, context_type, context_id)
);

alter table public.user_contexts enable row level security;

create policy "Users read own contexts"
  on public.user_contexts for select
  using (auth.uid() = auth_user_id);

create policy "Users update own contexts"
  on public.user_contexts for update
  using (auth.uid() = auth_user_id);

create policy "Service role manages contexts"
  on public.user_contexts for all
  using (auth.role() = 'service_role');
