# Assistant OS Database Schema

This document describes the database tables added to support the Assistant Operating System governance layer.

## Tables

### 1. scheme_profile

**Purpose**: Stores structured data about each development/scheme used by the AI assistant to answer questions accurately without hallucination.

**Key Fields**:
- `id` (uuid): Primary key
- `developer_org_id` (uuid): References the developer organization (Supabase tenant)
- `scheme_name` (text): Development/scheme name
- `scheme_address` (text): Full address
- `scheme_lat`, `scheme_lng` (double precision): Coordinates for POI lookups
- `scheme_status` (enum): Construction status (under_construction, partially_occupied, fully_occupied)
- `homes_count` (integer): Number of homes in the development

**Contact Section**:
- `managing_agent_name`, `contact_email`, `contact_phone`: Primary contact info
- `emergency_contact_phone`, `emergency_contact_notes`: For Tier 2 emergency routing
- `snag_reporting_method` (enum): How to report defects (email, portal, form, developer_contact)
- `snag_reporting_details` (text): Additional instructions

**Core Facts Section**:
- `heating_type` (enum): air_to_water, gas_boiler, district, mixed, unknown
- `heating_controls` (enum): central_controller, zoned_thermostats, unknown
- `broadband_type` (enum): siro, openeir, other, unknown
- `water_billing` (enum): direct, via_management, unknown

**Waste & Parking Section**:
- `waste_setup` (enum): individual_bins, communal_store, mixed, unknown
- `bin_storage_notes`, `waste_provider`: Additional waste details
- `parking_type` (enum): allocated, unallocated, permit, mixed, unknown
- `visitor_parking` (enum): yes_designated, limited, none, unknown
- `parking_notes`: Additional parking info

**Rules Section**:
- `has_house_rules` (boolean): Whether scheme has house rules document
- `exterior_changes_require_approval` (enum): yes, no, case_by_case, unknown
- `rules_notes`: Additional rules info

**Authority Flags** (determines source priority per section):
- `authority_contacts` (enum): form or documents
- `authority_core_facts` (enum): form or documents
- `authority_waste_parking` (enum): form or documents
- `authority_rules` (enum): form or documents
- `authority_snagging` (enum): form or documents

**Usage**: When the assistant answers a question, it first checks the relevant authority flag to determine whether to use form data or search documents.

---

### 2. unit_profile

**Purpose**: Stores per-unit overrides and specific information that differs from the scheme defaults.

**Key Fields**:
- `id` (uuid): Primary key
- `scheme_id` (uuid): Foreign key to scheme_profile
- `unit_code` (text): Unit identifier (e.g., "A-101")
- `house_type` (text): House type code for document matching
- `heating_overrides` (jsonb): Per-unit heating differences
- `broadband_overrides` (jsonb): Per-unit broadband differences
- `shutoff_location_notes` (text): Where to find water/gas shutoffs
- `meter_location_notes` (text): Where to find meters

**Usage**: When answering unit-specific questions, the assistant checks for overrides before falling back to scheme defaults.

---

### 3. poi_cache

**Purpose**: Caches Google Places API results to reduce costs and improve response times.

**Key Fields**:
- `id` (uuid): Primary key
- `scheme_id` (uuid): Foreign key to scheme_profile
- `category` (text): POI category (e.g., "supermarket", "pharmacy", "gym")
- `provider` (text): API provider, defaults to "google_places"
- `results_json` (jsonb): Cached API response
- `fetched_at` (timestamptz): When the cache was populated
- `ttl_days` (integer): Cache validity period, defaults to 30

**Usage**: Before making a Google Places API call, check if valid cached results exist. Refresh when `fetched_at + ttl_days` has passed.

---

### 4. answer_gap_log

**Purpose**: Tracks questions the assistant couldn't answer to identify missing data and improve coverage.

**Key Fields**:
- `id` (uuid): Primary key
- `scheme_id` (uuid): Foreign key to scheme_profile
- `unit_id` (uuid): Optional unit reference
- `user_question` (text): The original question
- `intent_type` (text): Classified intent (scheme_fact, unit_fact, document_answer, etc.)
- `attempted_sources` (jsonb): Which sources were tried
- `final_source` (text): What source (if any) was used
- `gap_reason` (text): Why the question couldn't be answered

**Gap Reasons**:
- `missing_scheme_data`: Form data not filled in
- `missing_docs`: No relevant documents uploaded
- `low_doc_confidence`: Documents found but low relevance score
- `no_poi_results`: No places found for location query
- `out_of_scope`: Question outside assistant's domain

**Usage**: Developers can query this table to identify common unanswered questions and improve their scheme setup.

---

## Indexes

- `scheme_profile_developer_org_idx`: Fast lookup by developer
- `scheme_profile_name_idx`: Fast lookup by scheme name
- `unit_profile_scheme_idx`: Fast lookup of units by scheme
- `unit_profile_scheme_unit_idx`: Unique unit lookup
- `poi_cache_scheme_category_idx`: Fast cache lookup
- `answer_gap_log_scheme_idx`: Gap analysis by scheme
- `answer_gap_log_gap_reason_idx`: Analysis by reason type

---

## Enums

| Enum Name | Values |
|-----------|--------|
| scheme_status_enum | under_construction, partially_occupied, fully_occupied |
| snag_reporting_method_enum | email, portal, form, developer_contact, unknown |
| heating_type_enum | air_to_water, gas_boiler, district, mixed, unknown |
| heating_controls_enum | central_controller, zoned_thermostats, unknown |
| broadband_type_enum | siro, openeir, other, unknown |
| water_billing_enum | direct, via_management, unknown |
| waste_setup_enum | individual_bins, communal_store, mixed, unknown |
| parking_type_enum | allocated, unallocated, permit, mixed, unknown |
| visitor_parking_enum | yes_designated, limited, none, unknown |
| approval_required_enum | yes, no, case_by_case, unknown |
| authority_source_enum | form, documents, unknown |

---

## Migration

The schema is defined in `packages/db/schema.ts` (Drizzle ORM).

Raw SQL migration available at: `migrations/0001_assistant_os_schema.sql`

To apply manually (if db:push requires interactive input):
```sql
-- Run the migration SQL file against Supabase
\i migrations/0001_assistant_os_schema.sql
```

---

## RLS Policies (Supabase)

Add these in the Supabase dashboard:

**scheme_profile**:
- Developers: SELECT, INSERT, UPDATE on rows where `developer_org_id` matches their tenant
- Purchasers: SELECT only on non-admin fields

**unit_profile**:
- Developers: Full access to units in their schemes
- Purchasers: SELECT only on their assigned unit

**poi_cache**:
- Service role only (API manages this table)

**answer_gap_log**:
- Developers: SELECT on their schemes for gap analysis
- Purchasers: INSERT only (to log their unanswered questions)
