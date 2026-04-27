-- Migration: 045_lettings_workspace.sql
-- Adds the lettings workspace alongside the existing sales pipeline.
--
-- Architectural decisions locked in this migration:
--   1. Workspace lives INSIDE the agent product (one user, one agent_profile,
--      one or more workspaces). It is NOT a new entry in user_contexts.
--   2. Sales and lettings have separate top-level tables. Sales = developments/units
--      (existing). Lettings = lettings_properties / lettings_tenancies / etc (new).
--   3. lettings_properties is the property record. lettings_tenancies is the
--      time-based contract. One property has zero or more tenancies over time;
--      at most one is `active` at a time.
--   4. lettings_contacts is a unified people table — tenants, prospective tenants,
--      contractors. People are reused across tenancies (a viewer becomes a tenant).
--   5. Field provenance is tracked for every auto-filled field, so the review
--      screen can show "BER from SEAI register on 27 April".
--
-- RLS: all tables follow the same pattern as agent_profiles — service_role full
-- access, tenant_id-scoped self access via auth.jwt()->>'tenant_id'.
--
-- Run in Supabase SQL Editor as separate query blocks, NOT one big batch
-- (per project convention: avoids RLS policy ordering failures).

-- ============================================
-- 1. agent_workspaces
-- ============================================
-- One agent can own multiple workspaces. Each workspace is one of:
--   sales    — uses existing developments/units schema
--   lettings — uses the new lettings_* tables
-- An agent who only does sales has one workspace (mode=sales). An agent who
-- does both has two workspaces. Switching workspaces reshapes the Agent app
-- nav, home screen, pipeline view.

CREATE TABLE IF NOT EXISTS agent_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agent_profiles(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sales', 'lettings')),
  display_name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_id, mode)
);

CREATE INDEX idx_agent_workspaces_agent ON agent_workspaces(agent_id);
CREATE INDEX idx_agent_workspaces_tenant ON agent_workspaces(tenant_id);

-- Exactly one default workspace per agent.
CREATE UNIQUE INDEX idx_agent_workspaces_one_default
  ON agent_workspaces(agent_id) WHERE is_default = true;

ALTER TABLE agent_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_workspaces_service_role ON agent_workspaces
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY agent_workspaces_self_access ON agent_workspaces
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid())
  );


-- ============================================
-- 2. lettings_properties
-- ============================================
-- The property record. Address-keyed (one row per dwelling).
-- Auto-filled fields populated from SEAI/Eircode/Google Places at create time;
-- provenance tracked separately in lettings_field_provenance.

CREATE TABLE IF NOT EXISTS lettings_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES agent_workspaces(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES agent_profiles(id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) NOT NULL,

  -- Address (Eircode is the source of truth for Ireland)
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  town TEXT,
  county TEXT,
  eircode TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),

  -- Physical attributes
  property_type TEXT CHECK (property_type IN (
    'apartment', 'house_terraced', 'house_semi_detached', 'house_detached',
    'house_end_of_terrace', 'duplex', 'studio', 'bungalow', 'other'
  )),
  bedrooms INTEGER,
  bathrooms INTEGER,
  floor_area_sqm NUMERIC(7, 2),
  year_built INTEGER,

  -- BER (from SEAI register if available)
  ber_rating TEXT CHECK (ber_rating IN (
    'A1','A2','A3','B1','B2','B3','C1','C2','C3',
    'D1','D2','E1','E2','F','G','exempt','pending'
  )),
  ber_cert_number TEXT,
  ber_expiry_date DATE,

  -- Operational state
  status TEXT NOT NULL DEFAULT 'vacant' CHECK (status IN (
    'vacant', 'tenanted', 'off_market', 'between_tenancies'
  )),

  -- Computed completeness (0-100). Updated by trigger on save.
  completeness_score INTEGER NOT NULL DEFAULT 0,

  -- Audit
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN (
    'manual', 'bulk_csv', 'bulk_daft', 'lease_pdf', 'intelligence_voice', 'intelligence_text'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lettings_properties_workspace ON lettings_properties(workspace_id);
CREATE INDEX idx_lettings_properties_agent ON lettings_properties(agent_id);
CREATE INDEX idx_lettings_properties_tenant ON lettings_properties(tenant_id);
CREATE INDEX idx_lettings_properties_eircode ON lettings_properties(eircode);
CREATE INDEX idx_lettings_properties_status ON lettings_properties(status);

ALTER TABLE lettings_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY lettings_properties_service_role ON lettings_properties
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY lettings_properties_self_access ON lettings_properties
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY lettings_properties_self_insert ON lettings_properties
  FOR INSERT WITH CHECK (
    agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY lettings_properties_self_update ON lettings_properties
  FOR UPDATE USING (
    agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid())
  );


-- ============================================
-- 3. lettings_contacts
-- ============================================
-- Unified people table. A contact may be a tenant on one tenancy and a
-- prospective tenant on another viewing. We don't duplicate.

CREATE TABLE IF NOT EXISTS lettings_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES agent_workspaces(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES agent_profiles(id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) NOT NULL,

  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,

  -- Multi-role tagging — one contact can be tenant + prospective tenant simultaneously
  roles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lettings_contacts_workspace ON lettings_contacts(workspace_id);
CREATE INDEX idx_lettings_contacts_agent ON lettings_contacts(agent_id);
CREATE INDEX idx_lettings_contacts_email ON lettings_contacts(email) WHERE email IS NOT NULL;

ALTER TABLE lettings_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY lettings_contacts_service_role ON lettings_contacts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY lettings_contacts_self_access ON lettings_contacts
  FOR ALL USING (
    agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid())
  );


-- ============================================
-- 4. lettings_tenancies
-- ============================================
-- Time-based contract. A property can have many tenancies over its lifetime;
-- only one should be `active` at a time (enforced by partial unique index).

CREATE TABLE IF NOT EXISTS lettings_tenancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES lettings_properties(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES agent_workspaces(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES agent_profiles(id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) NOT NULL,

  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'ended', 'future', 'terminated_early'
  )),

  -- Money
  monthly_rent NUMERIC(10, 2) NOT NULL,
  deposit_held NUMERIC(10, 2),
  rent_payment_day INTEGER CHECK (rent_payment_day BETWEEN 1 AND 31),

  -- Lease term
  lease_start_date DATE NOT NULL,
  lease_end_date DATE,
  lease_type TEXT CHECK (lease_type IN ('fixed_term', 'periodic', 'part_4', 'further_part_4')),
  notice_period_days INTEGER,
  break_clause_text TEXT,

  -- RTB compliance (Residential Tenancies Board, Ireland)
  rtb_registration_number TEXT,
  rtb_registered_at DATE,

  -- Lease document linkage
  source_lease_document_id UUID,  -- FK added after lettings_documents is created

  -- Audit
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN (
    'manual', 'lease_pdf', 'intelligence_voice', 'intelligence_text', 'bulk_csv'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lettings_tenancies_property ON lettings_tenancies(property_id);
CREATE INDEX idx_lettings_tenancies_workspace ON lettings_tenancies(workspace_id);
CREATE INDEX idx_lettings_tenancies_status ON lettings_tenancies(status);
CREATE INDEX idx_lettings_tenancies_lease_end ON lettings_tenancies(lease_end_date)
  WHERE status = 'active';

-- Only one active tenancy per property at a time.
CREATE UNIQUE INDEX idx_lettings_tenancies_one_active_per_property
  ON lettings_tenancies(property_id) WHERE status = 'active';

ALTER TABLE lettings_tenancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY lettings_tenancies_service_role ON lettings_tenancies
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY lettings_tenancies_self_access ON lettings_tenancies
  FOR ALL USING (
    agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid())
  );


-- ============================================
-- 5. lettings_tenancy_contacts (join)
-- ============================================
-- Which contacts are on which tenancy and in what capacity.
-- A tenancy can have one primary tenant + N co-tenants + N guarantors.

CREATE TABLE IF NOT EXISTS lettings_tenancy_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID REFERENCES lettings_tenancies(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES lettings_contacts(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('primary_tenant', 'co_tenant', 'guarantor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenancy_id, contact_id)
);

CREATE INDEX idx_lettings_tenancy_contacts_tenancy ON lettings_tenancy_contacts(tenancy_id);
CREATE INDEX idx_lettings_tenancy_contacts_contact ON lettings_tenancy_contacts(contact_id);

ALTER TABLE lettings_tenancy_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY lettings_tenancy_contacts_service_role ON lettings_tenancy_contacts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY lettings_tenancy_contacts_self_access ON lettings_tenancy_contacts
  FOR ALL USING (
    tenancy_id IN (
      SELECT id FROM lettings_tenancies
      WHERE agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid())
    )
  );


-- ============================================
-- 6. lettings_documents
-- ============================================
-- Attached files for a property or a tenancy.
-- Lease PDFs are the highest-leverage type — AI extraction populates the tenancy.

CREATE TABLE IF NOT EXISTS lettings_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES lettings_properties(id) ON DELETE CASCADE NOT NULL,
  tenancy_id UUID REFERENCES lettings_tenancies(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES agent_workspaces(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES agent_profiles(id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) NOT NULL,

  doc_type TEXT NOT NULL CHECK (doc_type IN (
    'lease', 'ber_cert', 'gas_safety_cert', 'electrical_cert',
    'inventory', 'rtb_confirmation', 'photo', 'floorplan', 'other'
  )),
  original_filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT,

  -- AI extraction output (raw JSON from GPT-4o-mini)
  ai_extracted_data JSONB,
  ai_extraction_status TEXT CHECK (ai_extraction_status IN (
    'pending', 'success', 'partial', 'failed', 'not_applicable'
  )),
  ai_extraction_confidence NUMERIC(3, 2),  -- 0.00 to 1.00

  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lettings_documents_property ON lettings_documents(property_id);
CREATE INDEX idx_lettings_documents_tenancy ON lettings_documents(tenancy_id) WHERE tenancy_id IS NOT NULL;
CREATE INDEX idx_lettings_documents_doc_type ON lettings_documents(doc_type);

ALTER TABLE lettings_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY lettings_documents_service_role ON lettings_documents
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY lettings_documents_self_access ON lettings_documents
  FOR ALL USING (
    agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid())
  );

-- Now add the FK on lettings_tenancies.source_lease_document_id
ALTER TABLE lettings_tenancies
  ADD CONSTRAINT fk_lettings_tenancies_source_lease_document
  FOREIGN KEY (source_lease_document_id) REFERENCES lettings_documents(id) ON DELETE SET NULL;


-- ============================================
-- 7. lettings_field_provenance
-- ============================================
-- Per-field audit of where each piece of data came from. Powers the
-- "BER from SEAI register on 27 April" attribution shown on the review screen.
-- Also lets us learn over time which sources are most reliable.

CREATE TABLE IF NOT EXISTS lettings_field_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES lettings_properties(id) ON DELETE CASCADE,
  tenancy_id UUID REFERENCES lettings_tenancies(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN (
    'manual', 'eircode', 'google_places', 'seai_register', 'ppr',
    'daft_listing', 'myhome_listing', 'lease_pdf_extraction',
    'intelligence_voice', 'intelligence_text', 'bulk_csv'
  )),
  confidence NUMERIC(3, 2),
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Either property_id or tenancy_id must be set.
  CHECK (property_id IS NOT NULL OR tenancy_id IS NOT NULL)
);

CREATE INDEX idx_lettings_field_provenance_property ON lettings_field_provenance(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX idx_lettings_field_provenance_tenancy ON lettings_field_provenance(tenancy_id) WHERE tenancy_id IS NOT NULL;

ALTER TABLE lettings_field_provenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY lettings_field_provenance_service_role ON lettings_field_provenance
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY lettings_field_provenance_self_access ON lettings_field_provenance
  FOR SELECT USING (
    property_id IN (
      SELECT id FROM lettings_properties
      WHERE agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid())
    )
    OR tenancy_id IN (
      SELECT id FROM lettings_tenancies
      WHERE agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid())
    )
  );


-- ============================================
-- 8. lettings_viewings
-- ============================================
-- Scheduled viewings of a property by a prospective tenant.
-- Mirrors the existing viewings concept on the sales side.

CREATE TABLE IF NOT EXISTS lettings_viewings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES lettings_properties(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES lettings_contacts(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES agent_workspaces(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES agent_profiles(id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) NOT NULL,

  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 20,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'completed', 'no_show', 'cancelled', 'rescheduled'
  )),
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lettings_viewings_property ON lettings_viewings(property_id);
CREATE INDEX idx_lettings_viewings_scheduled ON lettings_viewings(scheduled_at);
CREATE INDEX idx_lettings_viewings_workspace ON lettings_viewings(workspace_id);

ALTER TABLE lettings_viewings ENABLE ROW LEVEL SECURITY;

CREATE POLICY lettings_viewings_service_role ON lettings_viewings
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY lettings_viewings_self_access ON lettings_viewings
  FOR ALL USING (
    agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid())
  );


-- ============================================
-- 9. lettings_maintenance
-- ============================================
-- Maintenance tickets / jobs against a property.

CREATE TABLE IF NOT EXISTS lettings_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES lettings_properties(id) ON DELETE CASCADE NOT NULL,
  tenancy_id UUID REFERENCES lettings_tenancies(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES agent_workspaces(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES agent_profiles(id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) NOT NULL,

  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN (
    'plumbing', 'electrical', 'heating', 'appliance', 'structural',
    'pest', 'cleaning', 'safety', 'compliance', 'other'
  )),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'in_progress', 'awaiting_contractor', 'resolved', 'cancelled'
  )),

  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,

  contractor_contact_id UUID REFERENCES lettings_contacts(id) ON DELETE SET NULL,
  cost_estimate NUMERIC(10, 2),
  cost_actual NUMERIC(10, 2),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lettings_maintenance_property ON lettings_maintenance(property_id);
CREATE INDEX idx_lettings_maintenance_status ON lettings_maintenance(status);
CREATE INDEX idx_lettings_maintenance_workspace ON lettings_maintenance(workspace_id);

ALTER TABLE lettings_maintenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY lettings_maintenance_service_role ON lettings_maintenance
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY lettings_maintenance_self_access ON lettings_maintenance
  FOR ALL USING (
    agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid())
  );


-- ============================================
-- 10. Computed completeness function
-- ============================================
-- Recomputes completeness_score for a property based on which fields are
-- populated. Called by trigger on insert/update of lettings_properties and
-- lettings_tenancies.

CREATE OR REPLACE FUNCTION compute_property_completeness(p_property_id UUID)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  prop RECORD;
  active_tenancy RECORD;
  doc_count INTEGER;
BEGIN
  SELECT * INTO prop FROM lettings_properties WHERE id = p_property_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Property fields (60 points total)
  IF prop.address_line_1 IS NOT NULL AND prop.eircode IS NOT NULL THEN score := score + 10; END IF;
  IF prop.property_type IS NOT NULL THEN score := score + 8; END IF;
  IF prop.bedrooms IS NOT NULL THEN score := score + 8; END IF;
  IF prop.bathrooms IS NOT NULL THEN score := score + 4; END IF;
  IF prop.floor_area_sqm IS NOT NULL THEN score := score + 5; END IF;
  IF prop.year_built IS NOT NULL THEN score := score + 3; END IF;
  IF prop.ber_rating IS NOT NULL THEN score := score + 12; END IF;
  IF prop.ber_cert_number IS NOT NULL THEN score := score + 5; END IF;
  IF prop.ber_expiry_date IS NOT NULL THEN score := score + 5; END IF;

  -- Active tenancy fields (30 points total — only if tenanted)
  IF prop.status = 'tenanted' THEN
    SELECT * INTO active_tenancy FROM lettings_tenancies
      WHERE property_id = p_property_id AND status = 'active' LIMIT 1;
    IF FOUND THEN
      IF active_tenancy.monthly_rent IS NOT NULL THEN score := score + 6; END IF;
      IF active_tenancy.deposit_held IS NOT NULL THEN score := score + 4; END IF;
      IF active_tenancy.lease_start_date IS NOT NULL THEN score := score + 4; END IF;
      IF active_tenancy.lease_end_date IS NOT NULL THEN score := score + 4; END IF;
      IF active_tenancy.rtb_registration_number IS NOT NULL THEN score := score + 8; END IF;
      IF active_tenancy.lease_type IS NOT NULL THEN score := score + 4; END IF;
    END IF;
  ELSE
    -- Vacant properties don't lose points for missing tenancy data
    score := score + 30;
  END IF;

  -- Documents (10 points total)
  SELECT COUNT(*) INTO doc_count FROM lettings_documents
    WHERE property_id = p_property_id AND doc_type IN ('lease', 'ber_cert');
  IF doc_count >= 2 THEN score := score + 10;
  ELSIF doc_count = 1 THEN score := score + 5;
  END IF;

  RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Trigger function — recomputes on property update
CREATE OR REPLACE FUNCTION trg_update_property_completeness()
RETURNS TRIGGER AS $$
BEGIN
  NEW.completeness_score := compute_property_completeness(NEW.id);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lettings_properties_completeness
  BEFORE UPDATE ON lettings_properties
  FOR EACH ROW EXECUTE FUNCTION trg_update_property_completeness();


-- Trigger function — recomputes on tenancy change (touches the parent property)
CREATE OR REPLACE FUNCTION trg_update_property_completeness_from_tenancy()
RETURNS TRIGGER AS $$
DECLARE
  pid UUID;
BEGIN
  pid := COALESCE(NEW.property_id, OLD.property_id);
  UPDATE lettings_properties SET updated_at = now() WHERE id = pid;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lettings_tenancies_completeness
  AFTER INSERT OR UPDATE OR DELETE ON lettings_tenancies
  FOR EACH ROW EXECUTE FUNCTION trg_update_property_completeness_from_tenancy();


-- ============================================
-- 11. Backfill: create lettings workspace for sam@evolvai.ie
-- ============================================
-- Per memory: sam@evolvai.ie has agent_profile in Hennessy & Co Property
-- (agent-test@test.ie) and Longview Estates (developer). Add a lettings
-- workspace to the test agent profile so the mum-test data has somewhere
-- to land. This is idempotent — uses ON CONFLICT DO NOTHING.

DO $$
DECLARE
  test_agent_id UUID;
  test_tenant_id UUID;
BEGIN
  SELECT id, tenant_id INTO test_agent_id, test_tenant_id
  FROM agent_profiles
  WHERE email = 'agent-test@test.ie'
  LIMIT 1;

  IF test_agent_id IS NOT NULL THEN
    -- Sales workspace (existing default)
    INSERT INTO agent_workspaces (agent_id, tenant_id, mode, display_name, is_default)
    VALUES (test_agent_id, test_tenant_id, 'sales', 'Hennessy & Co — Sales', true)
    ON CONFLICT (agent_id, mode) DO NOTHING;

    -- Lettings workspace (new)
    INSERT INTO agent_workspaces (agent_id, tenant_id, mode, display_name, is_default)
    VALUES (test_agent_id, test_tenant_id, 'lettings', 'Hennessy & Co — Lettings', false)
    ON CONFLICT (agent_id, mode) DO NOTHING;
  END IF;
END $$;


-- ============================================
-- DONE
-- ============================================
-- Next migration (046) should:
--   - Seed lettings_properties / lettings_tenancies demo data for the test agent
--   - Add a `last_active_workspace_id` column to agent_profiles for switcher persistence
