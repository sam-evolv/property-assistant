import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import {
  derivePipelineStage,
  mapComplianceStatus,
} from '@/lib/dev-app/pipeline-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ActivityItem {
  id: string;
  type: string;
  category: 'action' | 'pipeline' | 'compliance' | 'snag' | 'system';
  title: string;
  detail?: string;
  development_name?: string;
  development_id?: string;
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get developer's developments
    const { data: developments } = await supabase
      .from('developments')
      .select('id, name')
      .eq('developer_user_id', user.id);

    const devs = developments || [];
    const devIds = devs.map((d: any) => d.id);
    const devNameMap = Object.fromEntries(
      devs.map((d: any) => [d.id, d.name])
    );

    const items: ActivityItem[] = [];

    // 1. Intelligence actions
    const { data: actions } = await supabase
      .from('intelligence_actions')
      .select('id, action_type, description, created_at, development_id')
      .eq('developer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    (actions || []).forEach((a: any) => {
      items.push({
        id: `action-${a.id}`,
        type: a.action_type,
        category: 'action',
        title: a.description,
        development_name: a.development_id
          ? devNameMap[a.development_id]
          : undefined,
        development_id: a.development_id || undefined,
        created_at: a.created_at,
      });
    });

    if (devIds.length > 0) {
      // Get all units for the developer's developments
      const { data: units } = await supabase
        .from('units')
        .select('id, development_id, unit_number')
        .in('development_id', devIds);

      const allUnits = units || [];
      const unitIds = allUnits.map((u: any) => u.id);
      const unitDevMap = Object.fromEntries(
        allUnits.map((u: any) => [u.id, u.development_id])
      );
      const unitNameMap = Object.fromEntries(
        allUnits.map((u: any) => [u.id, u.unit_number])
      );

      if (unitIds.length > 0) {
        // 2. Recent pipeline updates (last 14 days)
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const { data: pipelineUpdates } = await supabase
          .from('unit_sales_pipeline')
          .select('unit_id, updated_at, release_date, sale_agreed_date, deposit_date, contracts_issued_date, signed_contracts_date, counter_signed_date, kitchen_date, snag_date, drawdown_date, handover_date')
          .in('unit_id', unitIds)
          .gte('updated_at', fourteenDaysAgo.toISOString())
          .order('updated_at', { ascending: false })
          .limit(20);

        (pipelineUpdates || []).forEach((p: any) => {
          const devId = unitDevMap[p.unit_id];
          const unitNum = unitNameMap[p.unit_id];
          const derived = derivePipelineStage(p);
          items.push({
            id: `pipeline-${p.unit_id}-${p.updated_at}`,
            type: 'pipeline_updated',
            category: 'pipeline',
            title: `Unit ${unitNum || 'Unknown'} at ${derived.stage}`,
            development_name: devId ? devNameMap[devId] : undefined,
            development_id: devId || undefined,
            created_at: p.updated_at,
          });
        });

        // 3. Recent compliance doc changes (last 14 days)
        const { data: complianceUpdates } = await supabase
          .from('compliance_documents')
          .select('id, unit_id, status, updated_at, compliance_document_types!inner(name)')
          .in('unit_id', unitIds)
          .gte('updated_at', fourteenDaysAgo.toISOString())
          .order('updated_at', { ascending: false })
          .limit(20);

        (complianceUpdates || []).forEach((c: any) => {
          const devId = unitDevMap[c.unit_id];
          const unitNum = unitNameMap[c.unit_id];
          const displayStatus = mapComplianceStatus(c.status);
          const docName =
            c.compliance_document_types?.name || 'Document';
          items.push({
            id: `compliance-${c.id}`,
            type: `compliance_${displayStatus}`,
            category: 'compliance',
            title: `${docName} ${displayStatus} — Unit ${unitNum || 'Unknown'}`,
            development_name: devId ? devNameMap[devId] : undefined,
            development_id: devId || undefined,
            created_at: c.updated_at,
          });
        });

        // 4. Recent snag items (last 14 days)
        const { data: snagUpdates } = await supabase
          .from('snag_items')
          .select('id, unit_id, description, status, created_at')
          .in('unit_id', unitIds)
          .gte('created_at', fourteenDaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(20);

        (snagUpdates || []).forEach((s: any) => {
          const devId = unitDevMap[s.unit_id];
          const unitNum = unitNameMap[s.unit_id];
          items.push({
            id: `snag-${s.id}`,
            type: `snag_${s.status}`,
            category: 'snag',
            title: `Snag ${s.status}: ${s.description}`,
            detail: `Unit ${unitNum || 'Unknown'}`,
            development_name: devId ? devNameMap[devId] : undefined,
            development_id: devId || undefined,
            created_at: s.created_at,
          });
        });
      }
    }

    // Sort all items by date descending
    items.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({ items: items.slice(0, 50) });
  } catch (error) {
    console.error('[dev-app/activity] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
