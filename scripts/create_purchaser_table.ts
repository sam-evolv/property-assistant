import { db } from '../packages/db/client';
import { sql } from 'drizzle-orm';

async function createTable() {
  try {
    const checkResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'purchaser_agreements'
      )
    `);
    
    const exists = (checkResult.rows[0] as any)?.exists;
    console.log('Table exists:', exists);
    
    if (!exists) {
      console.log('Creating purchaser_agreements table...');
      await db.execute(sql`
        CREATE TABLE purchaser_agreements (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          unit_id VARCHAR(255) NOT NULL,
          development_id UUID,
          purchaser_name TEXT,
          purchaser_email TEXT,
          agreed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
          ip_address VARCHAR(45),
          user_agent TEXT,
          important_docs_acknowledged JSONB,
          docs_version INTEGER DEFAULT 1,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        )
      `);
      console.log('Table created successfully!');
    }
  } catch (e) {
    console.error('Error:', e);
  }
  process.exit(0);
}
createTable();
