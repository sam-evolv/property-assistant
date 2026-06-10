import { NextRequest, NextResponse } from 'next/server';
import { loadAuthorizedSchemeEvaluation } from '@/lib/hpi/scheme-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cap the mailto body so it stays within browser URL limits; the full list is
// always available via the chase-list CSV export.
const MAX_MAILTO_ITEMS = 30;

/**
 * POST /api/developer/hpi/scheme/[devId]/draft-request   body: { responsibleParty }
 *
 * Drafts an evidence-request to one responsible party (subcontractor/trade),
 * returning a subject/body + a prefilled mailto link. Transport is deliberately
 * a mailto + copy-to-clipboard (no send pipeline / agent-workspace dependency);
 * swapping to a real send later is a one-function change here.
 */
export async function POST(request: NextRequest, { params }: { params: { devId: string } }) {
  const result = await loadAuthorizedSchemeEvaluation(params.devId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    /* empty body tolerated */
  }
  const responsibleParty = (body?.responsibleParty ?? '').trim();
  if (!responsibleParty) {
    return NextResponse.json({ error: 'responsibleParty is required' }, { status: 400 });
  }

  const gaps = result.evaluation.gaps.filter((g) => g.responsibleParty === responsibleParty);
  if (gaps.length === 0) {
    return NextResponse.json({ error: 'No outstanding items for that party' }, { status: 404 });
  }

  const lines = gaps
    .slice(0, MAX_MAILTO_ITEMS)
    .map((g) => {
      const where = g.unitLabel ? `${g.unitLabel}: ` : '';
      const item = g.detail.split(' — ')[0] || g.code;
      return `- ${where}${item} (${g.status})`;
    });
  const extra = gaps.length > MAX_MAILTO_ITEMS ? `\n…and ${gaps.length - MAX_MAILTO_ITEMS} more (see the chase-list export).` : '';

  const subject = `${result.development.name} — outstanding HPI evidence (${responsibleParty})`;
  const greeting = `Hi,\n\nFor HPI evidence readiness at ${result.development.name} we still need the following from you:\n\n`;
  const closing = `\n\nCould you send these (or let us know timing) at your earliest convenience? It keeps the scheme on track for certification.\n\nThanks.`;
  const text = `${greeting}${lines.join('\n')}${extra}${closing}`;

  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;

  return NextResponse.json({
    responsibleParty,
    subject,
    body: text,
    mailto,
    itemCount: gaps.length,
  });
}
