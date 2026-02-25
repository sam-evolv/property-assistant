-- ============================================================================
-- DEVELOPER APP MIGRATION
-- Creates tables for Intelligence AI assistant and snag item tracking
-- ============================================================================

-- ============================================================================
-- intelligence_conversations — AI chat sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS intelligence_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    developer_id UUID NOT NULL,
    development_id UUID REFERENCES developments(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    message_count INTEGER NOT NULL DEFAULT 0,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS intel_conv_developer_idx ON intelligence_conversations(developer_id);
CREATE INDEX IF NOT EXISTS intel_conv_updated_idx ON intelligence_conversations(developer_id, updated_at DESC);

-- ============================================================================
-- intelligence_messages — Chat message history
-- ============================================================================
CREATE TABLE IF NOT EXISTS intelligence_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES intelligence_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    message_type TEXT NOT NULL DEFAULT 'text',
    content TEXT,
    structured_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS intel_msg_convo_idx ON intelligence_messages(conversation_id, created_at);

-- ============================================================================
-- intelligence_actions — Audit trail for AI-initiated actions
-- ============================================================================
CREATE TABLE IF NOT EXISTS intelligence_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    developer_id UUID NOT NULL,
    conversation_id UUID REFERENCES intelligence_conversations(id) ON DELETE SET NULL,
    message_id UUID REFERENCES intelligence_messages(id) ON DELETE SET NULL,
    development_id UUID REFERENCES developments(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    action_status TEXT NOT NULL DEFAULT 'completed',
    description TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS intel_action_developer_idx ON intelligence_actions(developer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS intel_action_type_idx ON intelligence_actions(action_type);

-- ============================================================================
-- snag_items — Individual snagging defects per unit
-- ============================================================================
CREATE TABLE IF NOT EXISTS snag_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    development_id UUID NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
    photo_url TEXT,
    reported_by TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS snag_items_unit_idx ON snag_items(unit_id);
CREATE INDEX IF NOT EXISTS snag_items_dev_idx ON snag_items(development_id);
CREATE INDEX IF NOT EXISTS snag_items_status_idx ON snag_items(status);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_snag_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_snag_items_updated_at ON snag_items;
CREATE TRIGGER update_snag_items_updated_at
    BEFORE UPDATE ON snag_items
    FOR EACH ROW
    EXECUTE FUNCTION update_snag_items_updated_at();

-- RLS
ALTER TABLE snag_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_actions ENABLE ROW LEVEL SECURITY;

-- Service role bypass
GRANT ALL ON intelligence_conversations TO service_role;
GRANT ALL ON intelligence_messages TO service_role;
GRANT ALL ON intelligence_actions TO service_role;
GRANT ALL ON snag_items TO service_role;

-- Authenticated users
GRANT SELECT, INSERT, UPDATE ON intelligence_conversations TO authenticated;
GRANT SELECT, INSERT ON intelligence_messages TO authenticated;
GRANT SELECT, INSERT ON intelligence_actions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON snag_items TO authenticated;
