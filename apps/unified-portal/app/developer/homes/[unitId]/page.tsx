/**
 * /developer/homes/[unitId] — the Home file (Phase 7 of docs/NORTH_STAR.md).
 *
 * One page per home, its whole life: sale stages, conveyancing, snags with
 * completion evidence, handover events, installed systems, readiness.
 * Server-rendered from the canonical tables; every block renders only when
 * it has something to say.
 */

import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Circle, ClipboardList, FileCheck2,
  Home, KeyRound, Scale, User, Wrench, AlertTriangle,
} from 'lucide-react';
import { requireRole, getSupabaseAdmin } from '@/lib/supabase-server';
import { isBuilderSnagAppEnabled, isDeveloperDashboardEnabled } from '@/lib/feature-flags';
import { EditHomeSheet } from './edit-home-sheet';

export const dynamic = 'force-dynamic';

const OPEN_SNAG_STATUSES = ['open', 'reopened'];

const STAGES: Array<{ key: string; label: string }> = [
  { key: 'release_date', label: 'Released' },
  { key: 'sale_agreed_date', label: 'Sale agreed' },
  { key: 'proof_of_funds_date', label: 'Proof of funds' },
  { key: 'deposit_date', label: 'Deposit' },
  { key: 'deposit_receipt_date', label: 'Receipt issued' },
  { key: 'sadrl_date', label: 'SADRL' },
  { key: 'loan_approved_date', label: 'Loan approved' },
  { key: 'contracts_issued_date', label: 'Contracts issued' },
  { key: 'queries_raised_date', label: 'Queries raised' },
  { key: 'queries_replied_date', label: 'Queries replied' },
  { key: 'signed_contracts_date', label: 'Signed contracts received' },
  { key: 'counter_signed_date', label: 'Counter-signed' },
  { key: 'one_part_returned_date', label: 'One part returned' },
  { key: 'kitchen_date', label: 'Kitchen selected' },
  { key: 'snagging_start_date', label: 'Snagging started' },
  { key: 'snag_date', label: 'Snagging complete' },
  { key: 'drawdown_date', label: 'Drawdown' },
  { key: 'handover_date', label: 'Handover' },
];

const SYSTEM_LABELS: Record<string, string> = {
  heat_pump: 'Heat pump',
  mvhr: 'MVHR',
  ventilation: 'Ventilation',
  solar_pv: 'Solar PV',
  battery: 'Battery',
  ev_charger: 'EV charger',
  hot_water: 'Hot water',
  heating_controls: 'Heating controls',
  windows: 'Windows',
  smart_home: 'Smart home',
  other: 'Other',
};

const HANDOVER_EVENT_LABELS: Record<string, string> = {
  demo_completed: 'Handover demo completed',
  guide_issued: 'Home User Guide issued',
  keys_handed: 'Keys handed over',
  aftercare_activated: 'Aftercare activated',
  inspection: 'Inspection',
  other: 'Event',
};

function fmt(date: unknown): string | null {
  if (!date) return null;
  const d = new Date(String(date));
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function euro(n: unknown): string | null {
  const v = typeof n === 'number' ? n : parseFloat(String(n));
  return isFinite(v) && v > 0 ? `€${v.toLocaleString('en-IE')}` : null;
}

export default async function HomeFilePage({ params }: { params: { unitId: string } }) {
  let session;
  try {
    session = await requireRole(['developer', 'admin', 'super_admin']);
  } catch {
    redirect('/unauthorized');
  }

  const supabase = getSupabaseAdmin();
  const { data: unit } = await supabase
    .from('units')
    .select('*')
    .eq('id', params.unitId)
    .maybeSingle();
  if (!unit) notFound();
  if (session.role !== 'super_admin' && unit.tenant_id !== session.tenantId) notFound();

  const [devRes, pipelineRes, snagsRes, eventsRes, systemsRes] = await Promise.all([
    supabase.from('developments').select('id, name').eq('id', unit.development_id).maybeSingle(),
    supabase.from('unit_sales_pipeline').select('*').eq('unit_id', unit.id).maybeSingle(),
    supabase
      .from('issue_reports')
      .select('id, title, room, status, severity_label, likely_trade, source, created_at, resolved_at')
      .eq('unit_id', unit.id)
      .order('created_at', { ascending: false }),
    supabase.from('handover_events').select('*').eq('unit_id', unit.id).order('created_at', { ascending: true }),
    supabase.from('unit_systems').select('*').eq('unit_id', unit.id),
  ]);

  // Per-home compliance: required document types and their statuses.
  let complianceTotal = 0;
  let complianceGood = 0;
  let complianceGaps: Array<{ name: string; status: string }> = [];
  try {
    const { data: cdocs } = await supabase
      .from('compliance_documents')
      .select('status, expiry_date, document_type_id')
      .eq('unit_id', unit.id);
    if (cdocs && cdocs.length > 0) {
      const typeIds = Array.from(new Set(cdocs.map((c) => c.document_type_id).filter(Boolean)));
      const { data: ctypes } = await supabase
        .from('compliance_document_types')
        .select('id, name, required')
        .in('id', typeIds);
      const typeById = new Map((ctypes || []).map((t) => [t.id, t]));
      for (const c of cdocs) {
        const t = typeById.get(c.document_type_id);
        if (!t?.required) continue;
        complianceTotal += 1;
        const good = c.status === 'verified' || c.status === 'uploaded';
        const expired = c.status === 'expired' || c.status === 'pending_renewal';
        if (good && !expired) complianceGood += 1;
        else complianceGaps.push({ name: t.name, status: expired ? 'expired' : 'missing' });
      }
      complianceGaps.sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === 'expired' ? -1 : 1));
    }
  } catch {
    // compliance tables absent in this environment — the section simply doesn't render
  }

  const development = devRes.data;
  const pipeline = (pipelineRes.data || {}) as Record<string, unknown>;
  const snags = snagsRes.data || [];
  const handoverEvents = eventsRes.data || [];
  const systems = systemsRes.data || [];

  const openSnags = snags.filter((s) => OPEN_SNAG_STATUSES.includes(s.status));
  const doneSnags = snags.filter((s) => !OPEN_SNAG_STATUSES.includes(s.status));
  const eventTypes = new Set(handoverEvents.map((e: any) => e.event_type));

  const label = unit.unit_number || unit.address || unit.address_line_1 || 'Home';
  const address = unit.address || unit.address_line_1 || null;
  const purchaser = (pipeline.purchaser_name as string) || unit.purchaser_name || null;
  const price = euro(pipeline.sale_price);

  const stages = STAGES.map((s) => ({ ...s, date: fmt(pipeline[s.key]) })).filter(
    (s, i, arr) => s.date || arr.slice(0, i + 1).some((x) => x.date) === false || true,
  );
  const reachedCount = STAGES.filter((s) => pipeline[s.key]).length;

  const readiness = [
    { label: 'Sale agreed', done: Boolean(pipeline.sale_agreed_date) },
    { label: 'Contracts signed', done: Boolean(pipeline.signed_contracts_date) },
    {
      label: snags.length === 0 ? 'No snags recorded' : openSnags.length === 0 ? 'Snags clear' : `${openSnags.length} open snag${openSnags.length === 1 ? '' : 's'}`,
      done: snags.length > 0 && openSnags.length === 0,
      warn: openSnags.length > 0,
    },
    ...(complianceTotal > 0
      ? [{
          label:
            complianceGood === complianceTotal
              ? 'Compliance docs complete'
              : `${complianceTotal - complianceGood} compliance doc${complianceTotal - complianceGood === 1 ? '' : 's'} outstanding`,
          done: complianceGood === complianceTotal,
          warn: complianceGood < complianceTotal,
        }]
      : []),
    { label: 'Demo completed', done: eventTypes.has('demo_completed') },
    { label: 'Handed over', done: Boolean(pipeline.handover_date) || eventTypes.has('keys_handed') },
    { label: 'Aftercare active', done: eventTypes.has('aftercare_activated') },
  ];

  const solicitorLine = [pipeline.solicitor_name, pipeline.solicitor_firm]
    .filter(Boolean)
    .join(' · ');
  const conveyancing = [
    { label: 'Solicitor', value: solicitorLine || null },
    { label: 'Solicitor email', value: (pipeline.solicitor_email as string) || null },
    { label: 'Solicitor phone', value: (pipeline.solicitor_phone as string) || null },
    { label: 'Projected handover', value: fmt(pipeline.projected_handover_date) },
    { label: 'Mortgage expiry', value: fmt(pipeline.mortgage_expiry_date), warn: true },
  ].filter((c) => c.value);

  const snagsHref = isDeveloperDashboardEnabled() ? '/developer/issues' : '/developer/snagging';
  const showStatement = isBuilderSnagAppEnabled() && snags.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6 md:pt-14">
      <Link
        href="/developer/homeowners"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-grey-500 hover:text-gold-600"
      >
        <ArrowLeft className="h-4 w-4" /> Homes
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium tracking-wide text-gold-600">{development?.name}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-grey-900 md:text-4xl">{label}</h1>
          <p className="mt-1 text-sm text-grey-500">
            {[
              address && address !== label ? address : null,
              unit.house_type_code && unit.house_type_code !== 'TBD' ? unit.house_type_code : null,
              unit.bedrooms ? `${unit.bedrooms} bed` : null,
              unit.eircode,
              price,
            ]
              .filter(Boolean)
              .join(' · ') || '—'}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <EditHomeSheet
            home={{
              unitId: unit.id,
              address: address || '',
              house_type_code: unit.house_type_code && unit.house_type_code !== 'TBD' ? unit.house_type_code : '',
              bedrooms: unit.bedrooms ?? null,
              eircode: unit.eircode || '',
              phase: (unit as Record<string, any>).phase || '',
              property_designation: unit.property_designation || '',
              purchaser_name: (pipeline.purchaser_name as string) || unit.purchaser_name || '',
              purchaser_email: (pipeline.purchaser_email as string) || unit.purchaser_email || '',
              purchaser_phone: (pipeline.purchaser_phone as string) || unit.purchaser_phone || '',
              sale_price: (() => {
                const v = parseFloat(String(pipeline.sale_price));
                return isFinite(v) && v > 0 ? v : null;
              })(),
              solicitor_firm: (pipeline.solicitor_firm as string) || '',
              solicitor_name: (pipeline.solicitor_name as string) || '',
              solicitor_email: (pipeline.solicitor_email as string) || '',
              solicitor_phone: (pipeline.solicitor_phone as string) || '',
            }}
          />
          <Link
            href={`/developer/pipeline/${unit.development_id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-grey-200 bg-white px-4 py-2.5 text-sm font-semibold text-grey-600 transition-all hover:border-gold-400 hover:text-gold-700"
          >
            Pipeline <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Buyer */}
      <div className="mt-6 flex items-center gap-4 rounded-2xl border border-grey-200 bg-white p-5">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gold-50">
          <User className="h-5 w-5 text-gold-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-grey-900">{purchaser || 'For sale'}</p>
          <p className="truncate text-sm text-grey-500">
            {[
              (pipeline.purchaser_email as string) || unit.purchaser_email,
              (pipeline.purchaser_phone as string) || unit.purchaser_phone,
            ]
              .filter(Boolean)
              .join(' · ') || (purchaser ? 'No contact details yet' : 'No purchaser yet')}
          </p>
        </div>
        {unit.unit_uid && (
          <span className="hidden flex-shrink-0 items-center gap-1.5 rounded-full border border-grey-200 bg-grey-50 px-3 py-1.5 font-mono text-xs font-semibold text-grey-600 sm:flex">
            <KeyRound className="h-3.5 w-3.5 text-gold-500" /> {unit.unit_uid}
          </span>
        )}
      </div>

      {/* Readiness */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {readiness.map((r) => (
          <div
            key={r.label}
            className={`flex items-center gap-2 rounded-2xl border p-3.5 ${
              r.done
                ? 'border-gold-200 bg-gold-50/60'
                : (r as any).warn
                  ? 'border-amber-200 bg-amber-50/60'
                  : 'border-grey-200 bg-white'
            }`}
          >
            {r.done ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-gold-600" />
            ) : (r as any).warn ? (
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />
            ) : (
              <Circle className="h-4 w-4 flex-shrink-0 text-grey-300" />
            )}
            <span className={`text-xs font-medium ${r.done ? 'text-grey-900' : 'text-grey-500'}`}>{r.label}</span>
          </div>
        ))}
      </div>

      {/* Sale timeline */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-grey-400">
            <Home className="h-4 w-4 text-gold-500" /> Sale
          </h2>
          <span className="text-xs text-grey-400">{reachedCount} of {STAGES.length} stages</span>
        </div>
        <div className="mt-3 rounded-2xl border border-grey-200 bg-white p-5">
          <ol className="space-y-0">
            {STAGES.map((s) => {
              const date = fmt(pipeline[s.key]);
              return (
                <li key={s.key} className="flex items-center gap-3 border-b border-grey-50 py-2 last:border-0">
                  {date ? (
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-gold-500" />
                  ) : (
                    <Circle className="h-4 w-4 flex-shrink-0 text-grey-200" />
                  )}
                  <span className={`flex-1 text-sm ${date ? 'font-medium text-grey-900' : 'text-grey-400'}`}>
                    {s.label}
                  </span>
                  <span className="text-xs text-grey-500">{date || ''}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Conveyancing */}
      {conveyancing.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-grey-400">
            <Scale className="h-4 w-4 text-gold-500" /> Conveyancing
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {conveyancing.map((c) => (
              <div key={c.label} className="rounded-2xl border border-grey-200 bg-white p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-grey-400">{c.label}</p>
                <p className="mt-1 truncate text-sm font-semibold text-grey-900">{c.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Compliance */}
      {complianceTotal > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-grey-400">
              <FileCheck2 className="h-4 w-4 text-gold-500" /> Compliance
            </h2>
            <Link href="/developer/compliance" className="text-xs font-semibold text-gold-600 hover:text-gold-700">
              All compliance →
            </Link>
          </div>
          <div className="mt-3 rounded-2xl border border-grey-200 bg-white p-5">
            <p className="text-sm text-grey-600">
              <span className={`font-semibold ${complianceGood === complianceTotal ? 'text-grey-900' : 'text-amber-600'}`}>
                {complianceGood} of {complianceTotal}
              </span>{' '}
              required documents in place
            </p>
            {complianceGaps.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {complianceGaps.slice(0, 6).map((g) => (
                  <li key={g.name} className="flex items-center gap-2.5 text-sm">
                    <AlertTriangle className={`h-3.5 w-3.5 flex-shrink-0 ${g.status === 'expired' ? 'text-red-500' : 'text-amber-400'}`} />
                    <span className="min-w-0 flex-1 truncate text-grey-700">{g.name}</span>
                    <span className={`flex-shrink-0 text-[11px] font-medium ${g.status === 'expired' ? 'text-red-600' : 'text-amber-600'}`}>
                      {g.status}
                    </span>
                  </li>
                ))}
                {complianceGaps.length > 6 && (
                  <li className="text-xs text-grey-400">…and {complianceGaps.length - 6} more</li>
                )}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* Snags */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-grey-400">
            <ClipboardList className="h-4 w-4 text-gold-500" /> Snags
          </h2>
          <Link href={snagsHref} className="text-xs font-semibold text-gold-600 hover:text-gold-700">
            All snags →
          </Link>
        </div>
        <div className="mt-3 rounded-2xl border border-grey-200 bg-white p-5">
          {snags.length === 0 ? (
            <p className="text-sm text-grey-500">No snags recorded for this home.</p>
          ) : (
            <>
              <p className="text-sm text-grey-600">
                <span className={`font-semibold ${openSnags.length > 0 ? 'text-amber-600' : 'text-grey-900'}`}>
                  {openSnags.length} open
                </span>{' '}
                · {doneSnags.length} done
              </p>
              <ul className="mt-3 space-y-2">
                {snags.slice(0, 6).map((s) => {
                  const open = OPEN_SNAG_STATUSES.includes(s.status);
                  return (
                    <li key={s.id} className="flex items-center gap-2.5">
                      {open ? (
                        <Circle className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-gold-500" />
                      )}
                      <span className={`min-w-0 flex-1 truncate text-sm ${open ? 'text-grey-900' : 'text-grey-400 line-through'}`}>
                        {s.title}
                      </span>
                      <span className="flex-shrink-0 text-[11px] text-grey-400">
                        {[s.room, s.likely_trade, s.severity_label].filter(Boolean).join(' · ')}
                      </span>
                    </li>
                  );
                })}
                {snags.length > 6 && (
                  <li className="text-xs text-grey-400">…and {snags.length - 6} more</li>
                )}
              </ul>
              {showStatement && (
                <Link
                  href={`/snag/houses/${unit.id}/statement`}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-600 hover:text-gold-700"
                >
                  <FileCheck2 className="h-4 w-4" /> Statement of completion
                </Link>
              )}
            </>
          )}
        </div>
      </section>

      {/* Installed systems */}
      {systems.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-grey-400">
            <Wrench className="h-4 w-4 text-gold-500" /> Installed systems
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {systems.map((sys: any) => (
              <div key={sys.id} className="rounded-2xl border border-grey-200 bg-white p-4">
                <p className="text-sm font-semibold text-grey-900">
                  {SYSTEM_LABELS[sys.system_type] || sys.system_type}
                </p>
                <p className="mt-0.5 text-xs text-grey-500">
                  {[sys.make, sys.model].filter(Boolean).join(' ') || '—'}
                </p>
                {sys.warranty_end && (
                  <p className="mt-1.5 text-[11px] text-grey-400">
                    Warranty until {fmt(sys.warranty_end)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Handover record */}
      {handoverEvents.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-grey-400">
            <KeyRound className="h-4 w-4 text-gold-500" /> Handover record
          </h2>
          <div className="mt-3 rounded-2xl border border-grey-200 bg-white p-5">
            <ol className="space-y-2.5">
              {handoverEvents.map((e: any) => (
                <li key={e.id} className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-gold-500" />
                  <span className="flex-1 text-sm font-medium text-grey-900">
                    {HANDOVER_EVENT_LABELS[e.event_type] || e.event_type}
                  </span>
                  <span className="text-xs text-grey-500">{fmt(e.occurred_at || e.created_at) || ''}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      <p className="mt-10 text-center text-xs text-grey-400">
        Every fact on this page is the live record — sale, snags, evidence and systems in one place.
      </p>
    </div>
  );
}
