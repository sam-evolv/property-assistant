-- Migration 014: Optimize doc_chunks for semantic search + search cache
-- Phase 3: Deep Semantic Search, Global Finder, and Cross-Discipline Retrieval

-- Add token_count and embedding_norm to doc_chunks for faster search scoring
ALTER TABLE doc_chunks ADD COLUMN IF NOT EXISTS token_count INTEGER DEFAULT 0;
ALTER TABLE doc_chunks ADD COLUMN IF NOT EXISTS embedding_norm DOUBLE PRECISION;

-- Add search_content tsvector column for full-text search hybrid scoring
ALTER TABLE doc_chunks ADD COLUMN IF NOT EXISTS search_content TSVECTOR;

-- Add tags column to documents if missing
ALTER TABLE documents ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- Create search_cache table for caching search results
CREATE TABLE IF NOT EXISTS search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  filters JSONB DEFAULT '{}'::jsonb,
  results JSONB NOT NULL,
  hit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '6 hours')
);

-- Indexes for search_cache
CREATE INDEX IF NOT EXISTS idx_search_cache_user ON search_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_search_cache_tenant ON search_cache(tenant_id);
CREATE INDEX IF NOT EXISTS idx_search_cache_query ON search_cache(tenant_id, query);
CREATE INDEX IF NOT EXISTS idx_search_cache_expires ON search_cache(expires_at);

-- Index for doc_chunks token_count (for filtering by chunk size)
CREATE INDEX IF NOT EXISTS idx_doc_chunks_token_count ON doc_chunks(token_count) WHERE token_count > 0;

-- Composite index for semantic search with filters
CREATE INDEX IF NOT EXISTS idx_doc_chunks_semantic_search ON doc_chunks(tenant_id, development_id, document_id) 
  WHERE embedding IS NOT NULL;

-- GIN index for full-text search on tsvector
CREATE INDEX IF NOT EXISTS idx_doc_chunks_search_content ON doc_chunks USING GIN(search_content);

-- Index for documents tags
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN(tags);

-- Helper function to compute embedding norm (used during chunking)
CREATE OR REPLACE FUNCTION compute_embedding_norm(emb vector(1536))
RETURNS DOUBLE PRECISION AS $$
BEGIN
  RETURN sqrt((emb <#> emb) * -1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update existing embeddings with their norms (batch update)
UPDATE doc_chunks 
SET embedding_norm = sqrt((embedding <#> embedding) * -1)
WHERE embedding IS NOT NULL AND embedding_norm IS NULL;

-- Populate search_content tsvector from existing content
UPDATE doc_chunks
SET search_content = to_tsvector('english', COALESCE(content, ''))
WHERE search_content IS NULL AND content IS NOT NULL;

-- Cleanup expired cache entries (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_search_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM search_cache WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
