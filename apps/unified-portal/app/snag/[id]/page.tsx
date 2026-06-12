/**
 * /snag/[id]
 *
 * Assistant V2 Sprint 2. Stub detail view for a single snag. Renders
 * title, description, room, source, status, and the linked photos with
 * one-hour signed URLs. No edit controls in V1; the developer dashboard
 * (Sprint 3) is where richer detail and resolution flow lands.
 *
 * Spec section 7.7 ("Tap a row to view detail (Sprint 3 territory, can
 * be a stub in this sprint).").
 */

import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { isBuilderSnagAppEnabled } from '@/lib/feature-flags';
import { resolveSnagAuth, assertCanAccessDevelopment, SnagAuthError } from '@/lib/assistant/snag-auth';
import { createServerSupabaseClient, getSupabaseAdmin } from '@/lib/supabase-server';
import { SnagNoAccess } from '../SnagNoAccess';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = 'assistant-media';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

interface PageProps {
  params: { id: string };
}

export default async function SnagDetailPage({ params }: PageProps) {
  if (!isBuilderSnagAppEnabled()) notFound();
  if (!UUID_RE.test(params.id)) notFound();

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirectTo=/snag/${params.id}`);
  }

  let auth;
  try {
    auth = await resolveSnagAuth();
  } catch (err) {
    if (err instanceof SnagAuthError) {
      return <SnagNoAccess code={err.code} />;
    }
    throw err;
  }

  const admin = getSupabaseAdmin();
  const { data: report, error: reportErr } = await admin
    .from('issue_reports')
    .select(
      'id, tenant_id, development_id, unit_id, title, description, room, status, priority, severity_label, source, logged_by_role, created_at',
    )
    .eq('id', params.id)
    .maybeSingle();
  if (reportErr || !report) notFound();
  if (report.tenant_id !== auth.tenantId) notFound();
  try {
    assertCanAccessDevelopment(auth, report.development_id as string);
  } catch {
    notFound();
  }

  const { data: joinRows } = await admin
    .from('issue_report_media')
    .select('media_id')
    .eq('issue_report_id', params.id);
  const mediaIds = (joinRows ?? []).map((j) => j.media_id as string);

  const mediaPayload: Array<{ id: string; signed_url: string; thumb_url: string }> = [];
  if (mediaIds.length > 0) {
    const { data: mediaRows } = await admin
      .from('assistant_media')
      .select('id, tenant_id, storage_path, thumbnail_path')
      .in('id', mediaIds);
    for (const m of mediaRows ?? []) {
      if (m.tenant_id !== auth.tenantId) continue;
      const { data: signed } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(m.storage_path as string, SIGNED_URL_TTL_SECONDS);
      let thumbUrl = signed?.signedUrl ?? '';
      if (m.thumbnail_path) {
        const { data: thumb } = await admin.storage
          .from(BUCKET)
          .createSignedUrl(m.thumbnail_path as string, SIGNED_URL_TTL_SECONDS);
        if (thumb?.signedUrl) thumbUrl = thumb.signedUrl;
      }
      mediaPayload.push({
        id: m.id as string,
        signed_url: signed?.signedUrl ?? '',
        thumb_url: thumbUrl,
      });
    }
  }

  const created = new Date(report.created_at as string);
  const createdHuman = isNaN(created.getTime()) ? '' : created.toLocaleString();

  // unused for now but kept for future header back-link logic
  void headers;

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="px-4 py-3 bg-white border-b border-neutral-200 flex items-center gap-2">
        <Link
          href="/snag/houses"
          className="w-11 h-11 -ml-2 flex items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100"
          aria-label="Back to snag form"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-heading-sm text-neutral-900 truncate">Snag detail</h1>
      </header>

      <main className="px-4 py-6 space-y-4 max-w-2xl mx-auto">
        <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3">
          <div>
            <div className="text-caption text-neutral-500">Title</div>
            <div className="text-body text-neutral-900">{report.title}</div>
          </div>
          {report.room ? (
            <div>
              <div className="text-caption text-neutral-500">Room</div>
              <div className="text-body text-neutral-900">{report.room}</div>
            </div>
          ) : null}
          {report.description ? (
            <div>
              <div className="text-caption text-neutral-500">Notes</div>
              <div className="text-body text-neutral-900 whitespace-pre-wrap">{report.description}</div>
            </div>
          ) : null}
          <div className="flex gap-3 text-caption text-neutral-500">
            <span>Status: {report.status}</span>
            <span>Source: {report.source}</span>
          </div>
          {createdHuman ? (
            <div className="text-caption text-neutral-500">Logged {createdHuman}</div>
          ) : null}
        </div>

        {mediaPayload.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {mediaPayload.map((m) => (
              <a
                key={m.id}
                href={m.signed_url}
                target="_blank"
                rel="noreferrer"
                className="block aspect-square bg-white border border-neutral-200 rounded-md overflow-hidden active:opacity-80"
              >
                <img src={m.thumb_url} alt="" className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        ) : (
          <div className="text-body-sm text-neutral-500 px-1">No photos attached.</div>
        )}
      </main>
    </div>
  );
}
