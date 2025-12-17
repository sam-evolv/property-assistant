import { NextRequest, NextResponse } from 'next/server';
import { generateQRTokenForUnit } from '@openhouse/api/qr-tokens';
import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const LONGVIEW_DEVELOPMENT_ID = '34316432-f1e8-4297-b993-d9b5c88ee2d8';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const unitUid = searchParams.get('unitUid');

    if (!unitUid) {
      return NextResponse.json({ error: 'Missing unitUid' }, { status: 400 });
    }

    console.log('[Super Admin Impersonation] Looking up unit:', unitUid);

    let unit: any = null;

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(unitUid);
    
    if (isUUID) {
      const { rows } = await db.execute(sql`
        SELECT u.id, u.unit_uid, u.development_id, u.address_line_1 as address, u.purchaser_name,
               d.tenant_id, d.name as development_name
        FROM units u
        LEFT JOIN developments d ON u.development_id = d.id
        WHERE u.id = ${unitUid}::uuid
        LIMIT 1
      `);
      unit = rows[0];
    }

    if (!unit) {
      const numMatch = unitUid.match(/(\d+)/);
      const unitNum = numMatch ? parseInt(numMatch[1], 10) : 1;

      const { rows: units } = await db.execute(sql`
        SELECT u.id, u.unit_uid, u.development_id, u.address_line_1 as address, u.purchaser_name,
               d.tenant_id, d.name as development_name
        FROM units u
        LEFT JOIN developments d ON u.development_id = d.id
        WHERE u.development_id = ${LONGVIEW_DEVELOPMENT_ID}::uuid
        LIMIT 200
      `);

      if (!units || units.length === 0) {
        console.error('[Super Admin Impersonation] No units found in Drizzle');
        return NextResponse.json({ error: 'No units found for development' }, { status: 404 });
      }

      const exactMatch = units.find((u: any) => {
        const addrMatch = u.address?.match(/^(\d+)\s/);
        return addrMatch && parseInt(addrMatch[1], 10) === unitNum;
      });
      
      unit = exactMatch || units[0];
    }

    if (!unit) {
      console.error('[Super Admin Impersonation] Unit not found');
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const tenantId = unit.tenant_id;
    const developmentId = unit.development_id;
    
    if (!tenantId || !developmentId) {
      console.error('[Super Admin Impersonation] Missing tenant_id or development_id:', { tenantId, developmentId });
      return NextResponse.json({ 
        error: 'Development not found. Unit may not be properly configured.' 
      }, { status: 404 });
    }
    console.log('[Super Admin Impersonation] Resolved development:', developmentId, 'tenant:', tenantId);
    
    const tokenResult = await generateQRTokenForUnit(
      unit.id,
      developmentId,
      tenantId,
      developmentId
    );

    console.log(`[Super Admin Impersonation] Found unit:`, unit.id, unit.address);
    console.log(`[Super Admin Impersonation] Token stored in database`);
    console.log(`[Super Admin Impersonation] URL:`, tokenResult.url);
    
    return NextResponse.json({ 
      url: tokenResult.url,
      unitId: unit.id,
      address: unit.address,
      purchaserName: unit.purchaser_name,
    });
  } catch (error) {
    console.error('[Impersonation API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
