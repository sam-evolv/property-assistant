/**
 * POST /api/notifications/homeowner-issue
 *
 * Assistant V2 Sprint 3.5a. Internal-only route triggered by
 * /api/assistant/chat/multimodal immediately after a new
 * homeowner-raised issue is created. Looks up the tenant's aftercare
 * email and dispatches a notification with the issue summary, the
 * homeowner's details, a thumbnail signed URL, and a deep link to the
 * dashboard.
 *
 * Spec: docs/specs/assistant-v2-sprint-3-5a.md section 5.8.
 *
 * Auth. Reuses the INTERNAL_ENRICHMENT_KEY env var (same secret used
 * by /api/snag/enrich) to avoid introducing a second internal-only
 * credential. The header check uses crypto.timingSafeEqual so the
 * route is not vulnerable to timing oracle attacks. As a secondary
 * acceptable proof, an Authorization: Bearer with the Supabase
 * service-role key is also accepted, mirroring the enrich route.
 *
 * Email send. The codebase already has a Resend integration via
 * lib/resend.ts (used by onboarding-submission, new-signup, and the
 * agent-intelligence send-draft path). We reuse the same getResendClient
 * helper which transparently falls back to a stub in environments where
 * RESEND_API_KEY is not configured. The stub logs the would-be send
 * and returns synthetic ids, so this route is exercisable end-to-end
 * in dev and preview without sending real mail.
 *
 * If the tenant has no aftercare_email configured, the route logs a
 * single info-level message and returns 200 without dispatching. That
 * is a deliberate config choice, not an error.
 *
 * Gated on FEATURE_HOMEOWNER_ISSUES. With the flag off the route is
 * 404 before any auth or DB work.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { isHomeownerIssuesEnabled } from '@/lib/feature-flags';
import { snagFeatureDisabledResponse } from '@/lib/assistant/snag-auth';
import { getResendClient } from '@/lib/resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const BUCKET = 'assistant-media';

interface NotifyBody {
  issue_report_id?: unknown;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function isInternalCaller(request: NextRequest): boolean {
  const internalKey = process.env.INTERNAL_ENRICHMENT_KEY;
  const headerKey = request.headers.get('x-internal-key');
  if (internalKey && headerKey && safeEqual(headerKey, internalKey)) {
    return true;
  }
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7);
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey && safeEqual(token, serviceKey)) {
      return true;
    }
  }
  return false;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function deriveUnitDisplayName(u: {
  unit_code: string | null;
  unit_number: string | null;
  address_line_1: string | null;
}): string {
  return u.unit_code ?? u.unit_number ?? u.address_line_1 ?? 'Unit';
}

function resolveDashboardOrigin(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_DEVELOPER_PORTAL_URL) {
    return process.env.NEXT_PUBLIC_DEVELOPER_PORTAL_URL.replace(/\/+$/, '');
  }
  const host = request.headers.get('host');
  if (host) {
    const proto = request.headers.get('x-forwarded-proto') ?? 'https';
    return `${proto}://${host}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}

export async function POST(request: NextRequest) {
  if (!isHomeownerIssuesEnabled()) {
    return snagFeatureDisabledResponse();
  }

  if (!isInternalCaller(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let payload: NotifyBody;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const issueReportId = typeof payload.issue_report_id === 'string' ? payload.issue_report_id : '';
  if (!UUID_RE.test(issueReportId)) {
    return NextResponse.json({ error: 'issue_report_id must be a uuid' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: report, error: reportErr } = await supabase
    .from('issue_reports')
    .select(
      'id, tenant_id, development_id, unit_id, title, description, room, source, status, linked_analysis_id, created_at',
    )
    .eq('id', issueReportId)
    .maybeSingle();
  if (reportErr) {
    console.error('[homeowner-issue-notify] report_lookup_failed reason=%s', reportErr.message);
    return NextResponse.json({ error: 'Could not load issue' }, { status: 500 });
  }
  if (!report) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
  }

  const tenantId = report.tenant_id as string;

  const { data: settings, error: settingsErr } = await supabase
    .from('tenant_settings')
    .select('aftercare_email')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (settingsErr) {
    console.error('[homeowner-issue-notify] settings_lookup_failed reason=%s', settingsErr.message);
    return NextResponse.json({ error: 'Could not load settings' }, { status: 500 });
  }
  const aftercareEmail = (settings?.aftercare_email as string | null) ?? null;
  if (!aftercareEmail || aftercareEmail.trim().length === 0) {
    console.info('[homeowner-issue-notify] aftercare_email_unset tenant=%s issue=%s', tenantId, issueReportId);
    return NextResponse.json({ ok: true, skipped: 'aftercare_email_unset' });
  }

  const unitId = report.unit_id as string | null;
  const developmentId = report.development_id as string;

  const [unitRes, devRes] = await Promise.all([
    unitId
      ? supabase
          .from('units')
          .select('id, unit_code, unit_number, address_line_1, purchaser_name, purchaser_email')
          .eq('id', unitId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('developments').select('id, name').eq('id', developmentId).maybeSingle(),
  ]);

  if (unitRes.error) {
    console.error('[homeowner-issue-notify] unit_lookup_failed reason=%s', unitRes.error.message);
  }
  if (devRes.error) {
    console.error('[homeowner-issue-notify] development_lookup_failed reason=%s', devRes.error.message);
  }

  const unitRow = unitRes.data;
  const unitDisplayName = unitRow
    ? deriveUnitDisplayName({
        unit_code: (unitRow.unit_code as string | null) ?? null,
        unit_number: (unitRow.unit_number as string | null) ?? null,
        address_line_1: (unitRow.address_line_1 as string | null) ?? null,
      })
    : 'Unit';
  const developmentName = devRes.data ? ((devRes.data.name as string | null) ?? null) : null;

  let purchaserAgreementId: string | null = null;
  let homeownerName: string | null = unitRow ? ((unitRow.purchaser_name as string | null) ?? null) : null;
  if (unitId) {
    const { data: agreementRow, error: agreementErr } = await supabase
      .from('purchaser_agreements')
      .select('id, purchaser_name')
      .eq('unit_id', unitId)
      .order('agreed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (agreementErr) {
      console.error(
        '[homeowner-issue-notify] purchaser_lookup_failed reason=%s',
        agreementErr.message,
      );
    } else if (agreementRow) {
      purchaserAgreementId = agreementRow.id as string;
      if (!homeownerName) {
        homeownerName = (agreementRow.purchaser_name as string | null) ?? null;
      }
    }
  }
  if (!homeownerName) {
    homeownerName = 'a homeowner';
  }

  let assessmentSummary: string | null = null;
  const linkedAnalysisId = report.linked_analysis_id as string | null;
  if (linkedAnalysisId) {
    const { data: analysisRow, error: analysisErr } = await supabase
      .from('assistant_media_analysis')
      .select('developer_summary, severity_label')
      .eq('id', linkedAnalysisId)
      .maybeSingle();
    if (analysisErr) {
      console.error(
        '[homeowner-issue-notify] analysis_lookup_failed reason=%s',
        analysisErr.message,
      );
    } else if (analysisRow) {
      const summary =
        typeof analysisRow.developer_summary === 'string'
          ? analysisRow.developer_summary.trim()
          : '';
      if (summary && !/^placeholder/i.test(summary)) {
        assessmentSummary = summary;
      }
    }
  }

  let photoUrl: string | null = null;
  const { data: joinRow, error: joinErr } = await supabase
    .from('issue_report_media')
    .select('media_id, created_at')
    .eq('issue_report_id', issueReportId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (joinErr) {
    console.error('[homeowner-issue-notify] media_join_lookup_failed reason=%s', joinErr.message);
  } else if (joinRow) {
    const mediaId = joinRow.media_id as string;
    const { data: mediaRow, error: mediaErr } = await supabase
      .from('assistant_media')
      .select('id, tenant_id, storage_path, thumbnail_path')
      .eq('id', mediaId)
      .maybeSingle();
    if (mediaErr) {
      console.error('[homeowner-issue-notify] media_lookup_failed reason=%s', mediaErr.message);
    } else if (mediaRow && mediaRow.tenant_id === tenantId) {
      const path = (mediaRow.thumbnail_path as string | null) ?? (mediaRow.storage_path as string);
      const { data: signed, error: signedErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (signedErr) {
        console.error('[homeowner-issue-notify] signed_url_failed reason=%s', signedErr.message);
      } else if (signed?.signedUrl) {
        photoUrl = signed.signedUrl;
      }
    }
  }

  const origin = resolveDashboardOrigin(request);
  const dashboardLink = purchaserAgreementId
    ? `${origin}/developer/homeowners/${purchaserAgreementId}`
    : `${origin}/developer/homeowners`;

  const subject = `New issue raised by ${homeownerName} at ${unitDisplayName}`;

  const titleLine = (report.title as string | null) ?? 'Photo from homeowner';
  const descriptionLine = (report.description as string | null) ?? '';
  const roomLine = (report.room as string | null) ?? '';

  const assessmentBlock = assessmentSummary
    ? assessmentSummary
    : 'Assessment pending. The AI analysis has not produced a full assessment for this upload yet.';

  const textLines = [
    `${homeownerName} raised an issue at ${unitDisplayName}${developmentName ? `, ${developmentName}` : ''}.`,
    '',
    `Title: ${titleLine}`,
  ];
  if (roomLine) textLines.push(`Room: ${roomLine}`);
  if (descriptionLine) {
    textLines.push('');
    textLines.push(`Description:`);
    textLines.push(descriptionLine);
  }
  textLines.push('');
  textLines.push(`Assessment: ${assessmentBlock}`);
  if (photoUrl) {
    textLines.push('');
    textLines.push(`Photo: ${photoUrl}`);
  }
  textLines.push('');
  textLines.push(`Open in dashboard: ${dashboardLink}`);

  const text = textLines.join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #111; padding: 20px;">
        <h1 style="color: #fff; margin: 0; font-size: 18px;">New homeowner issue</h1>
      </div>
      <div style="padding: 24px; background: #fff; color: #111;">
        <p style="margin: 0 0 16px 0;">
          <strong>${escapeHtml(homeownerName)}</strong> raised an issue at
          <strong>${escapeHtml(unitDisplayName)}</strong>${developmentName ? `, ${escapeHtml(developmentName)}` : ''}.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 8px 0 16px 0;">
          <tr>
            <td style="padding: 4px 0; color: #555; width: 30%;">Title</td>
            <td style="padding: 4px 0;"><strong>${escapeHtml(titleLine)}</strong></td>
          </tr>
          ${
            roomLine
              ? `<tr><td style="padding: 4px 0; color: #555;">Room</td><td style="padding: 4px 0;">${escapeHtml(roomLine)}</td></tr>`
              : ''
          }
          ${
            descriptionLine
              ? `<tr><td style="padding: 4px 0; color: #555; vertical-align: top;">Description</td><td style="padding: 4px 0;">${escapeHtml(descriptionLine)}</td></tr>`
              : ''
          }
        </table>
        <div style="padding: 12px 16px; background: #f7f7f7; border-radius: 6px; margin-bottom: 16px;">
          <div style="color: #555; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Assessment</div>
          <div>${escapeHtml(assessmentBlock)}</div>
        </div>
        ${
          photoUrl
            ? `<div style="margin: 16px 0;"><a href="${escapeHtml(photoUrl)}"><img src="${escapeHtml(photoUrl)}" alt="Photo from homeowner" style="max-width: 100%; border-radius: 6px; border: 1px solid #ddd;"/></a></div>`
            : ''
        }
        <div style="margin-top: 24px;">
          <a href="${escapeHtml(dashboardLink)}" style="display: inline-block; padding: 10px 18px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">Open in dashboard</a>
        </div>
      </div>
      <div style="padding: 12px 16px; background: #f5f5f5; text-align: center; color: #777; font-size: 12px;">
        OpenHouse AI aftercare notifications
      </div>
    </div>
  `.trim();

  try {
    const { client, fromEmail } = await getResendClient();
    const result = await client.emails.send({
      from: fromEmail,
      to: aftercareEmail,
      subject,
      html,
      text,
    } as Parameters<typeof client.emails.send>[0]);
    console.info(
      '[homeowner-issue-notify] dispatched tenant=%s issue=%s to=%s id=%s',
      tenantId,
      issueReportId,
      aftercareEmail,
      (result as { id?: string })?.id ?? null,
    );
  } catch (err) {
    console.error(
      '[homeowner-issue-notify] dispatch_failed tenant=%s issue=%s reason=%s',
      tenantId,
      issueReportId,
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json({ error: 'Could not send notification' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    issue_report_id: issueReportId,
    delivered_to: aftercareEmail,
  });
}
