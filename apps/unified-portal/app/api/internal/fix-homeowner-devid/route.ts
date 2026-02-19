import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get('secret');
  if (secret !== 'forge_fix_2026_ardan') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
  }

  const connStr = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connStr) {
    return NextResponse.json({ error: 'No DB connection string found', env_keys: Object.keys(process.env).filter(k => k.includes('DB') || k.includes('PG') || k.includes('SQL') || k.includes('DATABASE')) }, { status: 500 });
  }

  const pool = new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });

  try {
    // List all homeowners in HVA development
    const check = await pool.query(`
      SELECT h.id, h.name, h.address, h.development_id, h.unique_qr_token
      FROM homeowners h
      WHERE h.development_id = 'b45347d3-934d-4ec1-9d25-c0a687b82263'
      ORDER BY h.address
    `);

    // Fix: move Ardan View homeowners to Riverside Gardens
    const fix = await pool.query(`
      UPDATE homeowners 
      SET development_id = '84a559d1-89f1-4eb6-a48b-7ca068bcc164'
      WHERE development_id = 'b45347d3-934d-4ec1-9d25-c0a687b82263'
        AND (address ILIKE '%rdan View%' OR address ILIKE '%Ardan%')
      RETURNING id, address, development_id, unique_qr_token
    `);

    await pool.end();

    return NextResponse.json({
      conn: connStr.slice(0, 30) + '...',
      hva_total: check.rowCount,
      hva_list: check.rows.map((r: any) => ({ address: r.address, token: r.unique_qr_token })),
      fixed: fix.rowCount,
      fixed_rows: fix.rows.map((r: any) => ({ address: r.address, token: r.unique_qr_token })),
    });
  } catch (err: any) {
    await pool.end().catch(() => {});
    return NextResponse.json({ error: err.message, conn_prefix: connStr.slice(0, 20) }, { status: 500 });
  }
}
