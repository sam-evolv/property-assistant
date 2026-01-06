CREATE TYPE "public"."archive_mode_enum" AS ENUM('shared', 'isolated');--> statement-breakpoint
CREATE TYPE "public"."upload_status_enum" AS ENUM('pending', 'indexed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."video_provider_enum" AS ENUM('youtube', 'vimeo', 'other');--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'admin' NOT NULL,
	"preferred_role" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"development_id" uuid,
	"house_type_code" varchar(50),
	"event_type" varchar(50) NOT NULL,
	"event_category" varchar(100),
	"event_data" jsonb DEFAULT '{}'::jsonb,
	"session_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"metric" varchar(100) NOT NULL,
	"value" numeric(15, 2) NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_cache" (
	"cache_key" text PRIMARY KEY NOT NULL,
	"value" jsonb,
	"expiry" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "archive_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"development_id" uuid NOT NULL,
	"discipline" text NOT NULL,
	"parent_folder_id" uuid,
	"name" text NOT NULL,
	"color" text,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"type" varchar(50) NOT NULL,
	"action" varchar(100) NOT NULL,
	"actor" varchar(255),
	"actor_id" uuid,
	"actor_role" varchar(50),
	"ip_address" varchar(45),
	"request_path" text,
	"request_payload" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" varchar(100),
	"email" varchar(255),
	"phone" varchar(50),
	"department" varchar(100),
	"priority" integer DEFAULT 0,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "development_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"developer_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"proposed_name" text NOT NULL,
	"location_county" text,
	"location_address" text,
	"estimated_units" integer,
	"target_go_live" text,
	"notes" text,
	"status" varchar(50) DEFAULT 'new' NOT NULL,
	"admin_notes" text,
	"created_development_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"address" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"developer_user_id" uuid,
	"system_instructions" text,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"logo_url" text,
	"important_docs_version" integer DEFAULT 1 NOT NULL,
	"archive_mode" "archive_mode_enum" DEFAULT 'shared' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "developments_code_unique" UNIQUE("code"),
	CONSTRAINT "developments_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "doc_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"development_id" uuid,
	"document_id" uuid,
	"chunk_index" integer DEFAULT 0,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"house_type_code" text,
	"doc_kind" text,
	"source_type" varchar(50) NOT NULL,
	"source_id" uuid,
	"is_important" boolean DEFAULT false NOT NULL,
	"token_count" integer DEFAULT 0,
	"embedding_norm" double precision,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_processing_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid,
	"tenant_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"message" text,
	"details" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"file_url" text NOT NULL,
	"uploaded_by" uuid,
	"change_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"development_id" uuid,
	"house_type_id" uuid,
	"house_type_code" text,
	"document_type" text NOT NULL,
	"doc_kind" text,
	"discipline" text,
	"revision_code" varchar(20),
	"mapping_confidence" double precision,
	"auto_mapped" boolean DEFAULT false NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"title" text NOT NULL,
	"file_name" text NOT NULL,
	"relative_path" text NOT NULL,
	"storage_url" text,
	"ai_tags" jsonb,
	"original_file_name" text,
	"mime_type" varchar(100),
	"size_kb" integer,
	"file_url" text,
	"uploaded_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"processing_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"processing_error" text,
	"chunks_count" integer DEFAULT 0,
	"view_count" integer DEFAULT 0,
	"download_count" integer DEFAULT 0,
	"is_important" boolean DEFAULT false NOT NULL,
	"must_read" boolean DEFAULT false NOT NULL,
	"important_rank" integer,
	"ai_classified" boolean DEFAULT false NOT NULL,
	"ai_classified_at" timestamp with time zone,
	"is_superseded" boolean DEFAULT false NOT NULL,
	"superseded_by" uuid,
	"superseded_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"upload_status" "upload_status_enum" DEFAULT 'pending' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "embedding_cache" (
	"hash" text PRIMARY KEY NOT NULL,
	"embedding" vector(1536),
	"model" text DEFAULT 'text-embedding-3-large',
	"created_at" timestamp DEFAULT now(),
	"last_accessed" timestamp DEFAULT now(),
	"access_count" integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE "error_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"development_id" uuid,
	"error_type" varchar(50) NOT NULL,
	"error_code" varchar(100),
	"error_message" text NOT NULL,
	"stack_trace" text,
	"endpoint" varchar(255),
	"request_context" jsonb DEFAULT '{}'::jsonb,
	"severity" varchar(20) DEFAULT 'error' NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faq_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"development_id" uuid,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"topic" varchar(100),
	"tags" jsonb DEFAULT '[]'::jsonb,
	"priority" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'published' NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"category" varchar(100),
	"keywords" text,
	"embedding" text,
	"priority" integer DEFAULT 0,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"flag_key" varchar(100) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"ticket_id" uuid,
	"message_id" uuid,
	"rating" integer,
	"comment" text,
	"user_id" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "floorplan_vision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"development_id" uuid NOT NULL,
	"house_type_id" uuid,
	"document_id" uuid,
	"floor_name" text,
	"room_name" text NOT NULL,
	"room_type" text,
	"canonical_room_name" text,
	"length_m" double precision,
	"width_m" double precision,
	"area_m2" double precision,
	"notes" text,
	"raw_json" jsonb,
	"confidence" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homeowners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"development_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"house_type" varchar(100),
	"address" text,
	"unique_qr_token" varchar(255),
	"last_active" timestamp with time zone,
	"total_chats" integer DEFAULT 0,
	"total_downloads" integer DEFAULT 0,
	"notices_terms_accepted_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "homeowners_unique_qr_token_unique" UNIQUE("unique_qr_token")
);
--> statement-breakpoint
CREATE TABLE "house_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"development_id" uuid NOT NULL,
	"house_type_code" text NOT NULL,
	"name" text,
	"description" text,
	"total_floor_area_sqm" numeric(10, 2),
	"room_dimensions" jsonb DEFAULT '{}'::jsonb,
	"dimensions" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "important_docs_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"purchaser_id" uuid,
	"development_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"important_docs_version" integer NOT NULL,
	"agreed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "information_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"development_id" uuid NOT NULL,
	"unit_id" uuid,
	"question" text NOT NULL,
	"context" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"response" text,
	"responded_by" uuid,
	"topic" varchar(100),
	"priority" varchar(20) DEFAULT 'normal',
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intel_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"development_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"extraction_method" varchar(50) NOT NULL,
	"model_version" text,
	"raw_output" jsonb DEFAULT '{}'::jsonb,
	"structured_data" jsonb DEFAULT '{}'::jsonb,
	"rooms_extracted" jsonb DEFAULT '[]'::jsonb,
	"suppliers_extracted" jsonb DEFAULT '[]'::jsonb,
	"confidence_scores" jsonb DEFAULT '{}'::jsonb,
	"cost_cents" integer DEFAULT 0,
	"processing_time_ms" integer,
	"page_range" text,
	"error_message" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"priority" varchar(50) DEFAULT 'medium',
	"sla_hours" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"development_id" uuid,
	"house_id" uuid,
	"user_id" varchar(255) NOT NULL,
	"sender" varchar(20),
	"content" text NOT NULL,
	"user_message" text,
	"ai_message" text,
	"question_topic" varchar(100),
	"source" varchar(50) DEFAULT 'chat' NOT NULL,
	"metadata" jsonb,
	"token_count" integer DEFAULT 0,
	"cost_usd" numeric(10, 6) DEFAULT '0',
	"latency_ms" integer,
	"cited_document_ids" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notice_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"notice_id" uuid,
	"comment_id" uuid,
	"action" varchar(50) NOT NULL,
	"actor_type" varchar(20) NOT NULL,
	"actor_id" text,
	"actor_name" text,
	"original_content" jsonb,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notice_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notice_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"development_id" uuid,
	"unit_id" text,
	"author_name" text NOT NULL,
	"author_unit" text,
	"body" text NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"hidden_at" timestamp with time zone,
	"hidden_by" uuid,
	"hidden_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notice_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"notice_id" uuid,
	"comment_id" uuid,
	"reporter_unit_id" text NOT NULL,
	"reason" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"resolution_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "noticeboard_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"development_id" uuid,
	"unit_id" text,
	"title" varchar(500) NOT NULL,
	"content" text NOT NULL,
	"author_id" uuid,
	"author_name" text,
	"author_unit" text,
	"priority" integer DEFAULT 0,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"hidden_at" timestamp with time zone,
	"hidden_by" uuid,
	"hidden_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pois" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "purchaser_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"development_id" uuid,
	"purchaser_name" text,
	"purchaser_email" text,
	"agreed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"important_docs_acknowledged" jsonb DEFAULT '[]'::jsonb,
	"docs_version" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qr_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"development_id" uuid NOT NULL,
	"token" text,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qr_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "rag_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"development_id" uuid NOT NULL,
	"house_type_code" text,
	"document_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 1,
	"reset_time" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "search_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"query" text NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb,
	"results" jsonb NOT NULL,
	"hit_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_url" text,
	"brand" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"contact" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description" text,
	"theme_color" text DEFAULT '#3b82f6',
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "theme_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"primary_color" varchar(7) DEFAULT '#3b82f6' NOT NULL,
	"secondary_color" varchar(7) DEFAULT '#8b5cf6',
	"accent_color" varchar(7) DEFAULT '#06b6d4',
	"logo_url" text,
	"dark_mode" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "theme_config_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"unit_id" uuid,
	"issue_type_id" uuid,
	"title" varchar(500) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'open' NOT NULL,
	"priority" varchar(50) DEFAULT 'medium',
	"assigned_to" uuid,
	"reporter_name" varchar(255),
	"reporter_email" varchar(255),
	"reporter_phone" varchar(50),
	"photo_urls" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"development_id" uuid,
	"file_name" varchar(500) NOT NULL,
	"file_type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0,
	"total_chunks" integer DEFAULT 0,
	"processed_chunks" integer DEFAULT 0,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_room_dimensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"development_id" uuid NOT NULL,
	"house_type_id" uuid NOT NULL,
	"unit_id" uuid,
	"room_name" text NOT NULL,
	"room_key" text NOT NULL,
	"floor" text,
	"length_m" numeric(6, 2),
	"width_m" numeric(6, 2),
	"area_sqm" numeric(7, 2),
	"ceiling_height_m" numeric(5, 2),
	"source" text DEFAULT 'unknown' NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_intelligence_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"development_id" uuid NOT NULL,
	"profile_scope" varchar(20) DEFAULT 'house_type' NOT NULL,
	"unit_id" uuid,
	"house_type_code" text,
	"version" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"quality_score" double precision DEFAULT 0,
	"floor_area_total_sqm" numeric(10, 2),
	"rooms" jsonb DEFAULT '{}'::jsonb,
	"suppliers" jsonb DEFAULT '{}'::jsonb,
	"ber_rating" text,
	"heating" text,
	"hvac" jsonb DEFAULT '{}'::jsonb,
	"field_confidence" jsonb DEFAULT '{}'::jsonb,
	"extraction_passes" jsonb DEFAULT '[]'::jsonb,
	"source_document_ids" uuid[],
	"lineage" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"superseded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"development_id" uuid NOT NULL,
	"development_code" text NOT NULL,
	"unit_number" text NOT NULL,
	"unit_code" text NOT NULL,
	"unit_uid" text NOT NULL,
	"address_line_1" text NOT NULL,
	"address_line_2" text,
	"city" text,
	"state_province" text,
	"postal_code" text,
	"country" text,
	"eircode" text,
	"property_designation" text,
	"property_type" text,
	"house_type_code" text NOT NULL,
	"bedrooms" integer,
	"bathrooms" integer,
	"square_footage" integer,
	"floor_area_m2" numeric(10, 2),
	"purchaser_name" text,
	"purchaser_email" text,
	"purchaser_phone" text,
	"consent_at" timestamp with time zone,
	"mrpn" text,
	"electricity_account" text,
	"esb_eirgrid_number" text,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"last_chat_at" timestamp with time zone,
	"important_docs_agreed_version" integer DEFAULT 0 NOT NULL,
	"important_docs_agreed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "units_unit_uid_unique" UNIQUE("unit_uid")
);
--> statement-breakpoint
CREATE TABLE "user_developments" (
	"user_id" uuid NOT NULL,
	"development_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid,
	"email" text,
	"role" text DEFAULT 'user' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"development_id" uuid NOT NULL,
	"provider" "video_provider_enum" NOT NULL,
	"video_url" text NOT NULL,
	"embed_url" text NOT NULL,
	"video_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"thumbnail_url" text,
	"duration_seconds" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admins" ADD CONSTRAINT "admins_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_daily" ADD CONSTRAINT "analytics_daily_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_folders" ADD CONSTRAINT "archive_folders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_folders" ADD CONSTRAINT "archive_folders_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_folders" ADD CONSTRAINT "archive_folders_created_by_admins_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "development_requests" ADD CONSTRAINT "development_requests_developer_id_admins_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "development_requests" ADD CONSTRAINT "development_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "development_requests" ADD CONSTRAINT "development_requests_created_development_id_developments_id_fk" FOREIGN KEY ("created_development_id") REFERENCES "public"."developments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developments" ADD CONSTRAINT "developments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developments" ADD CONSTRAINT "developments_created_by_admins_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_chunks" ADD CONSTRAINT "doc_chunks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_chunks" ADD CONSTRAINT "doc_chunks_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_chunks" ADD CONSTRAINT "doc_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_processing_logs" ADD CONSTRAINT "document_processing_logs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_processing_logs" ADD CONSTRAINT "document_processing_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_uploaded_by_admins_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_house_type_id_house_types_id_fk" FOREIGN KEY ("house_type_id") REFERENCES "public"."house_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_admins_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_resolved_by_admins_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq_entries" ADD CONSTRAINT "faq_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq_entries" ADD CONSTRAINT "faq_entries_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq_entries" ADD CONSTRAINT "faq_entries_created_by_admins_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq_entries" ADD CONSTRAINT "faq_entries_updated_by_admins_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floorplan_vision" ADD CONSTRAINT "floorplan_vision_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floorplan_vision" ADD CONSTRAINT "floorplan_vision_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floorplan_vision" ADD CONSTRAINT "floorplan_vision_house_type_id_house_types_id_fk" FOREIGN KEY ("house_type_id") REFERENCES "public"."house_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floorplan_vision" ADD CONSTRAINT "floorplan_vision_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homeowners" ADD CONSTRAINT "homeowners_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homeowners" ADD CONSTRAINT "homeowners_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_types" ADD CONSTRAINT "house_types_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_types" ADD CONSTRAINT "house_types_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "important_docs_agreements" ADD CONSTRAINT "important_docs_agreements_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "important_docs_agreements" ADD CONSTRAINT "important_docs_agreements_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "important_docs_agreements" ADD CONSTRAINT "important_docs_agreements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "information_requests" ADD CONSTRAINT "information_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "information_requests" ADD CONSTRAINT "information_requests_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "information_requests" ADD CONSTRAINT "information_requests_responded_by_admins_id_fk" FOREIGN KEY ("responded_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intel_extractions" ADD CONSTRAINT "intel_extractions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intel_extractions" ADD CONSTRAINT "intel_extractions_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intel_extractions" ADD CONSTRAINT "intel_extractions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_types" ADD CONSTRAINT "issue_types_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_house_id_homeowners_id_fk" FOREIGN KEY ("house_id") REFERENCES "public"."homeowners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_audit_log" ADD CONSTRAINT "notice_audit_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_comments" ADD CONSTRAINT "notice_comments_notice_id_noticeboard_posts_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."noticeboard_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_comments" ADD CONSTRAINT "notice_comments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_comments" ADD CONSTRAINT "notice_comments_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_comments" ADD CONSTRAINT "notice_comments_hidden_by_admins_id_fk" FOREIGN KEY ("hidden_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_reports" ADD CONSTRAINT "notice_reports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_reports" ADD CONSTRAINT "notice_reports_notice_id_noticeboard_posts_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."noticeboard_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_reports" ADD CONSTRAINT "notice_reports_comment_id_notice_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."notice_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_reports" ADD CONSTRAINT "notice_reports_reviewed_by_admins_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "noticeboard_posts" ADD CONSTRAINT "noticeboard_posts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "noticeboard_posts" ADD CONSTRAINT "noticeboard_posts_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "noticeboard_posts" ADD CONSTRAINT "noticeboard_posts_author_id_admins_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "noticeboard_posts" ADD CONSTRAINT "noticeboard_posts_hidden_by_admins_id_fk" FOREIGN KEY ("hidden_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pois" ADD CONSTRAINT "pois_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_cache" ADD CONSTRAINT "search_cache_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_config" ADD CONSTRAINT "theme_config_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_issue_type_id_issue_types_id_fk" FOREIGN KEY ("issue_type_id") REFERENCES "public"."issue_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_to_admins_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_jobs" ADD CONSTRAINT "training_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_jobs" ADD CONSTRAINT "training_jobs_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_room_dimensions" ADD CONSTRAINT "unit_room_dimensions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_room_dimensions" ADD CONSTRAINT "unit_room_dimensions_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_room_dimensions" ADD CONSTRAINT "unit_room_dimensions_house_type_id_house_types_id_fk" FOREIGN KEY ("house_type_id") REFERENCES "public"."house_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_room_dimensions" ADD CONSTRAINT "unit_room_dimensions_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_intelligence_profiles" ADD CONSTRAINT "unit_intelligence_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_intelligence_profiles" ADD CONSTRAINT "unit_intelligence_profiles_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_intelligence_profiles" ADD CONSTRAINT "unit_intelligence_profiles_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_developments" ADD CONSTRAINT "user_developments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_developments" ADD CONSTRAINT "user_developments_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_resources" ADD CONSTRAINT "video_resources_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_resources" ADD CONSTRAINT "video_resources_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_resources" ADD CONSTRAINT "video_resources_created_by_admins_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admins_tenant_idx" ON "admins" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "admins_email_idx" ON "admins" USING btree ("email");--> statement-breakpoint
CREATE INDEX "analytics_events_tenant_idx" ON "analytics_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "analytics_events_development_idx" ON "analytics_events" USING btree ("development_id");--> statement-breakpoint
CREATE INDEX "analytics_events_type_idx" ON "analytics_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "analytics_events_created_at_idx" ON "analytics_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_tenant_date_idx" ON "analytics_events" USING btree ("tenant_id","event_type","created_at");--> statement-breakpoint
CREATE INDEX "analytics_tenant_idx" ON "analytics_daily" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "analytics_metric_idx" ON "analytics_daily" USING btree ("metric");--> statement-breakpoint
CREATE INDEX "analytics_date_idx" ON "analytics_daily" USING btree ("date");--> statement-breakpoint
CREATE INDEX "analytics_tenant_date_idx" ON "analytics_daily" USING btree ("tenant_id","date");--> statement-breakpoint
CREATE INDEX "api_cache_expiry_idx" ON "api_cache" USING btree ("expiry");--> statement-breakpoint
CREATE INDEX "archive_folders_tenant_idx" ON "archive_folders" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "archive_folders_development_idx" ON "archive_folders" USING btree ("development_id");--> statement-breakpoint
CREATE INDEX "archive_folders_parent_idx" ON "archive_folders" USING btree ("parent_folder_id");--> statement-breakpoint
CREATE INDEX "archive_folders_discipline_idx" ON "archive_folders" USING btree ("tenant_id","development_id","discipline");--> statement-breakpoint
CREATE INDEX "audit_log_type_idx" ON "audit_log" USING btree ("type");--> statement-breakpoint
CREATE INDEX "audit_log_tenant_idx" ON "audit_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_log_ip_idx" ON "audit_log" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "contacts_tenant_idx" ON "contacts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "contacts_department_idx" ON "contacts" USING btree ("department");--> statement-breakpoint
CREATE INDEX "dev_requests_developer_idx" ON "development_requests" USING btree ("developer_id");--> statement-breakpoint
CREATE INDEX "dev_requests_tenant_idx" ON "development_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "dev_requests_status_idx" ON "development_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "developments_tenant_idx" ON "developments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "developments_code_idx" ON "developments" USING btree ("code");--> statement-breakpoint
CREATE INDEX "developments_developer_idx" ON "developments" USING btree ("developer_user_id");--> statement-breakpoint
CREATE INDEX "developments_created_by_idx" ON "developments" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "developments_archive_mode_idx" ON "developments" USING btree ("archive_mode");--> statement-breakpoint
CREATE INDEX "doc_chunks_tenant_idx" ON "doc_chunks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "doc_chunks_development_idx" ON "doc_chunks" USING btree ("development_id");--> statement-breakpoint
CREATE INDEX "doc_chunks_document_idx" ON "doc_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "doc_chunks_source_idx" ON "doc_chunks" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "doc_chunks_tenant_source_idx" ON "doc_chunks" USING btree ("tenant_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX "doc_chunks_tenant_dev_idx" ON "doc_chunks" USING btree ("tenant_id","development_id");--> statement-breakpoint
CREATE INDEX "doc_chunks_dev_house_type_idx" ON "doc_chunks" USING btree ("development_id","house_type_code");--> statement-breakpoint
CREATE INDEX "doc_processing_logs_document_idx" ON "document_processing_logs" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "doc_processing_logs_tenant_idx" ON "document_processing_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "doc_processing_logs_event_type_idx" ON "document_processing_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "doc_processing_logs_created_at_idx" ON "document_processing_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "doc_versions_document_idx" ON "document_versions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "doc_versions_tenant_idx" ON "document_versions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "documents_tenant_idx" ON "documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "documents_development_idx" ON "documents" USING btree ("development_id");--> statement-breakpoint
CREATE INDEX "documents_house_type_idx" ON "documents" USING btree ("house_type_id");--> statement-breakpoint
CREATE INDEX "documents_doc_type_idx" ON "documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "documents_dev_house_type_idx" ON "documents" USING btree ("development_id","house_type_code","document_type");--> statement-breakpoint
CREATE INDEX "documents_tenant_dev_idx" ON "documents" USING btree ("tenant_id","development_id");--> statement-breakpoint
CREATE INDEX "documents_doc_kind_idx" ON "documents" USING btree ("development_id","doc_kind");--> statement-breakpoint
CREATE INDEX "documents_discipline_idx" ON "documents" USING btree ("tenant_id","development_id","discipline");--> statement-breakpoint
CREATE INDEX "documents_archive_idx" ON "documents" USING btree ("tenant_id","development_id","discipline","created_at");--> statement-breakpoint
CREATE INDEX "documents_needs_review_idx" ON "documents" USING btree ("needs_review");--> statement-breakpoint
CREATE INDEX "documents_auto_mapped_confidence_idx" ON "documents" USING btree ("auto_mapped","mapping_confidence");--> statement-breakpoint
CREATE INDEX "documents_upload_status_idx" ON "documents" USING btree ("upload_status");--> statement-breakpoint
CREATE INDEX "documents_development_status_idx" ON "documents" USING btree ("development_id","upload_status");--> statement-breakpoint
CREATE INDEX "embedding_cache_created_idx" ON "embedding_cache" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "error_logs_tenant_idx" ON "error_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "error_logs_development_idx" ON "error_logs" USING btree ("development_id");--> statement-breakpoint
CREATE INDEX "error_logs_error_type_idx" ON "error_logs" USING btree ("error_type");--> statement-breakpoint
CREATE INDEX "error_logs_severity_idx" ON "error_logs" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "error_logs_created_at_idx" ON "error_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "error_logs_unresolved_idx" ON "error_logs" USING btree ("resolved","created_at");--> statement-breakpoint
CREATE INDEX "faq_entries_tenant_idx" ON "faq_entries" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "faq_entries_development_idx" ON "faq_entries" USING btree ("development_id");--> statement-breakpoint
CREATE INDEX "faq_entries_status_idx" ON "faq_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "faq_entries_topic_idx" ON "faq_entries" USING btree ("topic");--> statement-breakpoint
CREATE INDEX "faq_entries_tenant_dev_status_idx" ON "faq_entries" USING btree ("tenant_id","development_id","status");--> statement-breakpoint
CREATE INDEX "faqs_tenant_idx" ON "faqs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "faqs_category_idx" ON "faqs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "faqs_active_idx" ON "faqs" USING btree ("active");--> statement-breakpoint
CREATE INDEX "feature_flags_tenant_idx" ON "feature_flags" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "feature_flags_flag_idx" ON "feature_flags" USING btree ("flag_key");--> statement-breakpoint
CREATE INDEX "unique_tenant_flag_idx" ON "feature_flags" USING btree ("tenant_id","flag_key");--> statement-breakpoint
CREATE INDEX "feedback_tenant_idx" ON "feedback" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "feedback_ticket_idx" ON "feedback" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "feedback_rating_idx" ON "feedback" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "floorplan_vision_tenant_dev_idx" ON "floorplan_vision" USING btree ("tenant_id","development_id");--> statement-breakpoint
CREATE INDEX "floorplan_vision_house_type_idx" ON "floorplan_vision" USING btree ("house_type_id");--> statement-breakpoint
CREATE INDEX "floorplan_vision_document_idx" ON "floorplan_vision" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "homeowners_tenant_idx" ON "homeowners" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "homeowners_development_idx" ON "homeowners" USING btree ("development_id");--> statement-breakpoint
CREATE INDEX "homeowners_email_idx" ON "homeowners" USING btree ("email");--> statement-breakpoint
CREATE INDEX "homeowners_qr_token_idx" ON "homeowners" USING btree ("unique_qr_token");--> statement-breakpoint
CREATE INDEX "homeowners_tenant_dev_idx" ON "homeowners" USING btree ("tenant_id","development_id");--> statement-breakpoint
CREATE INDEX "homeowners_last_active_idx" ON "homeowners" USING btree ("last_active");--> statement-breakpoint
CREATE INDEX "house_types_tenant_idx" ON "house_types" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "house_types_development_idx" ON "house_types" USING btree ("development_id");--> statement-breakpoint
CREATE INDEX "house_types_tenant_dev_idx" ON "house_types" USING btree ("tenant_id","development_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_dev_house_type_idx" ON "house_types" USING btree ("development_id","house_type_code");--> statement-breakpoint
CREATE INDEX "important_docs_agreements_unit_idx" ON "important_docs_agreements" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "important_docs_agreements_development_idx" ON "important_docs_agreements" USING btree ("development_id");--> statement-breakpoint
CREATE INDEX "important_docs_agreements_tenant_idx" ON "important_docs_agreements" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "important_docs_agreements_agreed_at_idx" ON "important_docs_agreements" USING btree ("agreed_at");--> statement-breakpoint
CREATE INDEX "important_docs_agreements_unit_version_idx" ON "important_docs_agreements" USING btree ("unit_id","important_docs_version");--> statement-breakpoint
CREATE INDEX "info_requests_tenant_idx" ON "information_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "info_requests_development_idx" ON "information_requests" USING btree ("development_id");--> statement-breakpoint
CREATE INDEX "info_requests_status_idx" ON "information_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "info_requests_tenant_dev_status_idx" ON "information_requests" USING btree ("tenant_id","development_id","status");--> statement-breakpoint
CREATE INDEX "info_requests_created_at_idx" ON "information_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "intel_extractions_tenant_idx" ON "intel_extractions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "intel_extractions_development_idx" ON "intel_extractions" USING btree ("development_id");--> statement-breakpoint
CREATE INDEX "intel_extractions_document_idx" ON "intel_extractions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "intel_extractions_method_idx" ON "intel_extractions" USING btree ("extraction_method");--> statement-breakpoint
CREATE INDEX "intel_extractions_status_idx" ON "intel_extractions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "issue_types_tenant_idx" ON "issue_types" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "issue_types_code_idx" ON "issue_types" USING btree ("code");--> statement-breakpoint
CREATE INDEX "issue_types_category_idx" ON "issue_types" USING btree ("category");--> statement-breakpoint
CREATE INDEX "messages_tenant_idx" ON "messages" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "messages_development_idx" ON "messages" USING btree ("development_id");--> statement-breakpoint
CREATE INDEX "messages_house_idx" ON "messages" USING btree ("house_id");--> statement-breakpoint
CREATE INDEX "messages_house_created_idx" ON "messages" USING btree ("house_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_user_idx" ON "messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "messages_source_idx" ON "messages" USING btree ("source");--> statement-breakpoint
CREATE INDEX "messages_tenant_dev_idx" ON "messages" USING btree ("tenant_id","development_id");--> statement-breakpoint
CREATE INDEX "messages_question_topic_idx" ON "messages" USING btree ("question_topic");--> statement-breakpoint
CREATE INDEX "notice_audit_tenant_idx" ON "notice_audit_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "notice_audit_notice_idx" ON "notice_audit_log" USING btree ("notice_id");--> statement-breakpoint
CREATE INDEX "notice_audit_comment_idx" ON "notice_audit_log" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "notice_audit_action_idx" ON "notice_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "notice_audit_created_idx" ON "notice_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notice_comments_notice_idx" ON "notice_comments" USING btree ("notice_id");--> statement-breakpoint
CREATE INDEX "notice_comments_notice_created_idx" ON "notice_comments" USING btree ("notice_id","created_at");--> statement-breakpoint
CREATE INDEX "notice_comments_tenant_idx" ON "notice_comments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "notice_comments_development_idx" ON "notice_comments" USING btree ("development_id");--> statement-breakpoint
CREATE INDEX "notice_comments_unit_idx" ON "notice_comments" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "notice_comments_hidden_idx" ON "notice_comments" USING btree ("hidden_at");--> statement-breakpoint
CREATE INDEX "notice_reports_tenant_idx" ON "notice_reports" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "notice_reports_notice_idx" ON "notice_reports" USING btree ("notice_id");--> statement-breakpoint
CREATE INDEX "notice_reports_comment_idx" ON "notice_reports" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "notice_reports_status_idx" ON "notice_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "noticeboard_tenant_idx" ON "noticeboard_posts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "noticeboard_active_idx" ON "noticeboard_posts" USING btree ("active");--> statement-breakpoint
CREATE INDEX "noticeboard_dates_idx" ON "noticeboard_posts" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "noticeboard_unit_idx" ON "noticeboard_posts" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "noticeboard_hidden_idx" ON "noticeboard_posts" USING btree ("hidden_at");--> statement-breakpoint
CREATE INDEX "pois_tenant_idx" ON "pois" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "pois_category_idx" ON "pois" USING btree ("category");--> statement-breakpoint
CREATE INDEX "purchaser_agreements_unit_idx" ON "purchaser_agreements" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "purchaser_agreements_development_idx" ON "purchaser_agreements" USING btree ("development_id");--> statement-breakpoint
CREATE INDEX "purchaser_agreements_agreed_at_idx" ON "purchaser_agreements" USING btree ("agreed_at");--> statement-breakpoint
CREATE INDEX "qr_tokens_token_hash_idx" ON "qr_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "qr_tokens_unit_idx" ON "qr_tokens" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "qr_tokens_tenant_idx" ON "qr_tokens" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "qr_tokens_development_idx" ON "qr_tokens" USING btree ("development_id");--> statement-breakpoint
CREATE INDEX "qr_tokens_tenant_dev_idx" ON "qr_tokens" USING btree ("tenant_id","development_id");--> statement-breakpoint
CREATE INDEX "rag_chunks_tenant_idx" ON "rag_chunks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "rag_chunks_development_idx" ON "rag_chunks" USING btree ("development_id");--> statement-breakpoint
CREATE INDEX "rag_chunks_document_idx" ON "rag_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "rag_chunks_dev_house_type_idx" ON "rag_chunks" USING btree ("development_id","house_type_code");--> statement-breakpoint
CREATE INDEX "rag_chunks_tenant_dev_idx" ON "rag_chunks" USING btree ("tenant_id","development_id");--> statement-breakpoint
CREATE INDEX "rate_limits_reset_time_idx" ON "rate_limits" USING btree ("reset_time");--> statement-breakpoint
CREATE INDEX "search_cache_user_idx" ON "search_cache" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "search_cache_tenant_idx" ON "search_cache" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "search_cache_query_idx" ON "search_cache" USING btree ("tenant_id","query");--> statement-breakpoint
CREATE INDEX "search_cache_expires_idx" ON "search_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "slug_idx" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "theme_config_tenant_idx" ON "theme_config" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tickets_tenant_idx" ON "tickets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tickets_status_idx" ON "tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tickets_unit_idx" ON "tickets" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "tickets_assigned_idx" ON "tickets" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "training_jobs_tenant_idx" ON "training_jobs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "training_jobs_development_idx" ON "training_jobs" USING btree ("development_id");--> statement-breakpoint
CREATE INDEX "training_jobs_status_idx" ON "training_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "training_jobs_tenant_status_idx" ON "training_jobs" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "training_jobs_tenant_dev_idx" ON "training_jobs" USING btree ("tenant_id","development_id");--> statement-breakpoint
CREATE INDEX "idx_urd_tenant_dev_house" ON "unit_room_dimensions" USING btree ("tenant_id","development_id","house_type_id");--> statement-breakpoint
CREATE INDEX "idx_urd_room_key" ON "unit_room_dimensions" USING btree ("room_key");--> statement-breakpoint
CREATE INDEX "idx_urd_unit" ON "unit_room_dimensions" USING btree ("unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_urd_house_room_floor_source" ON "unit_room_dimensions" USING btree ("house_type_id","unit_id","room_key","floor","source");--> statement-breakpoint
CREATE INDEX "intel_profiles_tenant_idx" ON "unit_intelligence_profiles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "intel_profiles_development_idx" ON "unit_intelligence_profiles" USING btree ("development_id");--> statement-breakpoint
CREATE INDEX "intel_profiles_tenant_dev_idx" ON "unit_intelligence_profiles" USING btree ("tenant_id","development_id");--> statement-breakpoint
CREATE INDEX "intel_profiles_house_type_idx" ON "unit_intelligence_profiles" USING btree ("house_type_code");--> statement-breakpoint
CREATE INDEX "intel_profiles_scope_idx" ON "unit_intelligence_profiles" USING btree ("profile_scope");--> statement-breakpoint
CREATE INDEX "intel_profiles_current_idx" ON "unit_intelligence_profiles" USING btree ("is_current");--> statement-breakpoint
CREATE INDEX "intel_profiles_unit_idx" ON "unit_intelligence_profiles" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "units_tenant_idx" ON "units" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "units_development_idx" ON "units" USING btree ("development_id");--> statement-breakpoint
CREATE INDEX "units_dev_code_unit_idx" ON "units" USING btree ("development_code","unit_number");--> statement-breakpoint
CREATE INDEX "units_dev_code_house_type_idx" ON "units" USING btree ("development_code","house_type_code");--> statement-breakpoint
CREATE INDEX "units_tenant_dev_idx" ON "units" USING btree ("tenant_id","development_id");--> statement-breakpoint
CREATE INDEX "units_unit_uid_idx" ON "units" USING btree ("unit_uid");--> statement-breakpoint
CREATE INDEX "user_developments_development_idx" ON "user_developments" USING btree ("development_id","user_id");--> statement-breakpoint
CREATE INDEX "user_developments_user_idx" ON "user_developments" USING btree ("user_id","development_id");--> statement-breakpoint
CREATE INDEX "users_tenant_idx" ON "users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "video_resources_tenant_idx" ON "video_resources" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "video_resources_development_idx" ON "video_resources" USING btree ("development_id");--> statement-breakpoint
CREATE INDEX "video_resources_tenant_dev_idx" ON "video_resources" USING btree ("tenant_id","development_id");--> statement-breakpoint
CREATE INDEX "video_resources_provider_idx" ON "video_resources" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "video_resources_active_idx" ON "video_resources" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "video_resources_sort_idx" ON "video_resources" USING btree ("development_id","sort_order");