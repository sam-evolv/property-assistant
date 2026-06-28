import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validatePurchaserToken } from '@openhouse/api/qr-tokens';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url!, key!);
}

export interface PurchaserIssue {
  id: string;
  title: string;
  description: string | null;
  room: string | null;
  status: 'homeowner_new' | 'open' | 'reopened' | 'resolved';
  severity_label: string | null;
  source: string;
  created_at: string;
  updated_at: string | null;
  resolved_at: string | null;
  first_media: {
    signed_url: string;
    thumbnail_url: string;
  } | null;
}

interface IssueRow {
  id: string;
  title: string;
  description: string | null;
  room: string | null;
  status: string;
  severity_label: string | null;
  source: string;
  created_at: string;
  updated_at: string | null;
  resolved_at: string | null;
}

// GET /api/purchaser/issues?unitUid=...&token=...
// Returns every issue this homeowner's unit has raised, newest first, with a
// signed URL for the first attached photo. Mirrors the shape the developer
// Reported Issues card uses, but scoped to a single authenticated homeowner.
export async function GET(request: NextRequest) {
  const supabase = getSupabaseClient();
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');

    if (!unitUid) {
      return NextResponse.json({ error: 'Unit UID required' }, { status: 400, headers: NO_STORE });
    }

    const tokenResult = await validatePurchaserToken(token || unitUid, unitUid);
    if (!tokenResult.valid || !tokenResult.unitId) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: NO_STORE });
    }

    const supabaseUnitId = tokenResult.unitId;

    const { data: rows, error: listErr } = await supabase
      .from('issue_reports')
      .select(
        'id, title, description, room, status, severity_label, source, created_at, updated_at, resolved_at',
      )
      .eq('unit_id', supabaseUnitId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (listErr) {
      return NextResponse.json({ error: 'Could not load issues' }, { status: 500, headers: NO_STORE });
    }

    const issueRows = (rows ?? []) as unknown as IssueRow[];
    const result: { unit_id: string; issues: PurchaserIssue[] } = {
      unit_id: supabaseUnitId,
      issues: issueRows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description ?? null,
        room: r.room ?? null,
        status: r.status as PurchaserIssue['status'],
        severity_label: r.severity_label ?? null,
        source: r.source ?? 'homeowner_assistant',
        created_at: r.created_at,
        updated_at: r.updated_at ?? null,
        resolved_at: r.resolved_at ?? null,
        first_media: null,
      })),
    };

    // Attach first photo per issue (best-effort, never breaks the list).
    if (result.issues.length > 0) {
      const issueIds = result.issues.map((i) => i.id);
      try {
        const { data: joinRows } = await supabase
          .from('issue_report_media')
          .select('issue_report_id, media_id, created_at')
          .in('issue_report_id', issueIds)
          .order('created_at', { ascending: true });

        const firstMediaIdByIssue = new Map<string, string>();
        for (const j of joinRows ?? []) {
          const issueId = j.issue_report_id as string;
          if (!firstMediaIdByIssue.has(issueId)) {
            firstMediaIdByIssue.set(issueId, j.media_id as string);
          }
        }

        const mediaIds = Array.from(firstMediaIdByIssue.values());
        if (mediaIds.length > 0) {
          const { data: mediaRows } = await supabase
            .from('assistant_media')
            .select('id, storage_path')
            .in('id', mediaIds);

          const bucket =
            process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'assistant-media';

          for (const m of mediaRows ?? []) {
            const path = (m as { storage_path: string | null }).storage_path;
            if (!path) continue;
            const { data: signed } = await supabase.storage
              .from(bucket)
              .createSignedUrl(path, 3600);
            if (!signed?.signedUrl) continue;

            const pathParts = path.split('/');
            const filename = pathParts.pop() || '';
            const thumbPath = [...pathParts, 'thumbnails', filename.replace(/\.\w+$/, '.jpg')].join('/');
            const { data: signedThumb } = await supabase.storage
              .from(bucket)
              .createSignedUrl(thumbPath, 3600);

            const entry = result.issues.find((i) => firstMediaIdByIssue.get(i.id) === (m as { id: string }).id);
            if (entry) {
              entry.first_media = {
                signed_url: signed.signedUrl,
                thumbnail_url: signedThumb?.signedUrl || signed.signedUrl,
              };
            }
          }
        }
      } catch {
        // Photo lookup is best-effort; leave first_media null on any failure.
      }
    }

    return NextResponse.json(result, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ issues: [] }, { headers: NO_STORE });
  }
}
