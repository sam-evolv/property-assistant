/**
 * /developer/compliance/pack?developmentId=...
 *
 * The evidence pack: every required compliance item for the scheme,
 * grouped by category, with per-unit status counts, what's verified,
 * what's missing (named homes), and expiry warnings. Print-friendly —
 * this is the document you hand an assessor, Homebond or a certifier.
 */

import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import { requireRole, getSupabaseAdmin } from '@/lib/supabase-server';
import { PrintButton } from './print-button';

export const dynamic = 'force-dynamic';

const GOOD_STATUSES = ['uploaded', 'verified'];

interface TypeRollup {
  id: string;
  name: string;
  category: string;
  total: number;
  verified: number;
  uploaded: number;
  expiredOrRenewal: number;
  missingUnits: string[];
  expiring: Array<{ unit: string; date: string }>;
}

function fmt(date: unknown): string {
  const d = new Date(String(date));
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function CompliancePackPage({
  searchParams,
}: {
  searchParams: { developmentId?: string };
}) {
  let session;
  try {
    session = await requireRole(['developer', 'admin', 'super_admin']);
  } catch {
    redirect('/unauthorized');
  }

  const developmentId = searchParams.developmentId;
  if (!developmentId) notFound();

  const supabase = getSupabaseAdmin();
  const { data: development } = await supabase
    .from('developments')
    .select('id, name, tenant_id')
    .eq('id', developmentId)
    .maybeSingle();
  if (!development) notFound();
  if (session.role !== 'super_admin' && development.tenant_id !== session.tenantId) notFound();

  const [typesRes, docsRes, unitsRes] = await Promise.all([
    supabase
      .from('compliance_document_types')
      .select('id, name, category, required, house_type')
      .eq('development_id', developmentId)
      .eq('required', true)
      .order('category')
      .order('name'),
    supabase
      .from('compliance_documents')
      .select('id, unit_id, document_type_id, status, expiry_date, verified_at')
      .eq('development_id', developmentId),
    supabase
      .from('units')
      .select('id, unit_number, address, address_line_1')
      .eq('development_id', developmentId),
  ]);

  const types = typesRes.data || [];
  const docs = docsRes.data || [];
  const unitLabel = new Map<string, string>(
    (unitsRes.data || []).map((u) => [u.id, u.address || u.address_line_1 || u.unit_number || 'Unit']),
  );

  const now = Date.now();
  const soonMs = 60 * 86_400_000;
  const rollups: TypeRollup[] = types.map((t) => {
    const rows = docs.filter((d) => d.document_type_id === t.id);
    const missingUnits = rows
      .filter((d) => !GOOD_STATUSES.includes(d.status))
      .map((d) => unitLabel.get(d.unit_id) || 'Unit')
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const expiring = rows
      .filter((d) => {
        if (!d.expiry_date) return false;
        const t2 = new Date(d.expiry_date).getTime();
        return t2 > now && t2 - now < soonMs;
      })
      .map((d) => ({ unit: unitLabel.get(d.unit_id) || 'Unit', date: fmt(d.expiry_date) }));
    return {
      id: t.id,
      name: t.name,
      category: t.category,
      total: rows.length,
      verified: rows.filter((d) => d.status === 'verified').length,
      uploaded: rows.filter((d) => d.status === 'uploaded').length,
      expiredOrRenewal: rows.filter((d) => d.status === 'expired' || d.status === 'pending_renewal').length,
      missingUnits,
      expiring,
    };
  });

  const categories = Array.from(new Set(rollups.map((r) => r.category))).sort();
  const totalSlots = rollups.reduce((s, r) => s + r.total, 0);
  const totalGood = rollups.reduce((s, r) => s + r.verified + r.uploaded, 0);
  const overallPct = totalSlots > 0 ? Math.round((totalGood / totalSlots) * 100) : 0;
  const allClear = totalSlots > 0 && totalGood === totalSlots;

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-2xl px-6 py-10 print:py-4">
        <div className="flex items-start justify-between gap-4 print:hidden">
          <Link
            href="/developer/compliance"
            className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"
          >
            <ArrowLeft className="h-4 w-4" /> Compliance
          </Link>
          <PrintButton />
        </div>

        <header className="mt-6 border-b border-neutral-200 pb-6 print:mt-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Compliance evidence pack
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{development.name}</h1>
          <div className="mt-4 flex items-center gap-6 text-sm">
            <span>
              <span className="font-semibold">{types.length}</span> required document type{types.length === 1 ? '' : 's'}
            </span>
            <span>
              <span className="font-semibold">{totalGood}</span> of {totalSlots} items in place ({overallPct}%)
            </span>
            {allClear ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                COMPLETE
              </span>
            ) : (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                {totalSlots - totalGood} OUTSTANDING
              </span>
            )}
          </div>
          <p className="mt-3 text-xs text-neutral-400">
            Generated {new Date().toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })} · OpenHouse
          </p>
        </header>

        {types.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-500">
            No required document types are configured for this scheme yet.
          </p>
        ) : (
          categories.map((category) => (
            <section key={category} className="border-b border-neutral-100 py-6 last:border-0">
              <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-400">{category}</h2>
              <ul className="mt-3 space-y-5">
                {rollups
                  .filter((r) => r.category === category)
                  .map((r) => {
                    const good = r.verified + r.uploaded;
                    const complete = r.total > 0 && good === r.total;
                    return (
                      <li key={r.id} className="break-inside-avoid">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            {complete ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                            ) : (
                              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                            )}
                            <div>
                              <p className="font-semibold">{r.name}</p>
                              <p className="mt-0.5 text-xs text-neutral-500">
                                {r.verified} verified · {r.uploaded} uploaded · {r.total - good} outstanding
                                {r.expiredOrRenewal > 0 && (
                                  <span className="text-red-600"> · {r.expiredOrRenewal} expired/renewal due</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                              complete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {good}/{r.total}
                          </span>
                        </div>
                        {r.missingUnits.length > 0 && (
                          <p className="mt-1.5 pl-6 text-xs text-neutral-500">
                            Missing: {r.missingUnits.slice(0, 12).join(', ')}
                            {r.missingUnits.length > 12 && ` +${r.missingUnits.length - 12} more`}
                          </p>
                        )}
                        {r.expiring.length > 0 && (
                          <p className="mt-1 pl-6 text-xs text-amber-700">
                            Expiring soon: {r.expiring.slice(0, 6).map((e) => `${e.unit} (${e.date})`).join(', ')}
                          </p>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))
        )}

        <footer className="mt-4 border-t border-neutral-200 pt-6 text-xs text-neutral-400">
          Generated from the live OpenHouse compliance record for {development.name}. Statuses
          reflect the record at the moment of printing.
        </footer>
      </div>
    </div>
  );
}
