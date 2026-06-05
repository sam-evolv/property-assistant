-- 067_snagging_v1.sql
-- ============================================================================
-- SNAGGING V1 — evolve snag_items (migration 027) into the per-unit "system of
-- account", and add contractors for accountability / scorecards.
--
-- This is ADDITIVE and BACK-COMPATIBLE. Every column that already exists on
-- snag_items is preserved, and every new column is nullable or defaulted, so the
-- four dev-app routes that read snag_items today keep working unchanged:
--   - app/api/dev-app/overview/attention   (counts open snags per development)
--   - app/api/dev-app/activity
--   - app/api/dev-app/intelligence/chat
--   - app/api/dev-app/developments/[devId]  (section=snagging)
--
-- ACCESS MODEL (decided with product): tenant/development scoping is enforced in
-- APPLICATION CODE, consistent with the existing dev-app routes (which scope by
-- developments.developer_user_id) and the assistant family (migration 065).
-- snag_items / contractors are read and written by the route handlers via the
-- service role (getSupabaseAdmin), AFTER the handler has verified ownership.
-- RLS is enabled with no permissive policy for `authenticated`, so a stray
-- user-scoped client cannot read across tenants. To switch to per-row RLS later,
-- add: USING (tenant_id = (auth.jwt()->>'tenant_id')::uuid).
--
-- RUN MANUALLY in the Supabase SQL Editor (same as the rest of this folder).
-- This file is NOT auto-applied. Rollback notes at the bottom.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) contractors — the party a snag is attributed to (powers scorecards/trends)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contractors (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    trades        TEXT[] NOT NULL DEFAULT '{}',
    contact_name  TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    external_ref  TEXT,                      -- id in the builder's own system, if any
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contractors_tenant_idx ON contractors(tenant_id);
CREATE INDEX IF NOT EXISTS contractors_active_idx ON contractors(tenant_id, is_active);

CREATE OR REPLACE FUNCTION update_contractors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_contractors_updated_at ON contractors;
CREATE TRIGGER update_contractors_updated_at
    BEFORE UPDATE ON contractors
    FOR EACH ROW
    EXECUTE FUNCTION update_contractors_updated_at();

-- RLS: enabled; access via service role + app-code scoping (see ACCESS MODEL).
-- No permissive `authenticated` policy on purpose, so direct user-scoped reads
-- are denied and cannot leak across tenants. service_role has BYPASSRLS.
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
GRANT ALL ON contractors TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON contractors TO authenticated;

-- ----------------------------------------------------------------------------
-- 2) snag_items — widen into the multi-sided system of account
-- ----------------------------------------------------------------------------
ALTER TABLE snag_items
    ADD COLUMN IF NOT EXISTS title                     TEXT,
    ADD COLUMN IF NOT EXISTS severity                  TEXT NOT NULL DEFAULT 'minor',
    ADD COLUMN IF NOT EXISTS trade                     TEXT,
    ADD COLUMN IF NOT EXISTS location                  TEXT,            -- room / area in the unit
    ADD COLUMN IF NOT EXISTS responsible_contractor_id UUID REFERENCES contractors(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS created_by_role           TEXT,            -- builder_crew|purchaser_snagger|homeowner|site_manager|developer
    ADD COLUMN IF NOT EXISTS created_by_user_id        UUID,
    ADD COLUMN IF NOT EXISTS source                    TEXT NOT NULL DEFAULT 'in_app', -- in_app|uploaded_report|homeowner_chat|import
    ADD COLUMN IF NOT EXISTS photo_urls                JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS ai_classification         JSONB,           -- {type, severity, trade, confidence}
    ADD COLUMN IF NOT EXISTS ai_dedup_group            UUID,            -- groups likely-duplicate snags
    ADD COLUMN IF NOT EXISTS sla_due_at                TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS verified_by               UUID,
    ADD COLUMN IF NOT EXISTS verified_at               TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS closed_at                 TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS offline_client_id         TEXT,            -- idempotency key from the mobile app
    ADD COLUMN IF NOT EXISTS issue_report_id           UUID,            -- link to homeowner assistant issue (V1.1)
    ADD COLUMN IF NOT EXISTS metadata                  JSONB NOT NULL DEFAULT '{}'::jsonb;

-- severity vocabulary
ALTER TABLE snag_items DROP CONSTRAINT IF EXISTS snag_items_severity_check;
ALTER TABLE snag_items ADD  CONSTRAINT snag_items_severity_check
    CHECK (severity IN ('safety', 'major', 'minor', 'cosmetic'));

-- widen status vocabulary (was: open | in_progress | resolved). Existing values
-- stay valid, so the routes filtering on open/in_progress/resolved are unaffected.
-- NOTE: the inline CHECK from migration 027 is named snag_items_status_check by
-- Postgres default. If your DB renamed it, adjust the DROP below.
ALTER TABLE snag_items DROP CONSTRAINT IF EXISTS snag_items_status_check;
ALTER TABLE snag_items ADD  CONSTRAINT snag_items_status_check
    CHECK (status IN ('open', 'in_progress', 'resolved', 'verified', 'disputed', 'wont_fix'));

-- source vocabulary
ALTER TABLE snag_items DROP CONSTRAINT IF EXISTS snag_items_source_check;
ALTER TABLE snag_items ADD  CONSTRAINT snag_items_source_check
    CHECK (source IN ('in_app', 'uploaded_report', 'homeowner_chat', 'import'));

-- created_by_role vocabulary (nullable; legacy rows have NULL)
ALTER TABLE snag_items DROP CONSTRAINT IF EXISTS snag_items_created_by_role_check;
ALTER TABLE snag_items ADD  CONSTRAINT snag_items_created_by_role_check
    CHECK (created_by_role IS NULL OR created_by_role IN
        ('builder_crew', 'purchaser_snagger', 'homeowner', 'site_manager', 'developer'));

-- backfill: snag_items.tenant_id is nullable today; populate from the unit
UPDATE snag_items s
   SET tenant_id = u.tenant_id
  FROM units u
 WHERE s.unit_id = u.id
   AND s.tenant_id IS NULL;

-- backfill: fold the single photo_url into the new photo_urls array
UPDATE snag_items
   SET photo_urls = jsonb_build_array(photo_url)
 WHERE photo_url IS NOT NULL
   AND (photo_urls IS NULL OR photo_urls = '[]'::jsonb);

-- indexes for the new access paths
CREATE INDEX IF NOT EXISTS snag_items_contractor_idx ON snag_items(responsible_contractor_id);
CREATE INDEX IF NOT EXISTS snag_items_severity_idx   ON snag_items(severity);
CREATE INDEX IF NOT EXISTS snag_items_tenant_idx     ON snag_items(tenant_id);
CREATE INDEX IF NOT EXISTS snag_items_sla_idx        ON snag_items(sla_due_at) WHERE sla_due_at IS NOT NULL;

-- offline idempotency: a mobile-minted client id is unique per tenant, so
-- replaying a queued create after reconnect cannot duplicate the snag.
CREATE UNIQUE INDEX IF NOT EXISTS snag_items_offline_client_uniq
    ON snag_items(tenant_id, offline_client_id) WHERE offline_client_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3) contractor_scorecard — read-only payoff (the "method of account").
--    Optional: safe to keep or drop. Callers must filter by tenant_id (the
--    routes query it via the service role and pass .eq('tenant_id', ...)).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW contractor_scorecard WITH (security_invoker = true) AS
SELECT
    c.id        AS contractor_id,
    c.tenant_id,
    c.name,
    COUNT(s.id)                                                    AS total_snags,
    COUNT(s.id) FILTER (WHERE s.severity = 'safety')              AS safety_snags,
    COUNT(s.id) FILTER (WHERE s.status IN ('open', 'in_progress')) AS open_snags,
    COUNT(s.id) FILTER (WHERE s.status IN ('resolved', 'verified')) AS closed_snags,
    AVG(EXTRACT(EPOCH FROM (COALESCE(s.resolved_at, s.closed_at) - s.created_at)) / 86400.0)
        FILTER (WHERE COALESCE(s.resolved_at, s.closed_at) IS NOT NULL) AS avg_days_to_close
FROM contractors c
LEFT JOIN snag_items s ON s.responsible_contractor_id = c.id
GROUP BY c.id, c.tenant_id, c.name;

-- ============================================================================
-- ROLLBACK
--   DROP VIEW IF EXISTS contractor_scorecard;
--   DROP INDEX IF EXISTS snag_items_offline_client_uniq;
--   DROP INDEX IF EXISTS snag_items_sla_idx;
--   DROP INDEX IF EXISTS snag_items_tenant_idx;
--   DROP INDEX IF EXISTS snag_items_severity_idx;
--   DROP INDEX IF EXISTS snag_items_contractor_idx;
--   ALTER TABLE snag_items
--     DROP CONSTRAINT IF EXISTS snag_items_created_by_role_check,
--     DROP CONSTRAINT IF EXISTS snag_items_source_check,
--     DROP CONSTRAINT IF EXISTS snag_items_severity_check;
--   -- (leave snag_items_status_check; re-add the original 3-value check if needed)
--   ALTER TABLE snag_items
--     DROP COLUMN IF EXISTS metadata, DROP COLUMN IF EXISTS issue_report_id,
--     DROP COLUMN IF EXISTS offline_client_id, DROP COLUMN IF EXISTS closed_at,
--     DROP COLUMN IF EXISTS verified_at, DROP COLUMN IF EXISTS verified_by,
--     DROP COLUMN IF EXISTS sla_due_at, DROP COLUMN IF EXISTS ai_dedup_group,
--     DROP COLUMN IF EXISTS ai_classification, DROP COLUMN IF EXISTS photo_urls,
--     DROP COLUMN IF EXISTS source, DROP COLUMN IF EXISTS created_by_user_id,
--     DROP COLUMN IF EXISTS created_by_role,
--     DROP COLUMN IF EXISTS responsible_contractor_id,
--     DROP COLUMN IF EXISTS location, DROP COLUMN IF EXISTS trade,
--     DROP COLUMN IF EXISTS severity, DROP COLUMN IF EXISTS title;
--   DROP TABLE IF EXISTS contractors;
-- ============================================================================
