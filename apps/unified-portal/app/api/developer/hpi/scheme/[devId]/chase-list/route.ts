import { NextRequest, NextResponse } from 'next/server';
import { loadAuthorizedSchemeEvaluation } from '@/lib/hpi/scheme-access';
import { CATEGORY_LABELS } from '@/lib/hpi/indicators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function csvCell(v: string | null | undefined): string {
  const s = (v ?? '').replace(/"/g, '""');
  return `"${s}"`;
}

/**
 * GET /api/developer/hpi/scheme/[devId]/chase-list
 * CSV of every outstanding HPI evidence gap (one row per gap), ordered by
 * responsible party — the developer's chase sheet for subcontractors.
 */
export async function GET(_request: NextRequest, { params }: { params: { devId: string } }) {
  const result = await loadAuthorizedSchemeEvaluation(params.devId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const gaps = [...result.evaluation.gaps].sort(
    (a, b) =>
      a.responsibleParty.localeCompare(b.responsibleParty) ||
      a.code.localeCompare(b.code) ||
      (a.unitLabel ?? '').localeCompare(b.unitLabel ?? ''),
  );

  const header = [
    'Responsible Party',
    'Indicator Code',
    'Indicator',
    'Category',
    'Scope',
    'Unit',
    'Status',
    'Detail',
  ];
  const rows = gaps.map((g) =>
    [
      g.responsibleParty,
      g.code,
      g.detail.split(' — ')[0] || g.code,
      CATEGORY_LABELS[g.category],
      g.scope === 'per_scheme' ? 'Scheme' : 'Per home',
      g.unitLabel ?? 'Scheme',
      g.status,
      g.detail,
    ]
      .map(csvCell)
      .join(','),
  );

  const csv = [header.map(csvCell).join(','), ...rows].join('\r\n');
  const safeName = result.development.name.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_');
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName}_HPI_Chase_List_${date}.csv"`,
    },
  });
}
