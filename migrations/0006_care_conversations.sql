-- ============================================
-- Care Conversations Schema
-- Chat history for homeowner care assistant
-- ============================================

CREATE TABLE IF NOT EXISTS care_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
  title TEXT,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_care_conversations_installation ON care_conversations(installation_id);

CREATE TABLE IF NOT EXISTS care_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES care_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system_status', 'alert', 'troubleshoot')),
  content TEXT NOT NULL,
  structured_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_care_messages_conversation ON care_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_care_messages_created ON care_messages(conversation_id, created_at ASC);

-- RLS
ALTER TABLE care_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_messages ENABLE ROW LEVEL SECURITY;

-- Grants for service role
GRANT ALL ON care_conversations TO service_role;
GRANT ALL ON care_messages TO service_role;

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_care_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_care_conversations_updated_at ON care_conversations;
CREATE TRIGGER update_care_conversations_updated_at
  BEFORE UPDATE ON care_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_care_conversations_updated_at();
