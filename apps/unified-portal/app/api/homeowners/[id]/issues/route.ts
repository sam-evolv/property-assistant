/**
 * GET /api/homeowners/[id]/issues
 *
 * Assistant V2 Sprint 3.5a. Returns every issue raised on or against a
 * given homeowner's unit, with the linked AI analysis and a one-hour
 * signed URL for the first attached photo per row. Feeds the Reported
 * Issues card on the homeowner detail page.
 *
 * Spec: docs/specs/assistant-v2-sprint-3-5a.md section 5.3.
 *
 * The [id] path parameter is the unit's UUID. This matches the
 * established convention used by every other /api/homeowners/[id]/*
 * route in the codebase (the /developer/homeowners/[id] URL surfaces
 * the unit id, not the purchaser_agreement id). The original spec
 * called for purchaser_agreement.id; that was inconsistent and the
 * route was updated to follow the codebase convention. The data model
 * supports this cleanly because issue_reports.unit_id is the natural
 * join key.
 *
 * Result ordering: status priority first (homeowner_new, then open,
 * then reopened, then resolved), then created_at desc within each
 * status bucket so the most recent rows surface at the top of each
 * group. The site team is meant to triage homeowner_new rows before
 * anything else.
 *
 * Access scoping. admin and site_team only. snagger_external is
 * rejected with 403.
 *
 * Gated on FEATURE_HOMEOWNER_ISSUES.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { isHomeownerIssuesEnabled } from '@/lib/feature-flags';
import {
  resolveSnagAuth,
  assertCanAccessTenant,
  snagAuthErrorToResponse,
  snagFeatureDisabledResponse,
  SnagAuthError,
} from '@/lib/assistant/snag-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const BUCKET = 'assistant-media';

const STATUS_PRIORITY: Record<string, number> = {
  homeowner_new: 0,
  open: 1,
  reopened: 2,
  resolved: 3,
};

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!isHomeownerIssuesEnabled()) {
    return snagFeatureDisabledResponse();
  }

  const unitId = params.id;
  if (!UUID_RE.test(unitId)) {
    return NextResponse.json({ error: 'id must be a uuid' }, { status: 400 });
  }

  let auth;
  try {
    auth = await resolveSnagAuth(request);
  } catch (err) {
    if (err instanceof SnagAuthError) return snagAuthErrorToResponse(err);
    throw err;
  }
  if (auth.role === 'snagger_external') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  const { data: unit, error: unitErr } = await supabase
    .from('units')
    .select('id, tenant_id, development_id')
    .eq('id', unitId)
    .maybeSingle();
  if (unitErr) {
    console.error('[homeowners-issues] unit_lookup_failed reason=%s', unitErr.message);
    return NextResponse.json({ error: 'Could not load unit' }, { status: 500 });
  }
  if (!unit || !unit.tenant_id) {
    return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
  }
  try {
    assertCanAccessTenant(auth, unit.tenant_id as string);
  } catch (err) {
    if (err instanceof SnagAuthError) return snagAuthErrorToResponse(err);
    throw err;
  }

  const { data: rows, error: listErr } = await supabase
    .from('issue_reports')
    .select(
      'id, tenant_id, development_id, unit_id, title, description, room, source, status, priority, severity_label, severity_score, safety_risk, likely_trade, likely_system, resolution_type, linked_analysis_id, logged_by_role, created_at, updated_at, resolved_at',
    )
    .eq('tenant_id', auth.tenantId)
    .eq('unit_id', unitId);

  if (listErr) {
    console.error('[homeowners-issues] list_failed reason=%s', listErr.message);
    return NextResponse.json({ error: 'Could not load issues' }, { status: 500 });
  }

  const issueRows = rows ?? [];
  issueRows.sort((a, b) => {
    const aPriority = STATUS_PRIORITY[a.status as string] ?? 99;
    const bPriority = STATUS_PRIORITY[b.status as string] ?? 99;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime();
  });

  const issueIds = issueRows.map((r) => r.id as string);
  const analysisIds = Array.from(
    new Set(issueRows.map((r) => r.linked_analysis_id as string | null).filter((v): v is string => !!v)),
  );

  const analysisById = new Map<string, Record<string, unknown>>();
  if (analysisIds.length > 0) {
    const { data: analysisRows, error: analysisErr } = await supabase
      .from('assistant_media_analysis')
      .select('*')
      .in('id', analysisIds);
    if (analysisErr) {
      console.error('[homeowners-issues] analysis_lookup_failed reason=%s', analysisErr.message);
    } else {
      for (const a of analysisRows ?? []) {
        analysisById.set(a.id as string, a as Record<string, unknown>);
      }
    }
  }

  const firstMediaByIssue = new Map<string, string>();
  if (issueIds.length > 0) {
    const { data: joinRows, error: joinErr } = await supabase
      .from('issue_report_media')
      .select('issue_report_id, media_id, created_at')
      .in('issue_report_id', issueIds)
      .order('created_at', { ascending: true });
    if (joinErr) {
      console.error('[homeowners-issues] media_join_lookup_failed reason=%s', joinErr.message);
    } else {
      for (const j of joinRows ?? []) {
        const issueId = j.issue_report_id as string;
        if (!firstMediaByIssue.has(issueId)) {
          firstMediaByIssue.set(issueId, j.media_id as string);
        }
      }
    }
  }

  const mediaIds = Array.from(new Set(firstMediaByIssue.values()));
  const mediaById = new Map<
    string,
    {
      id: string;
      storage_path: string;
      thumbnail_path: string | null;
      mime_type: string;
      width: number | null;
      height: number | null;
      tenant_id: string;
    }
  >();
  if (mediaIds.length > 0) {
    const { data: mediaRows, error: mediaErr } = await supabase
      .from('assistant_media')
      .select('id, tenant_id, storage_path, thumbnail_path, mime_type, width, height')
      .in('id', mediaIds);
    if (mediaErr) {
      console.error('[homeowners-issues] media_lookup_failed reason=%s', mediaErr.message);
    } else {
      for (const m of mediaRows ?? []) {
        if (m.tenant_id !== auth.tenantId) continue;
        mediaById.set(m.id as string, {
          id: m.id as string,
          storage_path: m.storage_path as string,
          thumbnail_path: (m.thumbnail_path as string | null) ?? null,
          mime_type: m.mime_type as string,
          width: (m.width as number | null) ?? null,
          height: (m.height as number | null) ?? null,
          tenant_id: m.tenant_id as string,
        });
      }
    }
  }

  const expiresIso = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();

  const issues = await Promise.all(
    issueRows.map(async (r) => {
      const issueId = r.id as string;
      const mediaId = firstMediaByIssue.get(issueId);
      let media: {
        id: string;
        signed_url: string;
        thumbnail_url: string;
        mime_type: string;
        width: number | null;
        height: number | null;
        expires_at: string;
      } | null = null;
      if (mediaId) {
        const m = mediaById.get(mediaId);
        if (m) {
          const { data: signed } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(m.storage_path, SIGNED_URL_TTL_SECONDS);
          let thumbUrl = signed?.signedUrl ?? '';
          if (m.thumbnail_path) {
            const { data: thumbSigned } = await supabase.storage
              .from(BUCKET)
              .createSignedUrl(m.thumbnail_path, SIGNED_URL_TTL_SECONDS);
            if (thumbSigned?.signedUrl) thumbUrl = thumbSigned.signedUrl;
          }
          media = {
            id: m.id,
            signed_url: signed?.signedUrl ?? '',
            thumbnail_url: thumbUrl,
            mime_type: m.mime_type,
            width: m.width,
            height: m.height,
            expires_at: expiresIso,
          };
        }
      }

      const linkedAnalysisId = r.linked_analysis_id as string | null;
      const analysis = linkedAnalysisId ? analysisById.get(linkedAnalysisId) ?? null : null;

      return {
        id: issueId,
        title: r.title,
        description: r.description,
        room: r.room,
        source: r.source,
        status: r.status,
        priority: r.priority,
        severity_label: r.severity_label,
        severity_score: r.severity_score,
        safety_risk: r.safety_risk,
        likely_trade: r.likely_trade,
        likely_system: r.likely_system,
        resolution_type: r.resolution_type,
        logged_by_role: r.logged_by_role,
        created_at: r.created_at,
        updated_at: r.updated_at,
        resolved_at: r.resolved_at,
        analysis,
        first_media: media,
      };
    }),
  );

  return NextResponse.json({
    unit_id: unitId,
    issues,
  });
}
