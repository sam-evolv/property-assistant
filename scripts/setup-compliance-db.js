const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({ connectionString });

const sql = `
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
`;

async function run() {
  const client = await pool.connect();
  try {
    console.log('Creating compliance tables...');
    await client.query(sql);
    console.log('Tables created successfully!');
  } catch (err) {
    console.error('Error creating tables:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
