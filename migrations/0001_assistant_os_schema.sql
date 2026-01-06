-- Assistant OS Schema Migration
-- Creates scheme_profile, unit_profile, poi_cache, and answer_gap_log tables

-- Create enums
DO $$ BEGIN
    CREATE TYPE scheme_status_enum AS ENUM ('under_construction', 'partially_occupied', 'fully_occupied');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE snag_reporting_method_enum AS ENUM ('email', 'portal', 'form', 'developer_contact', 'unknown');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE heating_type_enum AS ENUM ('air_to_water', 'gas_boiler', 'district', 'mixed', 'unknown');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE heating_controls_enum AS ENUM ('central_controller', 'zoned_thermostats', 'unknown');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE broadband_type_enum AS ENUM ('siro', 'openeir', 'other', 'unknown');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE water_billing_enum AS ENUM ('direct', 'via_management', 'unknown');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE waste_setup_enum AS ENUM ('individual_bins', 'communal_store', 'mixed', 'unknown');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE parking_type_enum AS ENUM ('allocated', 'unallocated', 'permit', 'mixed', 'unknown');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE visitor_parking_enum AS ENUM ('yes_designated', 'limited', 'none', 'unknown');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE approval_required_enum AS ENUM ('yes', 'no', 'case_by_case', 'unknown');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE authority_source_enum AS ENUM ('form', 'documents', 'unknown');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Create scheme_profile table
CREATE TABLE IF NOT EXISTS scheme_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    developer_org_id UUID NOT NULL,
    scheme_name TEXT NOT NULL,
    scheme_address TEXT,
    scheme_lat DOUBLE PRECISION,
    scheme_lng DOUBLE PRECISION,
    scheme_status scheme_status_enum DEFAULT 'under_construction',
    homes_count INTEGER,
    
    -- Contacts
    managing_agent_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_notes TEXT,
    snag_reporting_method snag_reporting_method_enum DEFAULT 'unknown',
    snag_reporting_details TEXT,
    
    -- Core facts
    heating_type heating_type_enum DEFAULT 'unknown',
    heating_controls heating_controls_enum DEFAULT 'unknown',
    broadband_type broadband_type_enum DEFAULT 'unknown',
    water_billing water_billing_enum DEFAULT 'unknown',
    
    -- Waste
    waste_setup waste_setup_enum DEFAULT 'unknown',
    bin_storage_notes TEXT,
    waste_provider TEXT,
    
    -- Parking
    parking_type parking_type_enum DEFAULT 'unknown',
    visitor_parking visitor_parking_enum DEFAULT 'unknown',
    parking_notes TEXT,
    
    -- Rules
    has_house_rules BOOLEAN DEFAULT FALSE,
    exterior_changes_require_approval approval_required_enum DEFAULT 'unknown',
    rules_notes TEXT,
    
    -- Authority flags
    authority_contacts authority_source_enum DEFAULT 'unknown',
    authority_core_facts authority_source_enum DEFAULT 'unknown',
    authority_waste_parking authority_source_enum DEFAULT 'unknown',
    authority_rules authority_source_enum DEFAULT 'unknown',
    authority_snagging authority_source_enum DEFAULT 'unknown',
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for scheme_profile
CREATE INDEX IF NOT EXISTS scheme_profile_developer_org_idx ON scheme_profile(developer_org_id);
CREATE INDEX IF NOT EXISTS scheme_profile_name_idx ON scheme_profile(scheme_name);

-- Create unit_profile table
CREATE TABLE IF NOT EXISTS unit_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_id UUID NOT NULL REFERENCES scheme_profile(id),
    unit_code TEXT NOT NULL,
    house_type TEXT,
    heating_overrides JSONB,
    broadband_overrides JSONB,
    shutoff_location_notes TEXT,
    meter_location_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for unit_profile
CREATE INDEX IF NOT EXISTS unit_profile_scheme_idx ON unit_profile(scheme_id);
CREATE INDEX IF NOT EXISTS unit_profile_unit_code_idx ON unit_profile(unit_code);
CREATE INDEX IF NOT EXISTS unit_profile_scheme_unit_idx ON unit_profile(scheme_id, unit_code);

-- Create poi_cache table
CREATE TABLE IF NOT EXISTS poi_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_id UUID NOT NULL REFERENCES scheme_profile(id),
    category TEXT NOT NULL,
    provider TEXT DEFAULT 'google_places' NOT NULL,
    results_json JSONB NOT NULL,
    fetched_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    ttl_days INTEGER DEFAULT 30 NOT NULL
);

-- Create indexes for poi_cache
CREATE INDEX IF NOT EXISTS poi_cache_scheme_idx ON poi_cache(scheme_id);
CREATE INDEX IF NOT EXISTS poi_cache_category_idx ON poi_cache(category);
CREATE INDEX IF NOT EXISTS poi_cache_scheme_category_idx ON poi_cache(scheme_id, category);

-- Create answer_gap_log table
CREATE TABLE IF NOT EXISTS answer_gap_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_id UUID NOT NULL REFERENCES scheme_profile(id),
    unit_id UUID,
    user_question TEXT NOT NULL,
    intent_type TEXT,
    attempted_sources JSONB,
    final_source TEXT,
    gap_reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for answer_gap_log
CREATE INDEX IF NOT EXISTS answer_gap_log_scheme_idx ON answer_gap_log(scheme_id);
CREATE INDEX IF NOT EXISTS answer_gap_log_intent_type_idx ON answer_gap_log(intent_type);
CREATE INDEX IF NOT EXISTS answer_gap_log_gap_reason_idx ON answer_gap_log(gap_reason);
CREATE INDEX IF NOT EXISTS answer_gap_log_created_at_idx ON answer_gap_log(created_at);

-- Grant permissions (RLS policies would be added in Supabase dashboard)
-- Developers can access only their scheme rows
-- Purchaser users can read only the scheme_profile fields needed for answering
