import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { unitSalesPipeline, units, developments, pipelineSettings } from '@openhouse/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface ChaseEmailData {
  unitId: string;
  unitName: string;
  purchaserName: string;
  purchaserEmail: string;
  solicitorFirm: string | null;
  reason: string;
  daysPending: number;
  stage: string;
}

function generateChaseEmail(data: ChaseEmailData, developmentName: string): string {
  const greeting = data.purchaserName ? `Dear ${data.purchaserName.split(' ')[0]}` : 'Dear Purchaser';
  
  let body = '';
  switch (data.stage) {
    case 'contracts':
      body = `We note that signed contracts have not yet been received for your purchase at ${data.unitName}, ${developmentName}. ${data.daysPending > 28 ? `It has been ${data.daysPending} days since contracts were issued.` : ''}

Please return your signed contracts at your earliest convenience to avoid any delays in your purchase.`;
      break;
    case 'kitchen':
      body = `We would like to remind you that your kitchen selection for ${data.unitName} at ${developmentName} is still pending.

Please complete your kitchen selection as soon as possible so we can proceed with the installation schedule.`;
      break;
    case 'snag':
      body = `Your snagging inspection for ${data.unitName} at ${developmentName} has not yet been scheduled.

Please contact us to arrange a convenient time for your snagging inspection before handover.`;
      break;
    case 'desnag':
      body = `The de-snagging works for ${data.unitName} at ${developmentName} are still pending completion.

We are working to complete these items before your drawdown date.`;
      break;
    default:
      body = `This is a gentle reminder regarding your purchase at ${data.unitName}, ${developmentName}.

Please contact us if you have any questions.`;
  }

  return `${greeting},

${body}

${data.solicitorFirm ? `We have copied your solicitor at ${data.solicitorFirm} for their records.` : ''}

Best regards,
The Sales Team`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['developer', 'super_admin']);
    const developmentId = params.id;
    const tenantId = session.tenantId;
    const { searchParams } = new URL(request.url);
    const pipelineId = searchParams.get('pipelineId');
    const stage = searchParams.get('stage');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    if (!pipelineId || !stage) {
      return NextResponse.json({ error: 'pipelineId and stage are required' }, { status: 400 });
    }

    const [development] = await db
      .select()
      .from(developments)
      .where(and(eq(developments.id, developmentId), eq(developments.tenant_id, tenantId)))
      .limit(1);

    if (!development) {
      return NextResponse.json({ error: 'Development not found' }, { status: 404 });
    }

    const [row] = await db
      .select({
        id: unitSalesPipeline.id,
        unit_id: unitSalesPipeline.unit_id,
        purchaser_name: unitSalesPipeline.purchaser_name,
        purchaser_email: unitSalesPipeline.purchaser_email,
        solicitor_firm: unitSalesPipeline.solicitor_firm,
        contracts_issued_date: unitSalesPipeline.contracts_issued_date,
        signed_contracts_date: unitSalesPipeline.signed_contracts_date,
        kitchen_date: unitSalesPipeline.kitchen_date,
        snag_date: unitSalesPipeline.snag_date,
        desnag_date: unitSalesPipeline.desnag_date,
        handover_date: unitSalesPipeline.handover_date,
        drawdown_date: unitSalesPipeline.drawdown_date,
        unit_name: units.name,
        unit_number: units.unit_number,
      })
      .from(unitSalesPipeline)
      .leftJoin(units, eq(unitSalesPipeline.unit_id, units.id))
      .where(and(
        eq(unitSalesPipeline.id, pipelineId),
        eq(unitSalesPipeline.development_id, developmentId)
      ));

    if (!row) {
      return NextResponse.json({ error: 'Pipeline record not found' }, { status: 404 });
    }

    if (!row.purchaser_email) {
      return NextResponse.json({ error: 'No purchaser email available' }, { status: 400 });
    }

    let daysPending = 0;
    let referenceDate: Date | null = null;

    switch (stage) {
      case 'contracts':
        referenceDate = row.contracts_issued_date;
        break;
      case 'kitchen':
        referenceDate = row.signed_contracts_date;
        break;
      case 'snag':
        referenceDate = row.handover_date;
        break;
      case 'desnag':
        referenceDate = row.drawdown_date;
        break;
    }

    if (referenceDate) {
      daysPending = Math.floor((new Date().getTime() - new Date(referenceDate).getTime()) / (1000 * 60 * 60 * 24));
    }

    const unitDisplayName = row.unit_name || row.unit_number || 'Unit';
    
    const emailData: ChaseEmailData = {
      unitId: row.unit_id,
      unitName: unitDisplayName,
      purchaserName: row.purchaser_name || '',
      purchaserEmail: row.purchaser_email || '',
      solicitorFirm: row.solicitor_firm,
      reason: stage,
      daysPending,
      stage,
    };

    const emailBody = generateChaseEmail(emailData, development.name || 'the development');

    return NextResponse.json({
      email: {
        to: row.purchaser_email,
        subject: `Action Required: ${stage.charAt(0).toUpperCase() + stage.slice(1)} - ${unitDisplayName}`,
        body: emailBody,
        unitName: unitDisplayName,
        purchaserName: row.purchaser_name,
        daysPending,
      }
    });

  } catch (error) {
    console.error('[Pipeline Chase] Error:', error);
    return NextResponse.json({ error: 'Failed to generate chase email' }, { status: 500 });
  }
}
