-- 069_home_user_guides.sql
-- ============================================================================
-- THE AUTO-GENERATED HOME USER GUIDE (HPI QA 8.0 — the Cairn headline).
--
-- Generated from a unit's unit_systems (migration 068) so the guidance is
-- specific to the home's ACTUAL heat pump / MVHR / controls — the thing that
-- replaces the 60-page PDF nobody reads. Versioned and issuable, because QA 8.0
-- wants the guide both delivered AND version-controlled: every generation is a
-- new version; issuing one stamps issued_at and (in the route) writes a
-- handover_events 'guide_issued' row, which flips the unit file's qa8_ready.
--
-- Same access model as 067/068: RLS on, app-code tenant/ownership scoping,
-- service-role reads/writes after the route verifies ownership.
-- RUN MANUALLY in the Supabase SQL Editor. NOT auto-applied.
-- ============================================================================

CREATE TABLE IF NOT EXISTS home_user_guides (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    unit_id      UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    version      INTEGER NOT NULL,
    content      JSONB NOT NULL,            -- structured guide (see lib/dev-app/home-user-guide.ts)
    model        TEXT,                       -- which model generated it
    generated_by UUID,
    status       TEXT NOT NULL DEFAULT 'draft',
    issued_at    TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE home_user_guides DROP CONSTRAINT IF EXISTS home_user_guides_status_check;
ALTER TABLE home_user_guides ADD  CONSTRAINT home_user_guides_status_check
    CHECK (status IN ('draft', 'issued'));

CREATE UNIQUE INDEX IF NOT EXISTS home_user_guides_unit_version_uniq
    ON home_user_guides(unit_id, version);
CREATE INDEX IF NOT EXISTS home_user_guides_unit_idx   ON home_user_guides(unit_id);
CREATE INDEX IF NOT EXISTS home_user_guides_tenant_idx ON home_user_guides(tenant_id);

ALTER TABLE home_user_guides ENABLE ROW LEVEL SECURITY;
GRANT ALL ON home_user_guides TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON home_user_guides TO authenticated;

-- ROLLBACK: DROP TABLE IF EXISTS home_user_guides;
