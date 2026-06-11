/**
 * /snag/houses/[unitId]/statement
 *
 * Statement of completion for one house: every snag ever raised, who
 * logged it, the evidence photos, who closed it and when, with
 * completion photos. Print-friendly (browser print → PDF) so it can be
 * shown to purchasers at handover.
 *
 * Server-rendered. Same gating as the rest of the snag app.
 */

import { redirect, notFound } from 'next/navigation';
import { isBuilderSnagAppEnabled } from '@/lib/feature-flags';
import { resolveSnagAuth, assertCanAccessDevelopment, SnagAuthError } from '@/lib/assistant/snag-auth';
import { createServerSupabaseClient, getSupabaseAdmin } from '@/lib/supabase-server';
import { SnagNoAccess } from '../../../SnagNoAccess';
import { PrintButton } from './print-button';

export const dynamic = 'force-dynamic';

const BUCKET = 'assistant-media';
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const OPEN_STATUSES = ['open', 'reopened'];

interface StatementSnag {
  id: string;
  title: string;
  description: string | null;
  room: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  logged_by_role: string | null;
  resolvedByRole: string | null;
  resolutionNote: string | null;
  evidencePhotos: string[];
  completionPhotos: string[];
}

export default async function StatementPage({ params }: { params: { unitId: string } }) {
  if (!isBuilderSnagAppEnabled()) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirectTo=/snag/houses/${params.unitId}/statement`);
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
  const { data: unit } = await admin
    .from('units')
    .select('id, tenant_id, development_id, unit_number, address, address_line_1, eircode')
    .eq('id', params.unitId)
    .maybeSingle();
  if (!unit || unit.tenant_id !== auth.tenantId) {
    notFound();
  }
  try {
    assertCanAccessDevelopment(auth, unit.development_id);
  } catch (err) {
    if (err instanceof SnagAuthError) {
      return <SnagNoAccess code={err.code} />;
    }
    throw err;
  }

  const [{ data: development }, { data: reports }] = await Promise.all([
    admin.from('developments').select('id, name').eq('id', unit.development_id).maybeSingle(),
    admin
      .from('issue_reports')
      .select('id, title, description, room, status, created_at, resolved_at, logged_by_role')
      .eq('unit_id', unit.id)
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: true }),
  ]);

  const reportIds = (reports || []).map((r) => r.id);

  // Media joins + resolution events for the whole house in two queries.
  const [{ data: mediaJoins }, { data: events }] = await Promise.all([
    reportIds.length > 0
      ? admin
          .from('issue_report_media')
          .select('issue_report_id, media_id')
          .in('issue_report_id', reportIds)
      : Promise.resolve({ data: [] as any[] }),
    reportIds.length > 0
      ? admin
          .from('issue_events')
          .select('issue_report_id, event_type, actor_type, metadata, created_at')
          .in('issue_report_id', reportIds)
          .eq('event_type', 'snag_resolved')
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const allMediaIds = Array.from(new Set((mediaJoins || []).map((j) => j.media_id)));
  const signedById = new Map<string, string>();
  if (allMediaIds.length > 0) {
    const { data: mediaRows } = await admin
      .from('assistant_media')
      .select('id, tenant_id, storage_path, thumbnail_path')
      .in('id', allMediaIds);
    for (const m of mediaRows || []) {
      if (m.tenant_id !== auth.tenantId) continue;
      const path = m.thumbnail_path || m.storage_path;
      const { data: signed } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (signed?.signedUrl) signedById.set(m.id, signed.signedUrl);
    }
  }

  const resolutionByReport = new Map<string, { role: string | null; note: string | null; mediaIds: string[] }>();
  for (const ev of events || []) {
    const meta = (ev.metadata || {}) as { note?: string; completion_media_ids?: string[] };
    resolutionByReport.set(ev.issue_report_id, {
      role: ev.actor_type || null,
      note: meta.note || null,
      mediaIds: Array.isArray(meta.completion_media_ids) ? meta.completion_media_ids : [],
    });
  }

  const snags: StatementSnag[] = (reports || []).map((r) => {
    const resolution = resolutionByReport.get(r.id);
    const completionIds = new Set(resolution?.mediaIds || []);
    const joined = (mediaJoins || []).filter((j) => j.issue_report_id === r.id);
    const evidencePhotos: string[] = [];
    const completionPhotos: string[] = [];
    for (const j of joined) {
      const url = signedById.get(j.media_id);
      if (!url) continue;
      if (completionIds.has(j.media_id)) completionPhotos.push(url);
      else evidencePhotos.push(url);
    }
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      room: r.room,
      status: r.status,
      created_at: r.created_at,
      resolved_at: r.resolved_at,
      logged_by_role: r.logged_by_role,
      resolvedByRole: resolution?.role || null,
      resolutionNote: resolution?.note || null,
      evidencePhotos,
      completionPhotos,
    };
  });

  const openCount = snags.filter((s) => OPEN_STATUSES.includes(s.status)).length;
  const doneCount = snags.length - openCount;
  const label = unit.unit_number || unit.address || unit.address_line_1 || 'Unit';
  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';
  const roleLabel = (role: string | null) => {
    switch (role) {
      case 'site_team': return 'Site team';
      case 'snagger_external': return 'Snag engineer';
      case 'admin': return 'Site management';
      case 'homeowner': return 'Homeowner';
      default: return role || '—';
    }
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-2xl px-6 py-10 print:py-4">
        <div className="flex items-start justify-between gap-4 print:hidden">
          <a href={`/snag/houses/${unit.id}`} className="text-sm text-neutral-500 hover:text-neutral-900">
            ← Back to house
          </a>
          <PrintButton />
        </div>

        <header className="mt-6 border-b border-neutral-200 pb-6 print:mt-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Statement of completion
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{label}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {development?.name}
            {unit.eircode ? ` · ${unit.eircode}` : ''}
          </p>
          <div className="mt-4 flex items-center gap-6 text-sm">
            <span>
              <span className="font-semibold">{snags.length}</span> snag{snags.length === 1 ? '' : 's'} recorded
            </span>
            <span>
              <span className="font-semibold">{doneCount}</span> completed
            </span>
            {openCount === 0 && snags.length > 0 ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                ALL CLEAR
              </span>
            ) : openCount > 0 ? (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                {openCount} OUTSTANDING
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-neutral-400">
            Generated {new Date().toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })} · OpenHouse
          </p>
        </header>

        {snags.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-500">
            No snags have been recorded for this house.
          </p>
        ) : (
          <ol className="divide-y divide-neutral-100">
            {snags.map((snag, i) => {
              const done = !OPEN_STATUSES.includes(snag.status);
              return (
                <li key={snag.id} className="py-6 break-inside-avoid">
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold">{snag.title}</p>
                        <span
                          className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            done ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {done ? 'Completed' : 'Outstanding'}
                        </span>
                      </div>
                      {snag.description && (
                        <p className="mt-1 text-sm text-neutral-600">{snag.description}</p>
                      )}
                      <p className="mt-1.5 text-xs text-neutral-400">
                        {snag.room ? `${snag.room} · ` : ''}
                        Logged {fmt(snag.created_at)} by {roleLabel(snag.logged_by_role)}
                        {done && snag.resolved_at && (
                          <> · Completed {fmt(snag.resolved_at)}{snag.resolvedByRole ? ` by ${roleLabel(snag.resolvedByRole)}` : ''}</>
                        )}
                      </p>
                      {snag.resolutionNote && (
                        <p className="mt-1.5 text-xs italic text-neutral-500">“{snag.resolutionNote}”</p>
                      )}

                      {(snag.evidencePhotos.length > 0 || snag.completionPhotos.length > 0) && (
                        <div className="mt-3 flex flex-wrap gap-4">
                          {snag.evidencePhotos.length > 0 && (
                            <div>
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                                Reported
                              </p>
                              <div className="flex gap-1.5">
                                {snag.evidencePhotos.slice(0, 4).map((url) => (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img key={url} src={url} alt="" className="h-20 w-20 rounded-lg border border-neutral-200 object-cover" />
                                ))}
                              </div>
                            </div>
                          )}
                          {snag.completionPhotos.length > 0 && (
                            <div>
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                                Completed
                              </p>
                              <div className="flex gap-1.5">
                                {snag.completionPhotos.slice(0, 4).map((url) => (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img key={url} src={url} alt="" className="h-20 w-20 rounded-lg border border-emerald-200 object-cover" />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <footer className="mt-4 border-t border-neutral-200 pt-6 text-xs text-neutral-400">
          This statement was generated from the OpenHouse snagging record for {label},{' '}
          {development?.name}. Every entry carries its original evidence and completion trail.
        </footer>
      </div>
    </div>
  );
}
