-- ============================================================================
-- SALES PIPELINE MIGRATION
-- Creates tables for tracking unit sales lifecycle
-- ============================================================================

-- Create enum for note types
DO $$ BEGIN
    CREATE TYPE pipeline_note_type_enum AS ENUM ('general', 'query', 'issue', 'update');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- unit_sales_pipeline - Main pipeline tracking table
-- ============================================================================
CREATE TABLE IF NOT EXISTS unit_sales_pipeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    development_id UUID NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL UNIQUE REFERENCES units(id) ON DELETE CASCADE,

    -- Purchaser info
    purchaser_name TEXT,
    purchaser_email TEXT,
    purchaser_phone TEXT,

    -- Pipeline stages (all dates with audit trail)

    -- 1. Release - when unit goes on market
    release_date TIMESTAMPTZ,
    release_updated_by UUID REFERENCES admins(id),
    release_updated_at TIMESTAMPTZ,

    -- 2. Sale Agreed
    sale_agreed_date TIMESTAMPTZ,
    sale_agreed_updated_by UUID REFERENCES admins(id),
    sale_agreed_updated_at TIMESTAMPTZ,

    -- 3. Deposit Received
    deposit_date TIMESTAMPTZ,
    deposit_updated_by UUID REFERENCES admins(id),
    deposit_updated_at TIMESTAMPTZ,

    -- 4. Contracts Issued
    contracts_issued_date TIMESTAMPTZ,
    contracts_issued_updated_by UUID REFERENCES admins(id),
    contracts_issued_updated_at TIMESTAMPTZ,

    -- 5. Signed Contracts Received
    signed_contracts_date TIMESTAMPTZ,
    signed_contracts_updated_by UUID REFERENCES admins(id),
    signed_contracts_updated_at TIMESTAMPTZ,

    -- 6. Counter Signed
    counter_signed_date TIMESTAMPTZ,
    counter_signed_updated_by UUID REFERENCES admins(id),
    counter_signed_updated_at TIMESTAMPTZ,

    -- 7. Kitchen Selection
    kitchen_date TIMESTAMPTZ,
    kitchen_updated_by UUID REFERENCES admins(id),
    kitchen_updated_at TIMESTAMPTZ,

    -- 8. Snagging
    snag_date TIMESTAMPTZ,
    snag_updated_by UUID REFERENCES admins(id),
    snag_updated_at TIMESTAMPTZ,

    -- 9. Drawdown
    drawdown_date TIMESTAMPTZ,
    drawdown_updated_by UUID REFERENCES admins(id),
    drawdown_updated_at TIMESTAMPTZ,

    -- 10. Handover
    handover_date TIMESTAMPTZ,
    handover_updated_by UUID REFERENCES admins(id),
    handover_updated_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for unit_sales_pipeline
CREATE INDEX IF NOT EXISTS unit_pipeline_tenant_idx ON unit_sales_pipeline(tenant_id);
CREATE INDEX IF NOT EXISTS unit_pipeline_development_idx ON unit_sales_pipeline(development_id);
CREATE INDEX IF NOT EXISTS unit_pipeline_unit_idx ON unit_sales_pipeline(unit_id);
CREATE INDEX IF NOT EXISTS unit_pipeline_tenant_dev_idx ON unit_sales_pipeline(tenant_id, development_id);
CREATE INDEX IF NOT EXISTS unit_pipeline_release_date_idx ON unit_sales_pipeline(release_date);
CREATE INDEX IF NOT EXISTS unit_pipeline_handover_date_idx ON unit_sales_pipeline(handover_date);

-- ============================================================================
-- unit_pipeline_notes - Notes/queries per unit
-- ============================================================================
CREATE TABLE IF NOT EXISTS unit_pipeline_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pipeline_id UUID NOT NULL REFERENCES unit_sales_pipeline(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,

    note_type pipeline_note_type_enum NOT NULL DEFAULT 'general',
    content TEXT NOT NULL,

    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES admins(id),

    created_by UUID NOT NULL REFERENCES admins(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for unit_pipeline_notes
CREATE INDEX IF NOT EXISTS pipeline_notes_pipeline_idx ON unit_pipeline_notes(pipeline_id);
CREATE INDEX IF NOT EXISTS pipeline_notes_unit_idx ON unit_pipeline_notes(unit_id);
CREATE INDEX IF NOT EXISTS pipeline_notes_tenant_idx ON unit_pipeline_notes(tenant_id);
CREATE INDEX IF NOT EXISTS pipeline_notes_unresolved_idx ON unit_pipeline_notes(is_resolved, created_at);
CREATE INDEX IF NOT EXISTS pipeline_notes_tenant_unresolved_idx ON unit_pipeline_notes(tenant_id, is_resolved);

-- ============================================================================
-- Trigger for updated_at timestamps
-- ============================================================================
CREATE OR REPLACE FUNCTION update_pipeline_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_unit_sales_pipeline_updated_at ON unit_sales_pipeline;
CREATE TRIGGER update_unit_sales_pipeline_updated_at
    BEFORE UPDATE ON unit_sales_pipeline
    FOR EACH ROW
    EXECUTE FUNCTION update_pipeline_updated_at();

DROP TRIGGER IF EXISTS update_unit_pipeline_notes_updated_at ON unit_pipeline_notes;
CREATE TRIGGER update_unit_pipeline_notes_updated_at
    BEFORE UPDATE ON unit_pipeline_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_pipeline_updated_at();

-- ============================================================================
-- RLS Policies (Row Level Security)
-- ============================================================================

-- Enable RLS
ALTER TABLE unit_sales_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_pipeline_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their tenant's data
DROP POLICY IF EXISTS unit_sales_pipeline_tenant_isolation ON unit_sales_pipeline;
CREATE POLICY unit_sales_pipeline_tenant_isolation ON unit_sales_pipeline
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS unit_pipeline_notes_tenant_isolation ON unit_pipeline_notes;
CREATE POLICY unit_pipeline_notes_tenant_isolation ON unit_pipeline_notes
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON unit_sales_pipeline TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON unit_pipeline_notes TO authenticated;

-- Grant permissions to service role (bypasses RLS)
GRANT ALL ON unit_sales_pipeline TO service_role;
GRANT ALL ON unit_pipeline_notes TO service_role;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE unit_sales_pipeline IS 'Tracks sales lifecycle stages for each unit - replaces developer Excel spreadsheets';
COMMENT ON TABLE unit_pipeline_notes IS 'Notes and queries attached to units in the sales pipeline';

COMMENT ON COLUMN unit_sales_pipeline.release_date IS 'When unit was released for sale';
COMMENT ON COLUMN unit_sales_pipeline.sale_agreed_date IS 'When price was agreed with purchaser';
COMMENT ON COLUMN unit_sales_pipeline.deposit_date IS 'When booking deposit was received';
COMMENT ON COLUMN unit_sales_pipeline.contracts_issued_date IS 'When contracts were sent to purchaser solicitor';
COMMENT ON COLUMN unit_sales_pipeline.signed_contracts_date IS 'When signed contracts were received back';
COMMENT ON COLUMN unit_sales_pipeline.counter_signed_date IS 'When developer counter-signed contracts';
COMMENT ON COLUMN unit_sales_pipeline.kitchen_date IS 'When kitchen selection was completed';
COMMENT ON COLUMN unit_sales_pipeline.snag_date IS 'When snagging was completed';
COMMENT ON COLUMN unit_sales_pipeline.drawdown_date IS 'When mortgage funds were released';
COMMENT ON COLUMN unit_sales_pipeline.handover_date IS 'When keys were handed over';
