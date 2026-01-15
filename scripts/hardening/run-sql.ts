#!/usr/bin/env npx tsx
import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
const sql = process.argv[2];

if (!DATABASE_URL || !sql) {
  console.error('Usage: npx tsx run-sql.ts "SQL QUERY"');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  
  try {
    const result = await client.query(sql);
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (e: any) {
    console.error('Error:', e.message);
  } finally {
    await client.end();
  }
}

main();
