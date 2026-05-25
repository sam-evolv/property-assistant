-- 065_assistant_conversation_turns.sql
--
-- Short-term conversation memory for the multimodal OpenHouse Assistant
-- (app/api/assistant/chat/multimodal). The agent surface has no conversations
-- table; turns are stored here keyed by the bare conversation_id the client
-- mints (same convention as assistant_media). The route loads the most recent
-- turns and replays them to the model so a homeowner can say "the other one is
-- cold too" and be understood.
--
-- THIS IS IDENTIFIABLE PERSONAL DATA. It stores the verbatim text of what a
-- homeowner typed and what the assistant replied, linked to tenant_id,
-- conversation_id, user_id and message_id. It is NOT the anonymous analytics
-- table (assistant_analytics_anonymous, migration 064): that table stores NO
-- identifiers and PII-redacts its free text. This table does the opposite — it
-- keeps the real conversation against the real identifiers. The two are
-- separate, with separate access patterns and separate retention. This table
-- is never read by, and never feeds, analytics.
--
-- LAWFUL BASIS: performance of the service (conversation continuity). The
-- homeowner is using a chat product; storing the conversation so the next turn
-- has context is part of delivering that product.
--
-- SUBJECT RIGHTS: the right of access AND the right of erasure both apply. A
-- homeowner (or the tenant on their behalf) may ask for their conversations to
-- be deleted at any time. Honour it with, e.g.:
--     delete from assistant_conversation_turns
--      where tenant_id = :tenant
--        and (user_id = :user or conversation_id = :conversation);
-- Deleting the matching assistant_media / assistant_media_analysis / issue rows
-- for the same conversation_id / message_id completes the erasure.
--
-- ENFORCEMENT MECHANISM (read carefully — this is NOT per-row RLS): RLS is
-- enabled with a single service_role_bypass policy, exactly like assistant_media
-- and the rest of the assistant family. Residents authenticate via the
-- QR / care-session path and have no auth.uid()/JWT, so there is no per-user
-- Postgres policy. Tenant and user scoping is enforced in APPLICATION CODE: the
-- route reads/writes only via the service role, always filters by tenant_id +
-- conversation_id, and sets tenant_id / user_id from the verified auth context,
-- never from client input. Cross-tenant access is refused by the route (403),
-- not by RLS. The data is still fully personal and erasable; the protection is
-- app code + service role, not a per-user RLS policy.
--
-- RUN MANUALLY against production Supabase (SQL Editor) BEFORE the code that
-- reads/writes this table deploys. This file is NOT auto-applied.
--
-- Rollback: drop table assistant_conversation_turns. The only impact is that
-- the assistant loses cross-turn memory and falls back to single-turn answers,
-- exactly as before this migration. No other code path depends on it.

create table if not exists assistant_conversation_turns (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  conversation_id uuid not null,
  user_id         uuid,
  message_id      uuid,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null default '',
  has_image       boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists assistant_conversation_turns_conversation_idx
  on assistant_conversation_turns (conversation_id, created_at);
create index if not exists assistant_conversation_turns_tenant_idx
  on assistant_conversation_turns (tenant_id);

-- RLS: service-role bypass only (see "ENFORCEMENT MECHANISM" above). Tenant and
-- user gating live in application code, consistent with the assistant family
-- (assistant_media, assistant_media_analysis, issue_reports) and migration 064.
alter table assistant_conversation_turns enable row level security;

create policy "service_role_bypass"
  on assistant_conversation_turns for all
  using (true)
  with check (true);
