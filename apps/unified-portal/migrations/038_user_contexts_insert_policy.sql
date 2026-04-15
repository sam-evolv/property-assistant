-- Migration: Allow authenticated users to insert their own user_contexts rows
-- Without this, the first-ever upsert during agent/homeowner/care login returns
-- 403 because the table only had SELECT and UPDATE policies for regular users.
-- Run manually in Supabase SQL Editor.

create policy "Users insert own contexts"
  on public.user_contexts for insert
  with check (auth.uid() = auth_user_id);
