-- Production Optimization for OpenHouse AI
-- Phase 15: Performance indexes and constraints

-- ================================================================
-- INDEXES FOR PERFORMANCE
-- ================================================================

-- Tenants table optimization
CREATE INDEX IF NOT EXISTS tenants_slug_idx ON tenants(slug);
CREATE INDEX IF NOT EXISTS tenants_created_idx ON tenants(created_at DESC);

-- Documents table optimization  
CREATE INDEX IF NOT EXISTS documents_tenant_created_idx ON documents(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS documents_status_idx ON documents(status) WHERE status = 'active';

-- Development table optimization
CREATE INDEX IF NOT EXISTS developments_tenant_idx ON developments(tenant_id);
CREATE INDEX IF NOT EXISTS developments_tenant_created_idx ON developments(tenant_id, created_at DESC);

-- Messages table optimization
CREATE INDEX IF NOT EXISTS messages_tenant_created_idx ON messages(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_development_created_idx ON messages(development_id, created_at DESC);

-- Document chunks optimization for vector search
CREATE INDEX IF NOT EXISTS doc_chunks_tenant_idx ON doc_chunks(tenant_id);
CREATE INDEX IF NOT EXISTS doc_chunks_source_idx ON doc_chunks(source_type, source_id);

-- For vector similarity search (ivfflat index for better performance)
-- Note: This requires pgvector extension and must be run OUTSIDE of a transaction
-- Run this manually in Supabase SQL Editor after migration:
--   DROP INDEX IF EXISTS doc_chunks_embedding_idx;
--   CREATE INDEX doc_chunks_embedding_ivfflat_idx 
--   ON doc_chunks USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);
-- For now, create a basic index that works within transactions:
CREATE INDEX IF NOT EXISTS doc_chunks_embedding_idx ON doc_chunks USING ivfflat (embedding vector_cosine_ops);

-- Homeowners table optimization
CREATE INDEX IF NOT EXISTS homeowners_tenant_idx ON homeowners(tenant_id);
CREATE INDEX IF NOT EXISTS homeowners_development_idx ON homeowners(development_id);
CREATE INDEX IF NOT EXISTS homeowners_house_number_idx ON homeowners(house_number);

-- Tickets table optimization (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tickets') THEN
    CREATE INDEX IF NOT EXISTS tickets_tenant_idx ON tickets(tenant_id);
    CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets(status);
    CREATE INDEX IF NOT EXISTS tickets_created_idx ON tickets(created_at DESC);
  END IF;
END $$;

-- Training jobs optimization
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'training_jobs') THEN
    CREATE INDEX IF NOT EXISTS training_jobs_tenant_idx ON training_jobs(tenant_id);
    CREATE INDEX IF NOT EXISTS training_jobs_status_idx ON training_jobs(status);
  END IF;
END $$;

-- ================================================================
-- VACUUM AND ANALYZE
-- ================================================================

-- Update statistics for query planner
ANALYZE tenants;
ANALYZE documents;
ANALYZE developments;
ANALYZE messages;
ANALYZE doc_chunks;
ANALYZE homeowners;

-- ================================================================
-- CONSTRAINTS AND VALIDATION
-- ================================================================

-- Add check constraints where missing
ALTER TABLE messages 
ADD CONSTRAINT IF NOT EXISTS messages_content_not_empty 
CHECK (length(content) > 0);

ALTER TABLE documents 
ADD CONSTRAINT IF NOT EXISTS documents_title_not_empty 
CHECK (length(title) > 0);

-- ================================================================
-- PERFORMANCE SETTINGS (for reference)
-- ================================================================

-- These should be set at database level in Supabase:
-- shared_buffers = 256MB
-- effective_cache_size = 1GB  
-- work_mem = 4MB
-- maintenance_work_mem = 64MB
-- checkpoint_completion_target = 0.9
-- wal_buffers = 16MB
-- default_statistics_target = 100
-- random_page_cost = 1.1
-- effective_io_concurrency = 200

-- ================================================================
-- MONITORING QUERIES (for documentation)
-- ================================================================

-- Check index usage:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch 
-- FROM pg_stat_user_indexes 
-- ORDER BY idx_scan DESC;

-- Check table sizes:
-- SELECT schemaname, tablename, 
--   pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check slow queries:
-- SELECT query, calls, total_exec_time, mean_exec_time, max_exec_time
-- FROM pg_stat_statements 
-- ORDER BY mean_exec_time DESC 
-- LIMIT 20;

-- ================================================================
-- COMPLETION
-- ================================================================

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Production optimizations applied successfully';
END $$;
