import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';

async function createDataAccessLogTable() {
  
  console.log('Creating data_access_log table...');
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS data_access_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID REFERENCES tenants(id),
      accessor_id UUID NOT NULL,
      accessor_email TEXT,
      accessor_role VARCHAR(50),
      action VARCHAR(100) NOT NULL,
      resource_type VARCHAR(100) NOT NULL,
      resource_id UUID,
      resource_description TEXT,
      ip_address VARCHAR(45),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )
  `);
  console.log('Table created');

  await db.execute(sql`CREATE INDEX IF NOT EXISTS data_access_log_created_idx ON data_access_log(created_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS data_access_log_accessor_idx ON data_access_log(accessor_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS data_access_log_tenant_idx ON data_access_log(tenant_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS data_access_log_action_idx ON data_access_log(action)`);
  console.log('Indexes created');
  
  console.log('Done!');
  process.exit(0);
}

createDataAccessLogTable().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
