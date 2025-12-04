-- Phase 3: Add Analytics Columns
-- Adding columns for analytics tracking to existing tables

-- ================================================================
-- MESSAGES TABLE - Add analytics tracking columns
-- ================================================================
ALTER TABLE messages 
  ADD COLUMN IF NOT EXISTS token_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_usd DECIMAL(10,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS cited_document_ids TEXT[];

CREATE INDEX IF NOT EXISTS messages_token_count_idx ON messages(token_count) WHERE token_count > 0;

-- ================================================================
-- DOCUMENTS TABLE - Add engagement tracking columns
-- ================================================================
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS documents_view_count_idx ON documents(view_count) WHERE view_count > 0;
CREATE INDEX IF NOT EXISTS documents_download_count_idx ON documents(download_count) WHERE download_count > 0;

-- ================================================================
-- HOMEOWNERS TABLE - Add activity tracking columns
-- ================================================================
ALTER TABLE homeowners
  ADD COLUMN IF NOT EXISTS last_active TIMESTAMP,
  ADD COLUMN IF NOT EXISTS total_chats INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_downloads INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS homeowners_last_active_idx ON homeowners(last_active) WHERE last_active IS NOT NULL;
CREATE INDEX IF NOT EXISTS homeowners_total_chats_idx ON homeowners(total_chats) WHERE total_chats > 0;

-- ================================================================
-- UNITS TABLE - Add chat activity tracking
-- ================================================================
ALTER TABLE units
  ADD COLUMN IF NOT EXISTS last_chat_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS units_last_chat_at_idx ON units(last_chat_at) WHERE last_chat_at IS NOT NULL;

-- ================================================================
-- VACUUM AND ANALYZE - Update statistics
-- ================================================================
ANALYZE messages;
ANALYZE documents;
ANALYZE homeowners;
ANALYZE units;

-- ================================================================
-- COMPLETION
-- ================================================================
DO $$
BEGIN
  RAISE NOTICE 'Analytics columns added successfully';
END $$;
