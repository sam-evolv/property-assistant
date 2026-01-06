CREATE TYPE "public"."approval_required_enum" AS ENUM('yes', 'no', 'case_by_case', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."authority_source_enum" AS ENUM('form', 'documents', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."broadband_type_enum" AS ENUM('siro', 'openeir', 'other', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."heating_controls_enum" AS ENUM('central_controller', 'zoned_thermostats', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."heating_type_enum" AS ENUM('air_to_water', 'gas_boiler', 'district', 'mixed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."parking_type_enum" AS ENUM('allocated', 'unallocated', 'permit', 'mixed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."scheme_status_enum" AS ENUM('under_construction', 'partially_occupied', 'fully_occupied');--> statement-breakpoint
CREATE TYPE "public"."snag_reporting_method_enum" AS ENUM('email', 'portal', 'form', 'developer_contact', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."visitor_parking_enum" AS ENUM('yes_designated', 'limited', 'none', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."waste_setup_enum" AS ENUM('individual_bins', 'communal_store', 'mixed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."water_billing_enum" AS ENUM('direct', 'via_management', 'unknown');--> statement-breakpoint
CREATE TABLE "answer_gap_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheme_id" uuid NOT NULL,
	"unit_id" uuid,
	"user_question" text NOT NULL,
	"intent_type" text,
	"attempted_sources" jsonb,
	"final_source" text,
	"gap_reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poi_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheme_id" uuid NOT NULL,
	"category" text NOT NULL,
	"provider" text DEFAULT 'google_places' NOT NULL,
	"results_json" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ttl_days" integer DEFAULT 30 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheme_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"developer_org_id" uuid NOT NULL,
	"scheme_name" text NOT NULL,
	"scheme_address" text,
	"scheme_lat" double precision,
	"scheme_lng" double precision,
	"scheme_status" "scheme_status_enum" DEFAULT 'under_construction',
	"homes_count" integer,
	"managing_agent_name" text,
	"contact_email" text,
	"contact_phone" text,
	"emergency_contact_phone" text,
	"emergency_contact_notes" text,
	"snag_reporting_method" "snag_reporting_method_enum" DEFAULT 'unknown',
	"snag_reporting_details" text,
	"heating_type" "heating_type_enum" DEFAULT 'unknown',
	"heating_controls" "heating_controls_enum" DEFAULT 'unknown',
	"broadband_type" "broadband_type_enum" DEFAULT 'unknown',
	"water_billing" "water_billing_enum" DEFAULT 'unknown',
	"waste_setup" "waste_setup_enum" DEFAULT 'unknown',
	"bin_storage_notes" text,
	"waste_provider" text,
	"parking_type" "parking_type_enum" DEFAULT 'unknown',
	"visitor_parking" "visitor_parking_enum" DEFAULT 'unknown',
	"parking_notes" text,
	"has_house_rules" boolean DEFAULT false,
	"exterior_changes_require_approval" "approval_required_enum" DEFAULT 'unknown',
	"rules_notes" text,
	"authority_contacts" "authority_source_enum" DEFAULT 'unknown',
	"authority_core_facts" "authority_source_enum" DEFAULT 'unknown',
	"authority_waste_parking" "authority_source_enum" DEFAULT 'unknown',
	"authority_rules" "authority_source_enum" DEFAULT 'unknown',
	"authority_snagging" "authority_source_enum" DEFAULT 'unknown',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheme_id" uuid NOT NULL,
	"unit_code" text NOT NULL,
	"house_type" text,
	"heating_overrides" jsonb,
	"broadband_overrides" jsonb,
	"shutoff_location_notes" text,
	"meter_location_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_resources" DROP CONSTRAINT "video_resources_development_id_developments_id_fk";
--> statement-breakpoint
ALTER TABLE "answer_gap_log" ADD CONSTRAINT "answer_gap_log_scheme_id_scheme_profile_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."scheme_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poi_cache" ADD CONSTRAINT "poi_cache_scheme_id_scheme_profile_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."scheme_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_profile" ADD CONSTRAINT "unit_profile_scheme_id_scheme_profile_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."scheme_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "answer_gap_log_scheme_idx" ON "answer_gap_log" USING btree ("scheme_id");--> statement-breakpoint
CREATE INDEX "answer_gap_log_intent_type_idx" ON "answer_gap_log" USING btree ("intent_type");--> statement-breakpoint
CREATE INDEX "answer_gap_log_gap_reason_idx" ON "answer_gap_log" USING btree ("gap_reason");--> statement-breakpoint
CREATE INDEX "answer_gap_log_created_at_idx" ON "answer_gap_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "poi_cache_scheme_idx" ON "poi_cache" USING btree ("scheme_id");--> statement-breakpoint
CREATE INDEX "poi_cache_category_idx" ON "poi_cache" USING btree ("category");--> statement-breakpoint
CREATE INDEX "poi_cache_scheme_category_idx" ON "poi_cache" USING btree ("scheme_id","category");--> statement-breakpoint
CREATE INDEX "scheme_profile_developer_org_idx" ON "scheme_profile" USING btree ("developer_org_id");--> statement-breakpoint
CREATE INDEX "scheme_profile_name_idx" ON "scheme_profile" USING btree ("scheme_name");--> statement-breakpoint
CREATE INDEX "unit_profile_scheme_idx" ON "unit_profile" USING btree ("scheme_id");--> statement-breakpoint
CREATE INDEX "unit_profile_unit_code_idx" ON "unit_profile" USING btree ("unit_code");--> statement-breakpoint
CREATE INDEX "unit_profile_scheme_unit_idx" ON "unit_profile" USING btree ("scheme_id","unit_code");