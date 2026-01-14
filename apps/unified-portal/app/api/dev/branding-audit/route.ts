import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';
import { BUILD_INFO, getBuildInfoString } from '@/lib/build-info';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Dev only endpoint' }, { status: 403 });
  }

  try {
    const developments = await db.execute(sql`
      SELECT 
        id, name, code, logo_url,
        (SELECT COUNT(*) FROM units WHERE development_id = developments.id) as unit_count
      FROM developments
      ORDER BY name
    `);

    const unitStats = await db.execute(sql`
      SELECT 
        d.name as development_name,
        d.logo_url,
        COUNT(*) as count,
        CASE 
          WHEN d.name IS NULL THEN 'MISSING_DEV'
          WHEN d.logo_url IS NULL THEN 'MISSING_LOGO'
          ELSE 'OK'
        END as status
      FROM units u
      LEFT JOIN developments d ON u.development_id = d.id
      GROUP BY d.name, d.logo_url
      ORDER BY d.name NULLS LAST
    `);

    const brokenUnits = (unitStats.rows as any[]).filter(s => s.status !== 'OK');
    const totalBroken = brokenUnits.reduce((sum, s) => sum + parseInt(s.count), 0);

    return NextResponse.json({
      build: BUILD_INFO,
      buildInfo: getBuildInfoString(),
      timestamp: new Date().toISOString(),
      developments: developments.rows,
      unitStats: unitStats.rows,
      summary: {
        totalDevelopments: developments.rows.length,
        brokenUnits: totalBroken,
        pass: totalBroken === 0,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
