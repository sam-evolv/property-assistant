import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { developments, btrTenancies, maintenanceRequests, complianceSchedule } from '@openhouse/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { requireRole } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['super_admin', 'admin', 'developer']);
    const developmentId = params.id;

    const [dev] = await db
      .select({ id: developments.id, name: developments.name, project_type: developments.project_type })
      .from(developments)
      .where(eq(developments.id, developmentId))
      .limit(1);

    if (!dev) {
      return NextResponse.json({ error: 'Development not found' }, { status: 404 });
    }

    const unitRows = await db.execute(sql`
      SELECT id, unit_number, unit_code, unit_uid, address, address_line_1,
             bedrooms, bathrooms, unit_status, unit_mode, monthly_rent,
             current_tenancy_id, development_id
      FROM units
      WHERE development_id = ${developmentId}
      ORDER BY unit_number ASC
    `);
    const allUnits = (unitRows as any).rows || unitRows;

    const tenancies = await db
      .select()
      .from(btrTenancies)
      .where(and(eq(btrTenancies.development_id, developmentId), eq(btrTenancies.status, 'active')));

    const maintRows = await db.execute(sql`
      SELECT m.*, u.address as unit_address, t.tenant_name as tenant_name_joined
      FROM maintenance_requests m
      LEFT JOIN units u ON m.unit_id = u.id
      LEFT JOIN btr_tenancies t ON m.unit_id = t.unit_id AND t.status = 'active'
      WHERE m.development_id = ${developmentId}
      ORDER BY m.created_at DESC
    `);
    const maintenance = ((maintRows as any).rows || maintRows).map((m: any) => ({
      ...m,
      unit: { address: m.unit_address },
      tenancy: { tenant_name: m.tenant_name_joined },
    }));

    const compliance = await db
      .select()
      .from(complianceSchedule)
      .where(eq(complianceSchedule.development_id, developmentId));

    const totalUnits = allUnits.length;
    const occupiedCount = tenancies.length;
    const voidCount = allUnits.filter((u: any) => u.unit_status === 'void').length;
    const vacantCount = allUnits.filter((u: any) => u.unit_status === 'vacant' || u.unit_status === 'available').length;
    const maintCount = allUnits.filter((u: any) => u.unit_status === 'maintenance').length;
    const openMaint = maintenance.filter((m: any) => !['resolved', 'closed', 'cancelled'].includes(m.status));
    const overdueComp = compliance.filter(c => c.status === 'overdue');
    const dueSoonComp = compliance.filter(c => c.status === 'due_soon');

    const monthlyRentRoll = tenancies.reduce((sum, t) => sum + Number(t.monthly_rent || 0), 0);

    const stats = {
      totalUnits,
      occupiedUnits: occupiedCount,
      vacantUnits: vacantCount,
      voidUnits: voidCount,
      maintenanceUnits: maintCount,
      occupancyRate: totalUnits > 0 ? Math.round((occupiedCount / totalUnits) * 100) : 0,
      openMaintenanceRequests: openMaint.length,
      overdueCompliance: overdueComp.length,
      upcomingCompliance: dueSoonComp.length,
      monthlyRentRoll,
      activeTenancies: tenancies.length,
      averageResolutionDays: 0,
    };

    const unitsWithAddress = allUnits.map((u: any) => ({
      ...u,
      address: u.address || u.address_line_1 || null,
    }));

    return NextResponse.json({
      development: dev,
      stats,
      units: unitsWithAddress,
      tenancies,
      recentMaintenance: maintenance.slice(0, 5),
      complianceAlerts: [...overdueComp, ...dueSoonComp].slice(0, 5),
    });
  } catch (error: any) {
    if (error?.message?.includes('UNAUTHORIZED') || error?.message?.includes('FORBIDDEN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[BTR API] Error:', error);
    return NextResponse.json({ error: 'Failed to load BTR data' }, { status: 500 });
  }
}
