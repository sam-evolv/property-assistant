-- 068_unit_systems_handover.sql
-- ============================================================================
-- V1.1 GROUNDWORK FOR THE HPI QA 8.0 STORY (the Cairn pitch).
--
-- Two unit-scoped tables that the one-click unit file — and the coming
-- auto-generated Home User Guide — assemble from:
--
--   unit_systems     the building services actually installed in a home
--                    (heat pump, MVHR, solar, controls...), with make/model,
--                    commissioning + warranty docs and maintenance intervals.
--                    This is what lets the assistant educate a homeowner about
--                    THEIR system, and what the Home User Guide is generated from.
--
--   handover_events  the evidence trail QA 8.0 wants: the demo happened, the
--                    Home User Guide was issued, aftercare was activated. An
--                    append-only event log per unit.
--
-- ACCESS MODEL: identical to migration 067 — RLS on, tenant/development scoping
-- enforced in application code, reads/writes via the service role after the
-- route has verified ownership. No permissive `authenticated` policy.
--
-- RUN MANUALLY in the Supabase SQL Editor. NOT auto-applied. Rollback at bottom.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) unit_systems — the installed building services + key specs per unit
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS unit_systems (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                 UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    unit_id                   UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    system_type               TEXT NOT NULL,   -- see CHECK below
    make                      TEXT,
    model                     TEXT,
    serial_number             TEXT,
    key_settings              JSONB NOT NULL DEFAULT '{}'::jsonb,  -- e.g. recommended winter setpoints
    commissioning_date        DATE,
    commissioning_doc_id      UUID,            -- soft ref into documents (decoupled on purpose)
    warranty_start            DATE,
    warranty_end              DATE,
    warranty_doc_id           UUID,
    maintenance_interval_months INTEGER,
    manufacturer_guide_doc_id UUID,
    knowledge_refs            JSONB NOT NULL DEFAULT '[]'::jsonb,  -- links to education content for this system
    notes                     TEXT,
    metadata                  JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE unit_systems DROP CONSTRAINT IF EXISTS unit_systems_system_type_check;
ALTER TABLE unit_systems ADD  CONSTRAINT unit_systems_system_type_check
    CHECK (system_type IN (
        'heat_pump', 'mvhr', 'ventilation', 'solar_pv', 'battery', 'ev_charger',
        'hot_water', 'heating_controls', 'windows', 'smart_home', 'other'
    ));

CREATE INDEX IF NOT EXISTS unit_systems_unit_idx   ON unit_systems(unit_id);
CREATE INDEX IF NOT EXISTS unit_systems_tenant_idx ON unit_systems(tenant_id);
CREATE INDEX IF NOT EXISTS unit_systems_unit_type_idx ON unit_systems(unit_id, system_type);

CREATE OR REPLACE FUNCTION update_unit_systems_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_unit_systems_updated_at ON unit_systems;
CREATE TRIGGER update_unit_systems_updated_at
    BEFORE UPDATE ON unit_systems
    FOR EACH ROW
    EXECUTE FUNCTION update_unit_systems_updated_at();

ALTER TABLE unit_systems ENABLE ROW LEVEL SECURITY;
GRANT ALL ON unit_systems TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON unit_systems TO authenticated;

-- ----------------------------------------------------------------------------
-- 2) handover_events — the QA 8.0 evidence trail (append-only per unit)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS handover_events (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    unit_id                UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    event_type             TEXT NOT NULL,   -- see CHECK below
    occurred_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    conducted_by           UUID,            -- the admin/user who performed it
    conducted_by_name      TEXT,
    attended_by            TEXT,            -- homeowner name / who received the demo
    acknowledgement_ref    TEXT,            -- signature / acknowledgement marker
    home_user_guide_version INTEGER,        -- set on a 'guide_issued' event
    media_refs             JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes                  TEXT,
    metadata               JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE handover_events DROP CONSTRAINT IF EXISTS handover_events_event_type_check;
ALTER TABLE handover_events ADD  CONSTRAINT handover_events_event_type_check
    CHECK (event_type IN (
        'demo_completed', 'guide_issued', 'keys_handed', 'aftercare_activated',
        'inspection', 'other'
    ));

CREATE INDEX IF NOT EXISTS handover_events_unit_idx   ON handover_events(unit_id);
CREATE INDEX IF NOT EXISTS handover_events_tenant_idx ON handover_events(tenant_id);
CREATE INDEX IF NOT EXISTS handover_events_unit_type_idx ON handover_events(unit_id, event_type);

ALTER TABLE handover_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON handover_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON handover_events TO authenticated;

-- ============================================================================
-- ROLLBACK
--   DROP TABLE IF EXISTS handover_events;
--   DROP TABLE IF EXISTS unit_systems;
--   DROP FUNCTION IF EXISTS update_unit_systems_updated_at();
-- ============================================================================
