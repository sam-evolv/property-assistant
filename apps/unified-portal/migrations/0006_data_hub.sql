-- Data Hub: Cloud Storage Integration
-- Storage connections, watched folders, and indexed file metadata

-- Storage connections (Google Drive / OneDrive / SharePoint)
CREATE TABLE storage_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES developer_tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google_drive', 'onedrive', 'sharepoint')),
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'syncing', 'error', 'disconnected')),
  credentials JSONB NOT NULL DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Watched folders (which folders to index within a connected storage)
CREATE TABLE watched_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES storage_connections(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES developer_tenants(id) ON DELETE CASCADE,
  folder_id TEXT NOT NULL,
  folder_path TEXT NOT NULL,
  folder_name TEXT NOT NULL,
  development_id UUID REFERENCES developments(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexed files from connected storage (metadata only — no file content stored)
CREATE TABLE storage_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES storage_connections(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES developer_tenants(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES watched_folders(id) ON DELETE SET NULL,
  development_id UUID REFERENCES developments(id) ON DELETE SET NULL,
  provider_file_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,
  web_url TEXT,
  category TEXT,
  category_confidence FLOAT,
  provider_modified_at TIMESTAMPTZ,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connection_id, provider_file_id)
);

-- Enable RLS
ALTER TABLE storage_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE watched_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_files ENABLE ROW LEVEL SECURITY;

-- RLS policies (tenant isolation)
CREATE POLICY "tenant_isolation" ON storage_connections
  USING (tenant_id = (SELECT tenant_id FROM developer_users WHERE id = auth.uid()));

CREATE POLICY "tenant_isolation" ON watched_folders
  USING (tenant_id = (SELECT tenant_id FROM developer_users WHERE id = auth.uid()));

CREATE POLICY "tenant_isolation" ON storage_files
  USING (tenant_id = (SELECT tenant_id FROM developer_users WHERE id = auth.uid()));

-- Indexes
CREATE INDEX idx_storage_files_connection ON storage_files(connection_id);
CREATE INDEX idx_storage_files_category ON storage_files(tenant_id, category);
CREATE INDEX idx_watched_folders_connection ON watched_folders(connection_id);
