-- 064_assistant_analytics_anonymous.sql
--
-- Anonymous, per-turn analytics for the multimodal assistant route
-- (app/api/assistant/chat/multimodal). One row per turn across all three
-- flag paths (openhouse agent, housing-reasoning-v1, placeholder).
--
-- GDPR basis: legitimate interest (service improvement + cost monitoring).
-- Disclosed in the live privacy policy section "OpenHouse Assistant
-- Conversations". NO direct identifiers are stored (no user_id,
-- conversation_id, unit_id, development_id, message_id), no image bytes/
-- hashes/filenames, no IP or device info. Free-text message/response columns
-- are PII-redacted (best-effort) before insert by lib/assistant-analytics.
--
-- RUN MANUALLY against production Supabase (SQL Editor) BEFORE the code that
-- writes to this table deploys. This file is NOT auto-applied.
--
-- Rollback: drop table assistant_analytics_anonymous. No other code path reads
-- it, so the only impact is loss of analytics.

create table if not exists assistant_analytics_anonymous (
  id uuid primary key default gen_random_uuid(),
  occurred_on date not null default current_date,
  flag_path text not null,
  prompt_version text,
  user_role text,
  message_text_redacted text,
  message_had_image boolean not null default false,
  image_count integer default 0,
  image_classification text,
  message_had_audio boolean not null default false,
  model_used text,
  tokens_input integer,
  tokens_output integer,
  cost_usd_micro integer,
  latency_ms integer,
  response_text_redacted text,
  action_returned text,
  issue_created boolean not null default false,
  severity_returned text,
  category_returned text,
  development_type text default 'unknown',
  errored boolean not null default false,
  error_type text
);

create index if not exists idx_analytics_occurred_on
  on assistant_analytics_anonymous(occurred_on);
create index if not exists idx_analytics_flag_path
  on assistant_analytics_anonymous(flag_path);
create index if not exists idx_analytics_action
  on assistant_analytics_anonymous(action_returned);
create index if not exists idx_analytics_errored
  on assistant_analytics_anonymous(errored) where errored = true;

-- RLS: nobody reads this except service role
alter table assistant_analytics_anonymous enable row level security;

-- No policies means no access except via service role
-- (intentional — this table is internal analytics only)
