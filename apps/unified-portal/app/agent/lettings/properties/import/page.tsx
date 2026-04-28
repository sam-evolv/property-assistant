'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AgentShell from '../../../_components/AgentShell';

type Confidence = 'high' | 'medium' | 'low';
type Mapping = { header: string; suggestedField: string; confidence: Confidence };
type Phase = 'upload' | 'confirm' | 'preview' | 'importing' | 'done';
type ImportResult = { row: number; ok: boolean; address: string; error?: string; propertyId?: string };

const TARGET_OPTIONS: Array<[string, string]> = [
  ['_skip', 'Skip this column'],
  ['address_line_1', 'Address line 1 *'],
  ['address_line_2', 'Address line 2'],
  ['city', 'Town / City'],
  ['county', 'County'],
  ['eircode', 'Eircode'],
  ['property_type', 'Property type'],
  ['bedrooms', 'Bedrooms'],
  ['bathrooms', 'Bathrooms'],
  ['floor_area_sqm', 'Floor area (sqm)'],
  ['ber_rating', 'BER rating'],
  ['tenant_name', 'Tenant name'],
  ['tenant_email', 'Tenant email'],
  ['tenant_phone', 'Tenant phone'],
  ['monthly_rent_eur', 'Monthly rent (€)'],
  ['lease_start_date', 'Lease start'],
  ['lease_end_date', 'Lease end'],
  ['rtb_registration_number', 'RTB registration'],
];

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 500;

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const out: string[][] = [];
  let row: string[] = []; let cell = ''; let inQ = false; let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 2; continue; }
      if (c === '"') { inQ = false; i++; continue; }
      cell += c; i++;
    } else {
      if (c === '"') { inQ = true; i++; }
      else if (c === ',') { row.push(cell); cell = ''; i++; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); out.push(row); row = []; cell = ''; i++;
      } else { cell += c; i++; }
    }
  }
  if (cell !== '' || row.length > 0) { row.push(cell); out.push(row); }
  const filtered = out.filter((r) => r.length > 1 || (r[0] ?? '').trim() !== '');
  return { headers: filtered[0] ?? [], rows: filtered.slice(1) };
}

export default function ImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<Phase>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [currentAddress, setCurrentAddress] = useState('');
  const [results, setResults] = useState<ImportResult[]>([]);
  const [cancelled, setCancelled] = useState(false);
  const cancelledRef = useRef(false);
  const [editedFailedRows, setEditedFailedRows] = useState<Record<number, Record<string, string>>>({});
  const [retryingRow, setRetryingRow] = useState<number | null>(null);

  const handleFile = async (file: File | null) => {
    setError(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setError('CSV files only for now. XLSX support is coming.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('File is over 5 MB. Try splitting into smaller CSVs.');
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      const { headers: h, rows: r } = parseCsv(text);
      if (h.length === 0 || r.length === 0) throw new Error('CSV needs at least a header row and one data row.');
      if (r.length > MAX_ROWS) throw new Error(`Imports of >${MAX_ROWS} rows aren't supported yet. Please split your CSV.`);
      setHeaders(h); setRows(r);
      const res = await fetch('/api/lettings/import/suggest-mapping', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers: h, sampleRows: r.slice(0, 5) }),
      });
      const json = await res.json().catch(() => ({}));
      const ai: Mapping[] = Array.isArray(json?.mappings) ? json.mappings : h.map((header) => ({ header, suggestedField: '_skip', confidence: 'low' as Confidence }));
      // Backfill any header missing from the AI response
      const map = new Map(ai.map((m) => [m.header, m]));
      setMappings(h.map((header) => map.get(header) ?? { header, suggestedField: '_skip', confidence: 'low' }));
      setPhase('confirm');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not parse CSV');
    } finally {
      setBusy(false);
    }
  };

  const updateMapping = (idx: number, suggestedField: string) => {
    setMappings((prev) => prev.map((m, i) => i === idx ? { ...m, suggestedField, confidence: 'high' } : m));
  };

  const addrMappedIdx = mappings.findIndex((m) => m.suggestedField === 'address_line_1');
  const addrMapped = addrMappedIdx >= 0;

  const fieldFor = (target: string) => {
    const idx = mappings.findIndex((m) => m.suggestedField === target);
    return idx >= 0 ? idx : -1;
  };

  const runImport = async () => {
    cancelledRef.current = false;
    setCancelled(false);
    setResults([]);
    setProgress({ current: 0, total: rows.length });
    setPhase('importing');

    // Build the {header → targetField} mapping object the API expects.
    const mappingObj: Record<string, string> = {};
    for (const m of mappings) {
      if (m.suggestedField && m.suggestedField !== '_skip') mappingObj[m.header] = m.suggestedField;
    }
    const addrIdx = fieldFor('address_line_1');

    for (let i = 0; i < rows.length; i++) {
      if (cancelledRef.current) break;
      const row = rows[i];
      const address = (addrIdx >= 0 ? row[addrIdx] : '') || '(no address)';
      setCurrentAddress(address);
      setProgress({ current: i, total: rows.length });

      // Build {header: value} object scoped to mapped headers only.
      const rowObj: Record<string, string> = {};
      headers.forEach((h, idx) => { if (mappingObj[h]) rowObj[h] = row[idx] ?? ''; });

      try {
        const res = await fetch('/api/lettings/import/row', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ row: rowObj, mapping: mappingObj }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.ok) {
          setResults((prev) => [...prev, { row: i + 1, ok: true, address, propertyId: data.propertyId }]);
        } else {
          setResults((prev) => [...prev, { row: i + 1, ok: false, address, error: data.error || `Failed (${res.status})` }]);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error';
        setResults((prev) => [...prev, { row: i + 1, ok: false, address, error: msg }]);
      }
    }

    setProgress({ current: rows.length, total: rows.length });
    setPhase('done');
  };

  const retryRow = async (failed: ImportResult) => {
    const idx = failed.row - 1;
    setRetryingRow(idx);
    const orig = rows[idx] ?? [];
    const edited = editedFailedRows[idx] ?? {};

    const mappingObj: Record<string, string> = {};
    for (const m of mappings) {
      if (m.suggestedField && m.suggestedField !== '_skip') mappingObj[m.header] = m.suggestedField;
    }
    const rowObj: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (mappingObj[h]) rowObj[h] = h in edited ? edited[h] : (orig[i] ?? '');
    });
    const addrHeader = headers.find((h) => mappingObj[h] === 'address_line_1');
    const newAddress = addrHeader ? (rowObj[addrHeader] || '(no address)') : failed.address;

    try {
      const res = await fetch('/api/lettings/import/row', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row: rowObj, mapping: mappingObj }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        setResults((prev) => prev.map((r) => r.row === failed.row
          ? { row: r.row, ok: true, address: newAddress, propertyId: data.propertyId }
          : r));
        setEditedFailedRows((prev) => { const next = { ...prev }; delete next[idx]; return next; });
      } else {
        setResults((prev) => prev.map((r) => r.row === failed.row
          ? { ...r, address: newAddress, error: data.error || `Failed (${res.status})` }
          : r));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setResults((prev) => prev.map((r) => r.row === failed.row ? { ...r, error: msg } : r));
    } finally {
      setRetryingRow(null);
    }
  };

  return (
    <AgentShell>
      <div style={{ minHeight: '100%', background: '#FAFAF8', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", paddingBottom: 80 }}>
        <div className="max-w-2xl mx-auto px-4 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Link href="/agent/lettings/properties/new" aria-label="Back" className="inline-flex items-center justify-center w-9 h-9 rounded-lg -ml-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D0D12" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </Link>
            <h1 className="text-base font-semibold text-[#0D0D12] m-0">Import properties from a spreadsheet</h1>
          </div>

          {error && <div role="alert" className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>}

          {phase === 'upload' && (
            <>
              <p className="text-sm text-[#6B7280] mb-5">We&rsquo;ll match your columns to ours, then bring everything in. CSV files only for now.</p>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFile(e.dataTransfer.files?.[0] ?? null); }}
                onClick={() => fileInputRef.current?.click()}
                className="bg-white border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors"
                style={{ borderColor: dragActive ? '#D4AF37' : '#E5E7EB', background: dragActive ? 'rgba(212,175,55,0.04)' : '#fff' }}
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <div className="text-base font-semibold text-[#0D0D12] mb-1">{busy ? 'Reading CSV…' : 'Drop your CSV here'}</div>
                <div className="text-sm text-[#6B7280]">{busy ? 'Hold tight while we look for column matches' : 'Or click to browse'}</div>
                <input ref={fileInputRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="text-center mt-4">
                <a href="/lettings-import-template.csv" download className="text-sm text-[#A47E1B] no-underline">Need help formatting? Download template</a>
              </div>
            </>
          )}

          {phase === 'confirm' && (
            <>
              <p className="text-sm text-[#6B7280] mb-5">{headers.length} columns detected, {rows.length} rows to import. Edit any mapping that looks wrong.</p>
              <div className="flex flex-col gap-2 mb-4">
                {mappings.map((m, idx) => {
                  const sample = rows.slice(0, 2).map((r) => r[idx] ?? '').filter(Boolean).join(' / ') || '—';
                  const dot = m.confidence === 'high' ? '#10B981' : m.confidence === 'medium' ? '#F59E0B' : '#EF4444';
                  return (
                    <div key={`${m.header}-${idx}`} className="bg-white border border-[#E5E7EB] rounded-xl p-3 flex items-center gap-3">
                      <span className="flex-shrink-0 w-2 h-2 rounded-full" style={{ background: dot }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-mono font-medium text-[#0D0D12] truncate">{m.header}</div>
                        <div className="text-xs text-[#A0A8B0] truncate">{sample}</div>
                      </div>
                      <select value={m.suggestedField} onChange={(e) => updateMapping(idx, e.target.value)} className="h-9 border border-[#E5E7EB] rounded-lg px-2 text-sm text-[#0D0D12] bg-white focus:outline-none focus:border-[#D4AF37]">
                        {TARGET_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
              <div className={`mb-4 px-3 py-2 rounded-lg text-xs ${addrMapped ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                Required field: Address — {addrMapped ? 'mapped' : 'please map a column to Address line 1'}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => router.push('/agent/lettings/properties/new')} className="flex-1 h-11 rounded-lg border border-[#E5E7EB] bg-white text-sm font-medium text-[#6B7280] cursor-pointer">Cancel</button>
                <button type="button" disabled={!addrMapped} onClick={() => setPhase('preview')} className="flex-1 h-11 rounded-lg border-0 text-sm font-semibold text-[#0D0D12] cursor-pointer" style={{ background: 'linear-gradient(135deg, #D4AF37, #C49B2A)', opacity: addrMapped ? 1 : 0.5, pointerEvents: addrMapped ? 'auto' : 'none' }}>
                  Continue
                </button>
              </div>
            </>
          )}

          {phase === 'preview' && (
            <>
              <p className="text-sm text-[#6B7280] mb-5">{rows.length} rows will be imported. We&rsquo;ll skip any that fail; you can review them after.</p>
              <div className="flex flex-col gap-2 mb-4">
                {rows.slice(0, 3).map((r, i) => {
                  const addr = fieldFor('address_line_1') >= 0 ? r[fieldFor('address_line_1')] : '';
                  const city = fieldFor('city') >= 0 ? r[fieldFor('city')] : '';
                  const tenant = fieldFor('tenant_name') >= 0 ? r[fieldFor('tenant_name')] : '';
                  const rent = fieldFor('monthly_rent_eur') >= 0 ? r[fieldFor('monthly_rent_eur')] : '';
                  const isTenanted = !!(tenant || rent);
                  return (
                    <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl p-4 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[#0D0D12] truncate">{[addr, city].filter(Boolean).join(', ') || 'Untitled property'}</div>
                        <div className="text-xs text-[#6B7280] truncate">{tenant || 'Vacant'}{rent ? ` · €${rent}/m` : ''}</div>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full" style={isTenanted ? { background: '#FAF3DD', color: '#A47E1B' } : { background: '#F3F4F6', color: '#6B7280' }}>
                        {isTenanted ? 'Tenanted' : 'Vacant'}
                      </span>
                    </div>
                  );
                })}
                {rows.length > 3 && <div className="text-center text-xs text-[#A0A8B0] py-2">+ {rows.length - 3} more</div>}
              </div>
              <p className="text-xs text-[#A0A8B0] mb-4 text-center">Estimated time: ~{Math.max(1, Math.round(rows.length * 0.5))}s</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPhase('confirm')} className="flex-1 h-11 rounded-lg border border-[#E5E7EB] bg-white text-sm font-medium text-[#6B7280] cursor-pointer">Back</button>
                <button type="button" onClick={runImport} className="flex-1 h-11 rounded-lg border-0 text-sm font-semibold text-[#0D0D12] cursor-pointer" style={{ background: 'linear-gradient(135deg, #D4AF37, #C49B2A)' }}>
                  Import {rows.length} properties
                </button>
              </div>
            </>
          )}

          {phase === 'importing' && (() => {
            const successCount = results.filter((r) => r.ok).length;
            const failedCount = results.filter((r) => !r.ok).length;
            const total = progress.total || rows.length;
            const pct = total > 0 ? Math.round((progress.current / total) * 100) : 0;
            const offset = 2 * Math.PI * 40 * (1 - pct / 100);
            return (
              <>
                <h2 className="text-lg font-semibold text-[#0D0D12] mb-5 text-center">Importing properties</h2>
                <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 flex flex-col items-center mb-4">
                  <div className="relative w-24 h-24 mb-4">
                    <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
                      <circle cx="48" cy="48" r="40" fill="none" stroke="#F3F4F6" strokeWidth="6" />
                      <circle cx="48" cy="48" r="40" fill="none" stroke="#D4AF37" strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 40} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 250ms cubic-bezier(0.16, 1, 0.3, 1)' }} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-2xl font-semibold text-[#0D0D12]">{pct}</div>
                  </div>
                  <div className="text-base font-semibold text-[#0D0D12]">{progress.current} of {total}</div>
                  <div className="text-xs text-[#6B7280] mt-1 max-w-full truncate">Adding {currentAddress}…</div>
                  <div className="mt-3 text-xs">
                    <span style={{ color: '#A47E1B', fontWeight: 600 }}>{successCount} imported</span>
                    <span className="text-[#A0A8B0]"> · </span>
                    <span style={{ color: failedCount > 0 ? '#B91C1C' : '#A0A8B0', fontWeight: failedCount > 0 ? 600 : 400 }}>{failedCount} failed</span>
                  </div>
                </div>
                <div className="text-center">
                  <button type="button" onClick={() => { cancelledRef.current = true; setCancelled(true); }} className="text-sm font-medium text-[#6B7280] bg-transparent border-0 cursor-pointer">Cancel import</button>
                </div>
              </>
            );
          })()}

          {phase === 'done' && (() => {
            const successful = results.filter((r) => r.ok);
            const failed = results.filter((r) => !r.ok);
            const skipped = cancelled ? Math.max(0, rows.length - results.length) : 0;
            const mappedHeaders = mappings.filter((m) => m.suggestedField && m.suggestedField !== '_skip');
            return (
              <>
                <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 mb-4">
                  <h2 className="text-xl font-semibold text-[#0D0D12] m-0 mb-3">{cancelled ? 'Import cancelled' : 'Import complete'}</h2>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(212,175,55,0.12)', color: '#A47E1B' }}>{successful.length} imported</span>
                    {failed.length > 0 && <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(239,68,68,0.10)', color: '#B91C1C' }}>{failed.length} failed</span>}
                    {skipped > 0 && <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: '#F3F4F6', color: '#6B7280' }}>{skipped} skipped</span>}
                  </div>
                  <p className="text-sm text-[#6B7280] m-0">{failed.length > 0 ? 'Review the failures below to fix and retry.' : successful.length > 0 ? 'All properties are now in your portfolio.' : 'No properties were imported.'}</p>
                </div>

                {failed.length > 0 && (
                  <div className="mb-4">
                    <div className="text-[11px] font-semibold tracking-wider uppercase text-[#B91C1C] mb-2">Failed rows ({failed.length})</div>
                    <div className="flex flex-col gap-2">
                      {failed.map((f) => {
                        const idx = f.row - 1;
                        const orig = rows[idx] ?? [];
                        const edited = editedFailedRows[idx] ?? {};
                        const isRetrying = retryingRow === idx;
                        return (
                          <div key={f.row} className="bg-white rounded-xl p-3" style={{ border: '0.5px solid #E5E7EB', borderLeft: '3px solid #F87171' }}>
                            <div className="flex items-baseline justify-between mb-1 gap-2">
                              <span className="text-sm font-semibold text-[#0D0D12] truncate">Row {f.row}: {f.address}</span>
                            </div>
                            <div className="text-xs text-[#B91C1C] mb-3">{f.error || 'Failed'}</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                              {mappedHeaders.map((m) => {
                                const colIdx = headers.indexOf(m.header);
                                const value = m.header in edited ? edited[m.header] : (colIdx >= 0 ? orig[colIdx] ?? '' : '');
                                return (
                                  <div key={m.header}>
                                    <label className="block text-[10px] font-medium text-[#6B7280] mb-0.5 truncate">{m.header}</label>
                                    <input
                                      type="text"
                                      value={value}
                                      onChange={(e) => setEditedFailedRows((prev) => ({ ...prev, [idx]: { ...(prev[idx] ?? {}), [m.header]: e.target.value } }))}
                                      className="h-8 w-full border border-[#E5E7EB] rounded-md px-2 text-xs text-[#0D0D12] bg-white focus:outline-none focus:border-[#D4AF37]"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex justify-end">
                              <button type="button" disabled={isRetrying} onClick={() => retryRow(f)} className="px-3 py-1.5 rounded-lg border-0 text-xs font-semibold text-[#0D0D12] cursor-pointer" style={{ background: 'linear-gradient(135deg, #D4AF37, #C49B2A)', opacity: isRetrying ? 0.5 : 1, pointerEvents: isRetrying ? 'none' : 'auto' }}>
                                {isRetrying ? 'Retrying…' : 'Retry'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {successful.length > 0 && (
                  <div className="mb-4">
                    <div className="text-[11px] font-semibold tracking-wider uppercase text-[#9EA8B5] mb-2">Imported ({successful.length})</div>
                    <div className="flex flex-col gap-1.5">
                      {successful.slice(0, 10).map((s) => (
                        <Link key={s.row} href={`/agent/lettings/properties/${s.propertyId}`} className="flex items-center gap-3 bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 no-underline">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[#0D0D12] truncate">{s.address}</div>
                          </div>
                          <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full flex-shrink-0" style={{ background: '#FAF3DD', color: '#A47E1B' }}>Saved</span>
                        </Link>
                      ))}
                      {successful.length > 10 && (
                        <Link href="/agent/lettings/properties" className="text-xs text-[#6B7280] no-underline text-center py-2">
                          Showing 10 of {successful.length} · View all
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                <button type="button" onClick={() => router.push('/agent/lettings/properties')} className="w-full h-11 rounded-lg border-0 text-sm font-semibold text-[#0D0D12] cursor-pointer" style={{ background: 'linear-gradient(135deg, #D4AF37, #C49B2A)' }}>
                  Done — back to Properties
                </button>
              </>
            );
          })()}
        </div>
      </div>
    </AgentShell>
  );
}
