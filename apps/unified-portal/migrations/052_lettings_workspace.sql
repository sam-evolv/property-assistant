-- ============================================================================
-- ALREADY APPLIED TO PRODUCTION via Supabase MCP on 2026-04-27.
-- DO NOT RE-RUN. Recorded here for audit / future env bootstrap only.
--
-- Verified live state at time of recording:
--   - agent_workspaces table exists with 2 rows seeded for test agent
--     (sales=default, lettings)
--   - agent_profiles.last_active_workspace_id column added
--   - agent_letting_properties extended (workspace_id, county, latitude,
--     longitude, year_built, ber_cert_number, ber_expiry_date,
--     completeness_score, source); all 14 existing rows tagged with the
--     lettings workspace_id, completeness scores 65-77.
--   - agent_tenancies extended (workspace_id, lease_type, notice_period_days,
--     break_clause_text, rtb_registration_number, rent_payment_day, source,
--     source_lease_document_id); all 12 existing rows tagged with workspace_id.
--   - lettings_documents, lettings_field_provenance, lettings_maintenance
--     tables created.
--   - compute_letting_property_completeness function + triggers active.
-- ============================================================================

-- Migration: 052_lettings_workspace.sql
--
-- Adds the workspace concept for the Agent app and extends the EXISTING
-- lettings surface (agent_letting_properties / agent_tenancies / agent_applicants /
-- agent_rental_viewings) with the auto-fill, provenance, and document fields
-- needed for the new property onboarding flow.
--
-- Architectural decisions:
--   1. Workspace lives INSIDE the agent product. One agent_profile -> one or
--      more agent_workspaces. NOT a new entry in user_contexts.
--   2. Reuses existing lettings tables (agent_letting_properties, agent_tenancies,
--      agent_applicants, agent_rental_viewings) — they're already wired into
--      Intelligence, voice actions, capability chips, and agentic skills. Adds
--      the missing columns rather than creating parallel tables.
--   3. Field provenance is tracked per-field for the review screen UX.
--   4. Lettings documents (lease PDFs etc) get their own table — not in
--      the existing schema.
--   5. Lettings maintenance gets its own table because the existing
--      maintenance_requests is for the developer/Care surface (keyed on unit_id
--      and development_id, not letting_property_id).
--
-- Run in Supabase SQL Editor as separate query blocks per the project
-- convention, NOT one big batch.

-- ============================================
-- 1. agent_workspaces
-- ============================================

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
-- 2. agent_profiles.last_active_workspace_id
-- ============================================
-- Persists the last workspace the agent had open so the switcher returns
-- to the right context on next login.

ALTER TABLE agent_profiles
  ADD COLUMN IF NOT EXISTS last_active_workspace_id UUID
    REFERENCES agent_workspaces(id) ON DELETE SET NULL;


-- ============================================
-- 3. Extend agent_letting_properties for the onboarding flow
-- ============================================
-- Adds the missing fields needed for: workspace tagging, address geocoding,
-- BER cert tracking, completeness scoring, and source attribution.

ALTER TABLE agent_letting_properties
  ADD COLUMN IF NOT EXISTS workspace_id UUID
    REFERENCES agent_workspaces(id) ON DELETE SET NULL;

ALTER TABLE agent_letting_properties
  ADD COLUMN IF NOT EXISTS county TEXT;

ALTER TABLE agent_letting_properties
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7);

ALTER TABLE agent_letting_properties
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);

ALTER TABLE agent_letting_properties
  ADD COLUMN IF NOT EXISTS year_built INTEGER;

ALTER TABLE agent_letting_properties
  ADD COLUMN IF NOT EXISTS ber_cert_number TEXT;

ALTER TABLE agent_letting_properties
  ADD COLUMN IF NOT EXISTS ber_expiry_date DATE;

ALTER TABLE agent_letting_properties
  ADD COLUMN IF NOT EXISTS completeness_score INTEGER NOT NULL DEFAULT 0;

ALTER TABLE agent_letting_properties
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN (
      'manual', 'bulk_csv', 'bulk_daft', 'lease_pdf',
      'intelligence_voice', 'intelligence_text'
    ));

CREATE INDEX IF NOT EXISTS idx_agent_letting_properties_workspace
  ON agent_letting_properties(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_letting_properties_eircode
  ON agent_letting_properties(eircode);


-- ============================================
-- 4. Extend agent_tenancies for richer lease data
-- ============================================
-- The existing schema covers the basics. We add lease classification,
-- RTB registration number (existing rtb_registered is a boolean — we keep
-- it and add the actual registration number), payment day, and the link
-- to a source lease document.

ALTER TABLE agent_tenancies
  ADD COLUMN IF NOT EXISTS workspace_id UUID
    REFERENCES agent_workspaces(id) ON DELETE SET NULL;

ALTER TABLE agent_tenancies
  ADD COLUMN IF NOT EXISTS lease_type TEXT
    CHECK (lease_type IS NULL OR lease_type IN (
      'fixed_term', 'periodic', 'part_4', 'further_part_4'
    ));

ALTER TABLE agent_tenancies
  ADD COLUMN IF NOT EXISTS notice_period_days INTEGER;

ALTER TABLE agent_tenancies
  ADD COLUMN IF NOT EXISTS break_clause_text TEXT;

ALTER TABLE agent_tenancies
  ADD COLUMN IF NOT EXISTS rtb_registration_number TEXT;

ALTER TABLE agent_tenancies
  ADD COLUMN IF NOT EXISTS rent_payment_day INTEGER
    CHECK (rent_payment_day IS NULL OR (rent_payment_day BETWEEN 1 AND 31));

ALTER TABLE agent_tenancies
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN (
      'manual', 'lease_pdf', 'intelligence_voice', 'intelligence_text', 'bulk_csv'
    ));

-- source_lease_document_id added after lettings_documents exists (section 5)

CREATE INDEX IF NOT EXISTS idx_agent_tenancies_workspace
  ON agent_tenancies(workspace_id);

-- Only one active tenancy per property at a time. Soft-applied: any pre-existing
-- duplicates would block this, so we use a partial unique index that only fires
-- on new active rows. If the existing 12 rows have duplicates, this errors —
-- in which case clean up before re-running this section.
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_tenancies_one_active_per_property
  ON agent_tenancies(letting_property_id) WHERE status = 'active';


-- ============================================
-- 5. lettings_documents
-- ============================================
-- Lease PDFs, BER certs, gas/electrical certs, photos, etc.
-- AI extraction output stored as JSONB for the review screen.

CREATE TABLE IF NOT EXISTS lettings_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  letting_property_id UUID REFERENCES agent_letting_properties(id) ON DELETE CASCADE NOT NULL,
  tenancy_id UUID REFERENCES agent_tenancies(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES agent_workspaces(id) ON DELETE SET NULL,
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

  ai_extracted_data JSONB,
  ai_extraction_status TEXT CHECK (ai_extraction_status IN (
    'pending', 'success', 'partial', 'failed', 'not_applicable'
  )),
  ai_extraction_confidence NUMERIC(3, 2),

  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lettings_documents_property ON lettings_documents(letting_property_id);
CREATE INDEX idx_lettings_documents_tenancy ON lettings_documents(tenancy_id) WHERE tenancy_id IS NOT NULL;
CREATE INDEX idx_lettings_documents_doc_type ON lettings_documents(doc_type);

ALTER TABLE lettings_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY lettings_documents_service_role ON lettings_documents
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY lettings_documents_self_access ON lettings_documents
  FOR ALL USING (
    agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid())
  );

-- Now backfill the FK on agent_tenancies.source_lease_document_id
ALTER TABLE agent_tenancies
  ADD COLUMN IF NOT EXISTS source_lease_document_id UUID
    REFERENCES lettings_documents(id) ON DELETE SET NULL;


-- ============================================
-- 6. lettings_field_provenance
-- ============================================
-- Per-field audit of where each piece of data came from. Powers the
-- "BER from SEAI register" attribution on the review screen.

CREATE TABLE IF NOT EXISTS lettings_field_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  letting_property_id UUID REFERENCES agent_letting_properties(id) ON DELETE CASCADE,
  tenancy_id UUID REFERENCES agent_tenancies(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN (
    'manual', 'eircode', 'google_places', 'seai_register', 'ppr',
    'daft_listing', 'myhome_listing', 'lease_pdf_extraction',
    'intelligence_voice', 'intelligence_text', 'bulk_csv'
  )),
  confidence NUMERIC(3, 2),
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (letting_property_id IS NOT NULL OR tenancy_id IS NOT NULL)
);

CREATE INDEX idx_lettings_field_provenance_property
  ON lettings_field_provenance(letting_property_id) WHERE letting_property_id IS NOT NULL;
CREATE INDEX idx_lettings_field_provenance_tenancy
  ON lettings_field_provenance(tenancy_id) WHERE tenancy_id IS NOT NULL;

ALTER TABLE lettings_field_provenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY lettings_field_provenance_service_role ON lettings_field_provenance
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY lettings_field_provenance_self_access ON lettings_field_provenance
  FOR SELECT USING (
    letting_property_id IN (
      SELECT id FROM agent_letting_properties
      WHERE agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid())
    )
    OR tenancy_id IN (
      SELECT id FROM agent_tenancies
      WHERE agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid())
    )
  );


-- ============================================
-- 7. lettings_maintenance
-- ============================================
-- Lettings-side maintenance tickets. The existing maintenance_requests is
-- for the developer/Care surface (keyed on unit_id and development_id) so
-- we can't reuse it. This is a separate, simpler table for the agent flow.

CREATE TABLE IF NOT EXISTS lettings_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  letting_property_id UUID REFERENCES agent_letting_properties(id) ON DELETE CASCADE NOT NULL,
  tenancy_id UUID REFERENCES agent_tenancies(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES agent_workspaces(id) ON DELETE SET NULL,
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

  contractor_name TEXT,
  contractor_phone TEXT,
  cost_estimate NUMERIC(10, 2),
  cost_actual NUMERIC(10, 2),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lettings_maintenance_property ON lettings_maintenance(letting_property_id);
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
-- 8. Completeness scoring function
-- ============================================
-- Computes 0-100 completeness for a property based on which fields are
-- populated. Adapts to the existing schema (agent_letting_properties +
-- agent_tenancies). Note: status enum on agent_letting_properties uses
-- 'let' / 'vacant' / 'available' / 'occupied' / 'tenanted' / 'empty' — we
-- treat 'let' / 'occupied' / 'tenanted' as "tenanted" for scoring.

CREATE OR REPLACE FUNCTION compute_letting_property_completeness(p_property_id UUID)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  prop RECORD;
  active_tenancy RECORD;
  doc_count INTEGER;
  is_tenanted BOOLEAN;
BEGIN
  SELECT * INTO prop FROM agent_letting_properties WHERE id = p_property_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  is_tenanted := LOWER(COALESCE(prop.status, '')) IN ('let', 'occupied', 'tenanted');

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

  -- Active tenancy fields (30 points if tenanted; full 30 if vacant — vacant
  -- properties shouldn't be penalised for not having a tenancy)
  IF is_tenanted THEN
    SELECT * INTO active_tenancy FROM agent_tenancies
      WHERE letting_property_id = p_property_id AND status = 'active' LIMIT 1;
    IF FOUND THEN
      IF active_tenancy.rent_pcm IS NOT NULL THEN score := score + 6; END IF;
      IF active_tenancy.deposit_amount IS NOT NULL THEN score := score + 4; END IF;
      IF active_tenancy.lease_start IS NOT NULL THEN score := score + 4; END IF;
      IF active_tenancy.lease_end IS NOT NULL THEN score := score + 4; END IF;
      IF active_tenancy.rtb_registration_number IS NOT NULL THEN score := score + 8; END IF;
      IF active_tenancy.lease_type IS NOT NULL THEN score := score + 4; END IF;
    END IF;
  ELSE
    score := score + 30;
  END IF;

  -- Documents (10 points total — lease + BER cert)
  SELECT COUNT(*) INTO doc_count FROM lettings_documents
    WHERE letting_property_id = p_property_id AND doc_type IN ('lease', 'ber_cert');
  IF doc_count >= 2 THEN score := score + 10;
  ELSIF doc_count = 1 THEN score := score + 5;
  END IF;

  RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Trigger: recompute completeness on property update
CREATE OR REPLACE FUNCTION trg_update_letting_property_completeness()
RETURNS TRIGGER AS $$
BEGIN
  NEW.completeness_score := compute_letting_property_completeness(NEW.id);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_letting_properties_completeness ON agent_letting_properties;
CREATE TRIGGER agent_letting_properties_completeness
  BEFORE UPDATE ON agent_letting_properties
  FOR EACH ROW EXECUTE FUNCTION trg_update_letting_property_completeness();


-- Trigger: touch parent property when tenancy changes (so completeness recomputes)
CREATE OR REPLACE FUNCTION trg_touch_letting_property_from_tenancy()
RETURNS TRIGGER AS $$
DECLARE
  pid UUID;
BEGIN
  pid := COALESCE(NEW.letting_property_id, OLD.letting_property_id);
  IF pid IS NOT NULL THEN
    UPDATE agent_letting_properties SET updated_at = now() WHERE id = pid;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_tenancies_touch_property ON agent_tenancies;
CREATE TRIGGER agent_tenancies_touch_property
  AFTER INSERT OR UPDATE OR DELETE ON agent_tenancies
  FOR EACH ROW EXECUTE FUNCTION trg_touch_letting_property_from_tenancy();


-- ============================================
-- 9. Backfill: completeness scores for existing 14 properties + 12 tenancies
-- ============================================
-- Recomputes completeness for every existing property so the scores are
-- accurate from the start. Touches updated_at to fire the trigger.

UPDATE agent_letting_properties
  SET updated_at = now()
  WHERE id IN (SELECT id FROM agent_letting_properties);


-- ============================================
-- 10. Seed: workspaces for agent-test@test.ie
-- ============================================
-- Confirmed via inspection: agent_id 0f9210e0-342d-4f98-9be1-95decb6f507a
-- exists for tenant 4cee69c6-be4b-486e-9c33-2b5a7d30e287.

INSERT INTO agent_workspaces (agent_id, tenant_id, mode, display_name, is_default)
VALUES
  ('0f9210e0-342d-4f98-9be1-95decb6f507a', '4cee69c6-be4b-486e-9c33-2b5a7d30e287',
   'sales', 'Hennessy & Co — Sales', true),
  ('0f9210e0-342d-4f98-9be1-95decb6f507a', '4cee69c6-be4b-486e-9c33-2b5a7d30e287',
   'lettings', 'Hennessy & Co — Lettings', false)
ON CONFLICT (agent_id, mode) DO NOTHING;


-- ============================================
-- 11. Backfill: tag existing 14 properties + 12 tenancies with the lettings workspace
-- ============================================
-- The existing rows pre-date the workspace concept. Any property/tenancy
-- whose agent matches the test agent gets tagged with that agent's lettings
-- workspace. For other agents (none expected currently), the workspace_id
-- stays NULL and they'll need to be tagged later.

UPDATE agent_letting_properties
SET workspace_id = (
  SELECT id FROM agent_workspaces
  WHERE agent_id = agent_letting_properties.agent_id AND mode = 'lettings'
  LIMIT 1
)
WHERE workspace_id IS NULL;

UPDATE agent_tenancies
SET workspace_id = (
  SELECT id FROM agent_workspaces
  WHERE agent_id = agent_tenancies.agent_id AND mode = 'lettings'
  LIMIT 1
)
WHERE workspace_id IS NULL;


-- ============================================
-- DONE
-- ============================================
-- Verification queries to run after migration:
--
--   SELECT id, mode, display_name, is_default FROM agent_workspaces;
--   SELECT COUNT(*) FROM agent_letting_properties WHERE workspace_id IS NOT NULL;
--   SELECT COUNT(*) FROM agent_tenancies WHERE workspace_id IS NOT NULL;
--   SELECT id, address, completeness_score FROM agent_letting_properties LIMIT 5;
--   SELECT proname FROM pg_proc WHERE proname LIKE 'compute_letting%';
