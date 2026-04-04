-- Migration: Agent Intelligence Tables
-- Creates all tables needed for the Agent Intelligence system
-- Run manually in Supabase SQL Editor

-- ============================================
-- 1. Agent Profiles
-- ============================================
CREATE TABLE IF NOT EXISTS agent_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  display_name TEXT NOT NULL,
  agency_name TEXT,
  psra_license_number TEXT,
  phone TEXT,
  email TEXT,
  preferred_tone TEXT DEFAULT 'professional',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agent_profiles_user_id ON agent_profiles(user_id);
CREATE INDEX idx_agent_profiles_tenant_id ON agent_profiles(tenant_id);

ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_profiles_service_role ON agent_profiles
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY agent_profiles_self_access ON agent_profiles
  FOR SELECT USING (user_id = auth.uid());

-- ============================================
-- 2. Agent-Scheme Assignments
-- ============================================
CREATE TABLE IF NOT EXISTS agent_scheme_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agent_profiles(id) NOT NULL,
  development_id UUID REFERENCES developments(id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  role TEXT DEFAULT 'selling_agent',
  is_active BOOLEAN DEFAULT true,
  UNIQUE(agent_id, development_id)
);

CREATE INDEX idx_agent_scheme_assignments_agent ON agent_scheme_assignments(agent_id);
CREATE INDEX idx_agent_scheme_assignments_dev ON agent_scheme_assignments(development_id);
CREATE INDEX idx_agent_scheme_assignments_tenant ON agent_scheme_assignments(tenant_id);

ALTER TABLE agent_scheme_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_scheme_assignments_service_role ON agent_scheme_assignments
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY agent_scheme_assignments_self_access ON agent_scheme_assignments
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid())
  );

-- ============================================
-- 3. Agent Tasks
-- ============================================
CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agent_profiles(id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'dismissed')),
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  related_unit_id UUID REFERENCES units(id),
  related_development_id UUID REFERENCES developments(id),
  related_buyer_name TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'intelligence', 'system')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agent_tasks_agent ON agent_tasks(agent_id);
CREATE INDEX idx_agent_tasks_tenant ON agent_tasks(tenant_id);
CREATE INDEX idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX idx_agent_tasks_due_date ON agent_tasks(due_date);

ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_tasks_service_role ON agent_tasks
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY agent_tasks_self_access ON agent_tasks
  FOR ALL USING (
    agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid())
  );

-- ============================================
-- 4. Communication Events (cross-stakeholder visible)
-- ============================================
CREATE TABLE IF NOT EXISTS communication_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  development_id UUID REFERENCES developments(id) NOT NULL,
  unit_id UUID REFERENCES units(id),

  -- Who communicated
  actor_id UUID REFERENCES auth.users(id) NOT NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('agent', 'developer', 'buyer', 'solicitor', 'system')),
  actor_name TEXT NOT NULL,

  -- Communication details
  type TEXT NOT NULL CHECK (type IN ('email', 'phone', 'whatsapp', 'in_person', 'text', 'portal_message', 'system_notification')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound', 'internal')),
  counterparty_name TEXT,
  counterparty_role TEXT CHECK (counterparty_role IN ('agent', 'developer', 'buyer', 'solicitor', 'other')),

  -- Content
  subject TEXT,
  summary TEXT NOT NULL,
  outcome TEXT,

  -- Follow-up
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_date TIMESTAMPTZ,
  follow_up_completed BOOLEAN DEFAULT false,

  -- Visibility
  visibility TEXT DEFAULT 'shared' CHECK (visibility IN ('private', 'shared', 'developer_visible')),

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_communication_events_tenant ON communication_events(tenant_id);
CREATE INDEX idx_communication_events_dev ON communication_events(development_id);
CREATE INDEX idx_communication_events_unit ON communication_events(unit_id);
CREATE INDEX idx_communication_events_actor ON communication_events(actor_id);
CREATE INDEX idx_communication_events_created ON communication_events(created_at DESC);

ALTER TABLE communication_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY communication_events_service_role ON communication_events
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY communication_events_agent_read ON communication_events
  FOR SELECT USING (
    development_id IN (
      SELECT development_id FROM agent_scheme_assignments
      WHERE agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid())
      AND is_active = true
    )
    AND (visibility != 'private' OR actor_id = auth.uid())
  );

CREATE POLICY communication_events_agent_write ON communication_events
  FOR INSERT WITH CHECK (actor_id = auth.uid());

-- ============================================
-- 5. Entity Timeline (unified event log)
-- ============================================
CREATE TABLE IF NOT EXISTS entity_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,

  -- What entity this event relates to
  entity_type TEXT NOT NULL CHECK (entity_type IN ('unit', 'buyer', 'scheme', 'document')),
  entity_id UUID NOT NULL,

  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN (
    'status_change', 'communication', 'document_uploaded', 'document_signed',
    'selection_made', 'selection_deadline', 'task_created', 'task_completed',
    'note_added', 'milestone_reached', 'issue_flagged', 'viewing_conducted',
    'enquiry_received', 'mortgage_update', 'solicitor_update'
  )),
  event_data JSONB NOT NULL DEFAULT '{}',
  event_summary TEXT NOT NULL,

  -- Who triggered this event
  actor_id UUID REFERENCES auth.users(id),
  actor_role TEXT CHECK (actor_role IN ('agent', 'developer', 'buyer', 'solicitor', 'system')),
  actor_name TEXT,

  -- Visibility
  visibility TEXT DEFAULT 'shared' CHECK (visibility IN ('private', 'shared', 'developer_visible', 'all')),

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_entity_timeline_tenant ON entity_timeline(tenant_id);
CREATE INDEX idx_entity_timeline_entity ON entity_timeline(entity_type, entity_id);
CREATE INDEX idx_entity_timeline_created ON entity_timeline(created_at DESC);
CREATE INDEX idx_entity_timeline_event_type ON entity_timeline(event_type);

ALTER TABLE entity_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY entity_timeline_service_role ON entity_timeline
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY entity_timeline_agent_access ON entity_timeline
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM agent_scheme_assignments
      WHERE agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid())
      AND is_active = true
    )
    AND (visibility IN ('shared', 'all') OR actor_id = auth.uid())
  );

-- ============================================
-- 6. Intelligence Interactions (logging & analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS intelligence_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  user_role TEXT NOT NULL CHECK (user_role IN ('developer', 'agent', 'buyer', 'admin')),
  skin TEXT NOT NULL CHECK (skin IN ('developer', 'agent', 'buyer', 'care', 'select')),

  -- Query
  query_text TEXT NOT NULL,
  parsed_intent TEXT,
  entities_referenced JSONB,

  -- Retrieval
  tools_called JSONB,
  rag_documents_retrieved JSONB,

  -- Response
  response_text TEXT,
  response_type TEXT CHECK (response_type IN ('answer', 'draft', 'report', 'task_created', 'error', 'clarification')),

  -- User feedback
  user_action TEXT CHECK (user_action IN ('accepted', 'edited', 'rejected', 'ignored', 'sent')),
  edited_text TEXT,

  -- Metadata
  model_used TEXT,
  token_count_input INTEGER,
  token_count_output INTEGER,
  latency_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intelligence_interactions_tenant ON intelligence_interactions(tenant_id);
CREATE INDEX idx_intelligence_interactions_user ON intelligence_interactions(user_id);
CREATE INDEX idx_intelligence_interactions_skin ON intelligence_interactions(skin);
CREATE INDEX idx_intelligence_interactions_created ON intelligence_interactions(created_at DESC);

ALTER TABLE intelligence_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY intelligence_interactions_service_role ON intelligence_interactions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY intelligence_interactions_self_access ON intelligence_interactions
  FOR SELECT USING (user_id = auth.uid());

-- ============================================
-- 7. Intelligence Conversations (memory)
-- ============================================
CREATE TABLE IF NOT EXISTS intelligence_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agent_profiles(id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) NOT NULL,

  -- Session tracking
  session_id TEXT NOT NULL,

  -- Message
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,

  -- Entity references (for cross-session context)
  entities_mentioned JSONB,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intelligence_conversations_agent ON intelligence_conversations(agent_id);
CREATE INDEX idx_intelligence_conversations_session ON intelligence_conversations(session_id);
CREATE INDEX idx_intelligence_conversations_tenant ON intelligence_conversations(tenant_id);
CREATE INDEX idx_intelligence_conversations_entities ON intelligence_conversations USING gin(entities_mentioned);
CREATE INDEX idx_intelligence_conversations_created ON intelligence_conversations(created_at DESC);

ALTER TABLE intelligence_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY intelligence_conversations_service_role ON intelligence_conversations
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY intelligence_conversations_self_access ON intelligence_conversations
  FOR ALL USING (
    agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid())
  );

-- ============================================
-- 8. Knowledge Gaps
-- ============================================
CREATE TABLE IF NOT EXISTS intelligence_knowledge_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  query_text TEXT NOT NULL,
  skin TEXT NOT NULL,
  user_role TEXT NOT NULL,
  context JSONB,
  resolved BOOLEAN DEFAULT false,
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_knowledge_gaps_tenant ON intelligence_knowledge_gaps(tenant_id);
CREATE INDEX idx_knowledge_gaps_resolved ON intelligence_knowledge_gaps(resolved);

ALTER TABLE intelligence_knowledge_gaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY intelligence_knowledge_gaps_service_role ON intelligence_knowledge_gaps
  FOR ALL USING (true) WITH CHECK (true);
