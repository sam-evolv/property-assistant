import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { unitSalesPipeline, units, developments } from '@openhouse/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function computeTrafficLight(
  stageDate: Date | null,
  referenceDate: Date | null,
  amberDays: number,
  redDays: number,
  mode: 'elapsed' | 'countdown' = 'elapsed'
): 'green' | 'amber' | 'red' | null {
  if (stageDate) return 'green';
  if (!referenceDate) return null;

  const now = new Date();
  const ref = new Date(referenceDate);
  
  if (mode === 'elapsed') {
    const daysSince = Math.floor((now.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince >= redDays) return 'red';
    if (daysSince >= amberDays) return 'amber';
    return null;
  } else {
    const daysUntil = Math.floor((ref.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= redDays) return 'red';
    if (daysUntil <= amberDays) return 'amber';
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['developer', 'super_admin']);
    const developmentId = params.id;
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const [development] = await db
      .select()
      .from(developments)
      .where(and(eq(developments.id, developmentId), eq(developments.tenant_id, tenantId)))
      .limit(1);

    if (!development) {
      return NextResponse.json({ error: 'Development not found' }, { status: 404 });
    }

    const thresholds = {
      contracts_amber: 28,
      contracts_red: 42,
      kitchen_amber: 14,
      kitchen_red: 28,
      snag_amber: 14,
      snag_red: 30,
    };

    const pipelineData = await db
      .select({
        id: unitSalesPipeline.id,
        unit_id: unitSalesPipeline.unit_id,
        purchaser_name: unitSalesPipeline.purchaser_name,
        purchaser_email: unitSalesPipeline.purchaser_email,
        purchaser_phone: unitSalesPipeline.purchaser_phone,
        release_date: unitSalesPipeline.release_date,
        sale_agreed_date: unitSalesPipeline.sale_agreed_date,
        deposit_date: unitSalesPipeline.deposit_date,
        contracts_issued_date: unitSalesPipeline.contracts_issued_date,
        signed_contracts_date: unitSalesPipeline.signed_contracts_date,
        counter_signed_date: unitSalesPipeline.counter_signed_date,
        kitchen_date: unitSalesPipeline.kitchen_date,
        snag_date: unitSalesPipeline.snag_date,
        drawdown_date: unitSalesPipeline.drawdown_date,
        handover_date: unitSalesPipeline.handover_date,
        unit_name: sql<string>`COALESCE(${units.property_designation}, ${units.unit_number})`,
        unit_number: units.unit_number,
        unit_uid: units.unit_uid,
      })
      .from(unitSalesPipeline)
      .leftJoin(units, eq(unitSalesPipeline.unit_id, units.id))
      .where(eq(unitSalesPipeline.development_id, developmentId))
      .orderBy(units.unit_number);

    const rows = pipelineData.map(row => {
      const trafficLights: Record<string, 'green' | 'amber' | 'red' | null> = {};

      trafficLights.contracts = computeTrafficLight(
        row.signed_contracts_date,
        row.contracts_issued_date,
        thresholds.contracts_amber,
        thresholds.contracts_red,
        'elapsed'
      );

      trafficLights.kitchen = computeTrafficLight(
        row.kitchen_date,
        row.signed_contracts_date,
        thresholds.kitchen_amber,
        thresholds.kitchen_red,
        'elapsed'
      );

      trafficLights.snag = computeTrafficLight(
        row.snag_date,
        row.handover_date,
        thresholds.snag_amber,
        thresholds.snag_red,
        'countdown'
      );

      return {
        ...row,
        trafficLights,
      };
    });

    const stats = {
      total: rows.length,
      released: rows.filter(r => r.release_date).length,
      saleAgreed: rows.filter(r => r.sale_agreed_date).length,
      deposited: rows.filter(r => r.deposit_date).length,
      contractsIssued: rows.filter(r => r.contracts_issued_date).length,
      contractsSigned: rows.filter(r => r.signed_contracts_date).length,
      counterSigned: rows.filter(r => r.counter_signed_date).length,
      kitchenDone: rows.filter(r => r.kitchen_date).length,
      snagged: rows.filter(r => r.snag_date).length,
      drawndown: rows.filter(r => r.drawdown_date).length,
      handedOver: rows.filter(r => r.handover_date).length,
      redCount: rows.filter(r => Object.values(r.trafficLights).includes('red')).length,
      amberCount: rows.filter(r => Object.values(r.trafficLights).includes('amber') && !Object.values(r.trafficLights).includes('red')).length,
    };

    return NextResponse.json({
      rows,
      stats,
      thresholds,
      development: {
        id: development.id,
        name: development.name,
      }
    });

  } catch (error) {
    console.error('[Pipeline] Error fetching pipeline data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pipeline data' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['developer', 'super_admin']);
    const developmentId = params.id;
    const tenantId = session.tenantId;
    const body = await request.json();
    const { pipelineId, field, value } = body;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    if (!pipelineId || !field) {
      return NextResponse.json(
        { error: 'Missing pipelineId or field' },
        { status: 400 }
      );
    }

    const [development] = await db
      .select()
      .from(developments)
      .where(and(eq(developments.id, developmentId), eq(developments.tenant_id, tenantId)))
      .limit(1);

    if (!development) {
      return NextResponse.json({ error: 'Development not found' }, { status: 404 });
    }

    const [pipelineRecord] = await db
      .select({ id: unitSalesPipeline.id })
      .from(unitSalesPipeline)
      .where(and(
        eq(unitSalesPipeline.id, pipelineId),
        eq(unitSalesPipeline.development_id, developmentId)
      ))
      .limit(1);

    if (!pipelineRecord) {
      return NextResponse.json({ error: 'Pipeline record not found' }, { status: 404 });
    }

    const dateFields = [
      'release_date', 'sale_agreed_date', 'deposit_date',
      'contracts_issued_date', 'signed_contracts_date', 'counter_signed_date',
      'kitchen_date', 'snag_date', 'drawdown_date', 'handover_date',
    ];

    const textFields = ['purchaser_name', 'purchaser_email', 'purchaser_phone'];
    const allowedFields = [...dateFields, ...textFields];

    if (!allowedFields.includes(field)) {
      return NextResponse.json(
        { error: 'Invalid field' },
        { status: 400 }
      );
    }

    const adminId = (session as any).admin?.id;
    const updateData: Record<string, any> = {};

    if (dateFields.includes(field)) {
      updateData[field] = value ? new Date(value) : null;
      const baseField = field.replace('_date', '');
      updateData[`${baseField}_updated_by`] = adminId || null;
      updateData[`${baseField}_updated_at`] = new Date();
    } else {
      updateData[field] = value || null;
    }

    await db
      .update(unitSalesPipeline)
      .set(updateData)
      .where(eq(unitSalesPipeline.id, pipelineId));

    return NextResponse.json({ success: true, updated: updateData });

  } catch (error) {
    console.error('[Pipeline] Error updating pipeline:', error);
    return NextResponse.json(
      { error: 'Failed to update pipeline' },
      { status: 500 }
    );
  }
}
