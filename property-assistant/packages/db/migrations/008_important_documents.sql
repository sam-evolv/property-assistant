-- Migration: Important Documents System
-- Adds support for marking documents as important and tracking purchaser agreements

-- 1. Add important document fields to documents table
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "is_important" boolean NOT NULL DEFAULT false;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "important_rank" integer;

-- Add index for important documents queries
CREATE INDEX IF NOT EXISTS "documents_important_idx" ON "documents" ("is_important") WHERE "is_important" = true;
CREATE INDEX IF NOT EXISTS "documents_dev_important_idx" ON "documents" ("development_id", "is_important", "important_rank") WHERE "is_important" = true;

-- 2. Add is_important flag to doc_chunks table for RAG weighting
ALTER TABLE "doc_chunks" ADD COLUMN IF NOT EXISTS "is_important" boolean NOT NULL DEFAULT false;

-- Add index for RAG retrieval queries
CREATE INDEX IF NOT EXISTS "doc_chunks_important_idx" ON "doc_chunks" ("is_important") WHERE "is_important" = true;
CREATE INDEX IF NOT EXISTS "doc_chunks_dev_important_idx" ON "doc_chunks" ("development_id", "is_important");

-- 3. Add versioning to developments table
ALTER TABLE "developments" ADD COLUMN IF NOT EXISTS "important_docs_version" integer NOT NULL DEFAULT 1;

-- Add index for version checks
CREATE INDEX IF NOT EXISTS "developments_version_idx" ON "developments" ("important_docs_version");

-- 4. Add agreement tracking to units table
ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "important_docs_agreed_version" integer NOT NULL DEFAULT 0;
ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "important_docs_agreed_at" timestamptz;

-- Add indexes for agreement status queries
CREATE INDEX IF NOT EXISTS "units_agreed_version_idx" ON "units" ("important_docs_agreed_version");
CREATE INDEX IF NOT EXISTS "units_agreed_at_idx" ON "units" ("important_docs_agreed_at");
CREATE INDEX IF NOT EXISTS "units_agreement_status_idx" ON "units" ("development_id", "important_docs_agreed_version");

-- 5. Create audit table for important docs agreements
CREATE TABLE IF NOT EXISTS "important_docs_agreements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "unit_id" uuid NOT NULL REFERENCES "units"("id") ON DELETE CASCADE,
  "purchaser_id" uuid,
  "development_id" uuid NOT NULL REFERENCES "developments"("id") ON DELETE CASCADE,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "important_docs_version" integer NOT NULL,
  "agreed_at" timestamptz NOT NULL DEFAULT now(),
  "ip_address" text,
  "user_agent" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for audit table queries
CREATE INDEX IF NOT EXISTS "important_docs_agreements_unit_idx" ON "important_docs_agreements" ("unit_id");
CREATE INDEX IF NOT EXISTS "important_docs_agreements_development_idx" ON "important_docs_agreements" ("development_id");
CREATE INDEX IF NOT EXISTS "important_docs_agreements_tenant_idx" ON "important_docs_agreements" ("tenant_id");
CREATE INDEX IF NOT EXISTS "important_docs_agreements_agreed_at_idx" ON "important_docs_agreements" ("agreed_at" DESC);
CREATE INDEX IF NOT EXISTS "important_docs_agreements_unit_version_idx" ON "important_docs_agreements" ("unit_id", "important_docs_version");

-- Add comment for documentation
COMMENT ON TABLE "important_docs_agreements" IS 'Audit trail for purchaser agreements to read important documents';
COMMENT ON COLUMN "documents"."is_important" IS 'Marks a document as important/must-read for purchasers';
COMMENT ON COLUMN "documents"."important_rank" IS 'Ordering of important documents (lower = higher priority)';
COMMENT ON COLUMN "doc_chunks"."is_important" IS 'Inherited from parent document for RAG weighting';
COMMENT ON COLUMN "developments"."important_docs_version" IS 'Incremented when important docs list changes, triggers re-consent';
COMMENT ON COLUMN "units"."important_docs_agreed_version" IS 'Version of important docs the purchaser has agreed to';
COMMENT ON COLUMN "units"."important_docs_agreed_at" IS 'Timestamp of most recent agreement';
