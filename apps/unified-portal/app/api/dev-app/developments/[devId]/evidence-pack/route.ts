import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { createServerSupabaseClient, getSupabaseAdmin } from '@/lib/supabase-server';
import { getAdminContextFromSession, isSuperAdmin } from '@/lib/api-auth';
import { summariseHpiQa8 } from '@/lib/dev-app/unit-systems';
import {
  buildSchemeIndexPdf,
  buildUnitEvidencePdf,
  type EvidencePackUnit,
} from '@/lib/dev-app/evidence-pack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Open-ish issue_reports statuses (canonical snag system) — matches the unit file route.
const OPEN_ISSUE_STATUSES = ['open', 'reopened', 'homeowner_new', 'homeowner_escalated'];
// Signed URLs live long enough for an assessor review cycle.
const SIGNED_URL_TTL_SECONDS = 604800; // 7 days
// Hard cap so a very large scheme cannot blow the time budget on URL signing.
const MANIFEST_DOCUMENT_CAP = 500;

/**
 * GET /api/dev-app/developments/[devId]/evidence-pack
 *
 * One-click HPI evidence pack for a whole scheme: a ZIP containing
 *   00_Scheme_Readiness_Index.pdf  — QA 8.0 readiness rollup
 *   units/Unit_<n>.pdf             — per-home evidence (guide, handover trail, systems, snags)
 *   manifest.json                  — stored compliance documents as 7-day signed links
 *
 * Stored binaries are linked, not embedded: canonical files stay in storage
 * (platform rule: metadata + URLs only) and re-zipping hundreds of certs
 * would exceed the serverless budget.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { devId: string } },
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getSupabaseAdmin();
    const { data: development } = await admin
      .from('developments')
      .select('id, name, address, tenant_id, developer_user_id')
      .eq('id', params.devId)
      .single();
    if (!development) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Two access models, matching the two surfaces this serves:
    //   dev-app   — the signed-in auth user owns the development
    //   /developer — an admin session in the development's tenant (or super admin)
    let authorized = development.developer_user_id === user.id;
    if (!authorized) {
      const context = await getAdminContextFromSession();
      authorized = !!context && (isSuperAdmin(context) || context.tenantId === development.tenant_id);
    }
    if (!authorized) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data: units } = await admin
      .from('units')
      .select('id, unit_number, address_line_1, eircode, house_type_code')
      .eq('development_id', development.id)
      .order('unit_number');

    const unitList = units ?? [];
    if (unitList.length === 0) {
      return NextResponse.json({ error: 'No units in this development' }, { status: 400 });
    }
    const unitIds = unitList.map((u: any) => u.id);
    const [eventsRes, systemsRes, guidesRes, snagsRes, complianceRes] = await Promise.all([
      admin
        .from('handover_events')
        .select('*')
        .in('unit_id', unitIds)
        .order('occurred_at', { ascending: false }),
      admin.from('unit_systems').select('*').in('unit_id', unitIds).order('system_type'),
      admin
        .from('home_user_guides')
        .select('unit_id, version, status, issued_at, content')
        .in('unit_id', unitIds)
        .order('version', { ascending: false }),
      admin.from('issue_reports').select('unit_id, status').in('unit_id', unitIds),
      admin
        .from('compliance_documents')
        .select('id, unit_id, document_type_id, status, version, updated_at')
        .eq('development_id', development.id)
        .neq('status', 'missing'),
    ]);

    const eventsByUnit: Record<string, any[]> = {};
    for (const e of eventsRes.data ?? []) (eventsByUnit[e.unit_id] ||= []).push(e);
    const systemsByUnit: Record<string, any[]> = {};
    for (const s of systemsRes.data ?? []) (systemsByUnit[s.unit_id] ||= []).push(s);

    // Highest version per unit, preferring an issued guide
    const guideByUnit: Record<string, any> = {};
    for (const g of guidesRes.data ?? []) {
      const existing = guideByUnit[g.unit_id];
      if (!existing) {
        guideByUnit[g.unit_id] = g;
      } else if (existing.status !== 'issued' && g.status === 'issued') {
        guideByUnit[g.unit_id] = g;
      }
    }

    const snagsByUnit: Record<string, { total: number; open: number }> = {};
    for (const s of snagsRes.data ?? []) {
      const entry = (snagsByUnit[s.unit_id] ||= { total: 0, open: 0 });
      entry.total += 1;
      if (OPEN_ISSUE_STATUSES.includes(s.status)) entry.open += 1;
    }

    const packUnits: EvidencePackUnit[] = unitList.map((u: any) => {
      const systems = systemsByUnit[u.id] ?? [];
      const events = eventsByUnit[u.id] ?? [];
      const guideRow = guideByUnit[u.id] ?? null;
      const evidence = summariseHpiQa8(systems, events);
      const guideIssued = evidence.guide_issued || guideRow?.status === 'issued';
      return {
        unit: u,
        systems,
        events,
        guide: guideRow
          ? {
              version: guideRow.version,
              status: guideRow.status,
              issued_at: guideRow.issued_at,
              content: guideRow.content ?? null,
            }
          : null,
        openSnagCount: snagsByUnit[u.id]?.open ?? 0,
        totalSnagCount: snagsByUnit[u.id]?.total ?? 0,
        evidence: { ...evidence, guide_issued: guideIssued, qa8_ready: guideIssued && evidence.demo_completed },
      };
    });

    // Stored compliance documents → signed links in the manifest (not embedded)
    const complianceRows = (complianceRes.data ?? []).slice(0, MANIFEST_DOCUMENT_CAP);
    const docIds = complianceRows.map((d: any) => d.id);
    const [filesRes, typesRes] = await Promise.all([
      docIds.length > 0
        ? admin
            .from('compliance_files')
            .select('document_id, file_name, storage_path, version')
            .in('document_id', docIds)
        : Promise.resolve({ data: [] as any[] }),
      admin.from('compliance_document_types').select('id, name'),
    ]);
    const typeNames: Record<string, string> = Object.fromEntries(
      (typesRes.data ?? []).map((t: any) => [t.id, t.name]),
    );
    const unitNumbers: Record<string, string> = Object.fromEntries(
      unitList.map((u: any) => [u.id, u.unit_number]),
    );

    const manifestDocuments: any[] = [];
    for (const file of filesRes.data ?? []) {
      const doc = complianceRows.find((d: any) => d.id === file.document_id);
      if (!doc || !file.storage_path) continue;
      const { data: signed } = await admin.storage
        .from('compliance-documents')
        .createSignedUrl(file.storage_path, SIGNED_URL_TTL_SECONDS);
      if (!signed?.signedUrl) continue;
      manifestDocuments.push({
        unit_id: doc.unit_id,
        unit_number: unitNumbers[doc.unit_id] ?? null,
        document_type: typeNames[doc.document_type_id] ?? 'Document',
        file_name: file.file_name,
        status: doc.status,
        version: doc.version ?? file.version ?? 1,
        signed_url: signed.signedUrl,
        expires_at: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
      });
    }

    const generatedAt = new Date().toISOString();
    const manifest = {
      generated_at: generatedAt,
      development: { id: development.id, name: development.name },
      units: unitList.length,
      qa8_ready: packUnits.filter((u) => u.evidence.qa8_ready).length,
      documents: manifestDocuments,
      truncated: (complianceRes.data ?? []).length > MANIFEST_DOCUMENT_CAP,
      note:
        'Stored certificates are linked (7-day signed URLs), not embedded: the canonical files remain in OpenHouse storage and links keep this pack light enough to generate on demand.',
    };

    // Assemble the ZIP
    const zip = new JSZip();
    const indexPdf = await buildSchemeIndexPdf(
      { name: development.name, address: development.address },
      packUnits,
      generatedAt,
    );
    zip.file('00_Scheme_Readiness_Index.pdf', Buffer.from(indexPdf));

    for (const pu of packUnits) {
      const pdfBytes = await buildUnitEvidencePdf(development.name, pu);
      const safeName = (pu.unit.unit_number ? `Unit_${pu.unit.unit_number}` : pu.unit.id.slice(0, 8))
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .slice(0, 50);
      zip.file(`units/${safeName}.pdf`, Buffer.from(pdfBytes));
    }

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const safeScheme = development.name.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_');
    const filename = `${safeScheme}_HPI_Evidence_Pack_${generatedAt.slice(0, 10)}.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[EvidencePack] error:', error);
    return NextResponse.json({ error: 'Failed to generate evidence pack' }, { status: 500 });
  }
}
