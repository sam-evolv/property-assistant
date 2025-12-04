import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';

async function verifyDatabase() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL or POSTGRES_URL not found');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('✅ Database connected successfully');

    const result = await client.query('SELECT COUNT(*) as count FROM tenants');
    console.log('📊 Tenants count:', result.rows[0].count);

    const tables = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    
    console.log(`\n📋 Tables in database: ${tables.rows.length}`);
    tables.rows.forEach(row => console.log('  ✓', row.tablename));

    console.log('\n✅ Database verification complete');
  } catch (error) {
    console.error('❌ Database error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyDatabase();
