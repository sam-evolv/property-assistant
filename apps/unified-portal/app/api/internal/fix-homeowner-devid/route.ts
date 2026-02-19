import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get('secret');
  if (secret !== 'forge_fix_2026_ardan') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
  }
  try {
    const check = await db.execute(sql`
      SELECT h.id, h.name, h.address, h.development_id, h.unique_qr_token
      FROM homeowners h
      WHERE h.development_id = 'b45347d3-934d-4ec1-9d25-c0a687b82263'
      ORDER BY h.address
    `);
    const fix = await db.execute(sql`
      UPDATE homeowners 
      SET development_id = '84a559d1-89f1-4eb6-a48b-7ca068bcc164'
      WHERE development_id = 'b45347d3-934d-4ec1-9d25-c0a687b82263'
        AND (address ILIKE '%rdan View%' OR address ILIKE '%Ardan%')
      RETURNING id, address, development_id, unique_qr_token
    `);
    return NextResponse.json({
      hva_list: (check.rows as any[]).map((r: any) => ({ address: r.address, token: r.unique_qr_token })),
      fixed: fix.rowCount,
      fixed_rows: (fix.rows as any[]).map((r: any) => ({ address: r.address, token: r.unique_qr_token })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
