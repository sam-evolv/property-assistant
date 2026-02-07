import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { units, developments, btrTenancies, maintenanceRequests, complianceSchedule } from '@openhouse/db/schema';
import { eq, and, sql, count } from 'drizzle-orm';
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

    const allUnits = await db
      .select()
      .from(units)
      .where(eq(units.development_id, developmentId));

    const tenancies = await db
      .select()
      .from(btrTenancies)
      .where(and(eq(btrTenancies.development_id, developmentId), eq(btrTenancies.status, 'active')));

    const maintenance = await db
      .select()
      .from(maintenanceRequests)
      .where(eq(maintenanceRequests.development_id, developmentId));

    const compliance = await db
      .select()
      .from(complianceSchedule)
      .where(eq(complianceSchedule.development_id, developmentId));

    const occupiedCount = allUnits.filter(u => u.unit_status === 'occupied').length;
    const vacantCount = allUnits.filter(u => u.unit_status === 'vacant' || u.unit_status === 'available').length;
    const voidCount = allUnits.filter(u => u.unit_status === 'void').length;
    const maintCount = allUnits.filter(u => u.unit_status === 'maintenance').length;
    const openMaint = maintenance.filter(m => !['resolved', 'closed', 'cancelled'].includes(m.status));
    const overdueComp = compliance.filter(c => c.status === 'overdue');
    const dueSoonComp = compliance.filter(c => c.status === 'due_soon');

    const monthlyRentRoll = tenancies.reduce((sum, t) => sum + Number(t.monthly_rent || 0), 0);

    const stats = {
      totalUnits: allUnits.length,
      occupiedUnits: occupiedCount,
      vacantUnits: vacantCount,
      voidUnits: voidCount,
      maintenanceUnits: maintCount,
      occupancyRate: allUnits.length > 0 ? Math.round((occupiedCount / allUnits.length) * 100) : 0,
      openMaintenanceRequests: openMaint.length,
      overdueCompliance: overdueComp.length,
      upcomingCompliance: dueSoonComp.length,
      monthlyRentRoll,
      activeTenancies: tenancies.length,
      averageResolutionDays: 0,
    };

    return NextResponse.json({
      development: dev,
      stats,
      units: allUnits,
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
