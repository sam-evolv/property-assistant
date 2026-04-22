-- Migration: Lettings foundation — rental viewings to applications (Session 4B)
--
-- Adds four tables that sit between agent_letting_properties (existing) and
-- agent_tenancies (existing) to cover the pre-tenancy pipeline: applicants,
-- rental viewings, viewing attendees, and applications. RTB/HAP/tenancy
-- creation stack onto this in later sessions.
--
-- Convention note: the existing lettings surface keys by agent_id which
-- references agent_profiles(id). RLS self-access joins via agent_profiles
-- where user_id = auth.uid(). Matching that pattern so joins and policies
-- stay consistent across the lettings surface.
--
-- Run as three separate query blocks in Supabase SQL Editor:
--   (1) CREATE / ALTER
--   (2) ENABLE RLS
--   (3) CREATE POLICY
-- Never batch together.

-- ============================================
-- 1. Schema
-- ============================================

CREATE TABLE IF NOT EXISTS agent_applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  current_address TEXT,
  employment_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (employment_status IN ('employed', 'self_employed', 'student', 'unemployed', 'retired', 'unknown')),
  employer TEXT,
  annual_income NUMERIC,
  household_size INT,
  has_pets BOOLEAN,
  pet_details TEXT,
  smoker BOOLEAN,
  requested_move_in_date DATE,
  source TEXT NOT NULL DEFAULT 'unknown'
    CHECK (source IN ('daft', 'myhome', 'rent_ie', 'facebook', 'walk_in', 'word_of_mouth', 'other', 'unknown')),
  budget_monthly NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_applicants_agent_created
  ON agent_applicants(agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_rental_viewings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id),
  letting_property_id UUID NOT NULL REFERENCES agent_letting_properties(id) ON DELETE CASCADE,
  viewing_date TIMESTAMPTZ NOT NULL,
  viewing_type TEXT NOT NULL DEFAULT 'individual'
    CHECK (viewing_type IN ('individual', 'group', 'open_house')),
  interest_level TEXT
    CHECK (interest_level IS NULL OR interest_level IN ('low', 'medium', 'high')),
  feedback TEXT,
  next_action TEXT,
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_rental_viewings_agent_date
  ON agent_rental_viewings(agent_id, viewing_date DESC);
CREATE INDEX IF NOT EXISTS idx_agent_rental_viewings_letting_property
  ON agent_rental_viewings(letting_property_id);

CREATE TABLE IF NOT EXISTS agent_rental_viewing_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_viewing_id UUID NOT NULL REFERENCES agent_rental_viewings(id) ON DELETE CASCADE,
  applicant_id UUID REFERENCES agent_applicants(id) ON DELETE SET NULL,
  name_if_unknown TEXT,
  contact_if_known TEXT,
  was_preferred BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT attendee_has_identity CHECK ((applicant_id IS NOT NULL) OR (name_if_unknown IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_rental_viewing_attendees_viewing
  ON agent_rental_viewing_attendees(rental_viewing_id);
CREATE INDEX IF NOT EXISTS idx_rental_viewing_attendees_applicant
  ON agent_rental_viewing_attendees(applicant_id);

CREATE TABLE IF NOT EXISTS agent_rental_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id),
  applicant_id UUID NOT NULL REFERENCES agent_applicants(id) ON DELETE CASCADE,
  letting_property_id UUID NOT NULL REFERENCES agent_letting_properties(id) ON DELETE CASCADE,
  application_date TIMESTAMPTZ DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'received', 'referencing', 'approved', 'rejected', 'withdrawn', 'offer_accepted')),
  references_status TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (references_status IN ('not_requested', 'requested', 'partial', 'complete')),
  aml_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (aml_status IN ('not_started', 'in_progress', 'complete', 'flagged')),
  decision_notes TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_rental_applications_agent_date
  ON agent_rental_applications(agent_id, application_date DESC);
CREATE INDEX IF NOT EXISTS idx_agent_rental_applications_applicant
  ON agent_rental_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_agent_rental_applications_property
  ON agent_rental_applications(letting_property_id);

-- Partial unique index — a single applicant cannot have two active
-- applications on the same property. Rejected / withdrawn are fair game.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_application
  ON agent_rental_applications (applicant_id, letting_property_id)
  WHERE status NOT IN ('rejected', 'withdrawn');

-- ============================================
-- 2. Enable RLS
-- ============================================
ALTER TABLE agent_applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_rental_viewings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_rental_viewing_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_rental_applications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. Policies — drop-if-exists for idempotency
-- ============================================
DROP POLICY IF EXISTS agent_applicants_service_role ON agent_applicants;
DROP POLICY IF EXISTS agent_applicants_self_access ON agent_applicants;
DROP POLICY IF EXISTS agent_rental_viewings_service_role ON agent_rental_viewings;
DROP POLICY IF EXISTS agent_rental_viewings_self_access ON agent_rental_viewings;
DROP POLICY IF EXISTS agent_rental_viewing_attendees_service_role ON agent_rental_viewing_attendees;
DROP POLICY IF EXISTS agent_rental_viewing_attendees_self_access ON agent_rental_viewing_attendees;
DROP POLICY IF EXISTS agent_rental_applications_service_role ON agent_rental_applications;
DROP POLICY IF EXISTS agent_rental_applications_self_access ON agent_rental_applications;

CREATE POLICY agent_applicants_service_role ON agent_applicants
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY agent_applicants_self_access ON agent_applicants
  FOR ALL USING (agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid()));

CREATE POLICY agent_rental_viewings_service_role ON agent_rental_viewings
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY agent_rental_viewings_self_access ON agent_rental_viewings
  FOR ALL USING (agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid()));

-- Attendees join via the viewing's agent_id. Write policy uses EXISTS so a
-- row cannot be inserted for a viewing the caller does not own.
CREATE POLICY agent_rental_viewing_attendees_service_role ON agent_rental_viewing_attendees
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY agent_rental_viewing_attendees_self_access ON agent_rental_viewing_attendees
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM agent_rental_viewings v
      JOIN agent_profiles p ON p.id = v.agent_id
      WHERE v.id = agent_rental_viewing_attendees.rental_viewing_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY agent_rental_applications_service_role ON agent_rental_applications
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY agent_rental_applications_self_access ON agent_rental_applications
  FOR ALL USING (agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid()));
