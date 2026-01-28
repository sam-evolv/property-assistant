const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTables() {
  console.log('Creating compliance tables...');

  const { data: existing, error: checkError } = await supabase
    .from('compliance_document_types')
    .select('id')
    .limit(1);

  if (!checkError) {
    console.log('Tables already exist!');
    return;
  }

  console.log('Tables do not exist, need to create via Supabase dashboard SQL editor.');
  console.log('');
  console.log('Run this SQL in Supabase SQL Editor:');
  console.log('='.repeat(60));
  console.log(`
-- Compliance Document Types table
CREATE TABLE IF NOT EXISTS compliance_document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  development_id UUID NOT NULL REFERENCES developments(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  house_type TEXT,
  required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Compliance Documents table
CREATE TABLE IF NOT EXISTS compliance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  development_id UUID NOT NULL REFERENCES developments(id),
  unit_id UUID NOT NULL REFERENCES units(id),
  document_type_id UUID NOT NULL REFERENCES compliance_document_types(id),
  status TEXT NOT NULL DEFAULT 'missing',
  uploaded_by TEXT,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  expiry_date TIMESTAMPTZ,
  notes TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(unit_id, document_type_id)
);

-- Compliance Files table
CREATE TABLE IF NOT EXISTS compliance_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  document_id UUID NOT NULL REFERENCES compliance_documents(id),
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS compliance_doc_types_tenant_idx ON compliance_document_types(tenant_id);
CREATE INDEX IF NOT EXISTS compliance_doc_types_dev_idx ON compliance_document_types(development_id);
CREATE INDEX IF NOT EXISTS compliance_docs_tenant_idx ON compliance_documents(tenant_id);
CREATE INDEX IF NOT EXISTS compliance_docs_dev_idx ON compliance_documents(development_id);
CREATE INDEX IF NOT EXISTS compliance_docs_unit_idx ON compliance_documents(unit_id);
CREATE INDEX IF NOT EXISTS compliance_docs_type_idx ON compliance_documents(document_type_id);
CREATE INDEX IF NOT EXISTS compliance_files_doc_idx ON compliance_files(document_id);

-- RLS Policies
ALTER TABLE compliance_document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant compliance doc types"
  ON compliance_document_types FOR SELECT
  USING (true);

CREATE POLICY "Users can view their tenant compliance docs"
  ON compliance_documents FOR SELECT
  USING (true);

CREATE POLICY "Users can view their tenant compliance files"
  ON compliance_files FOR SELECT
  USING (true);
  `);
  console.log('='.repeat(60));
}

createTables().catch(console.error);
