'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AgentShell from '../../../../_components/AgentShell';

/**
 * Review screen — Session 7 build.
 *
 * Two parallel flows feed this screen:
 *   1. Address path (placeId or eircode in the URL) — fires
 *      /api/lettings/property-lookup, shows the address/BER status panel.
 *   2. Lease PDF path (leaseDocumentId in the URL) — fires
 *      /api/lettings/extract-lease, shows the extraction status panel
 *      with rows specific to lease data (tenant, rent+dates, RTB number).
 *
 * Both paths render the same raw-JSON debug pane below their status panel
 * and share the same Continue affordance. Session 8 replaces the entire
 * file with the full review form.
 */

type RowStatus = 'pending' | 'ok' | 'soft-miss' | 'fail' | 'skipped';

type LookupResponse = {
  address: {
    line1: string;
    line2?: string;
    town?: string;
    county?: string;
    eircode?: string;
    lat?: number;
    lng?: number;
    formattedAddress?: string;
  };
  ber: {
    rating: string | null;
    certNumber: string | null;
    expiryDate: string | null;
  } | null;
  ppr: null;
  provenance: Array<{
    field: string;
    source: 'google_places' | 'eircode' | 'seai_register';
    confidence: number;
  }>;
};

type ExtractedLease = {
  primaryTenantName: string | null;
  coTenantNames: string[];
  monthlyRentEur: number | null;
  depositAmountEur: number | null;
  leaseStartDate: string | null;
  leaseEndDate: string | null;
  leaseType: 'fixed_term' | 'periodic' | 'part_4' | 'further_part_4' | null;
  noticePeriodDays: number | null;
  rtbRegistrationNumber: string | null;
  breakClauseText: string | null;
  rentPaymentDay: number | null;
  fieldConfidences: Record<string, number>;
};

type ExtractResponse = {
  documentId: string;
  status: 'success' | 'partial' | 'failed';
  extracted: ExtractedLease;
  cached?: boolean;
  reason?: string;
};

type AddressState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'success'; data: LookupResponse }
  | { phase: 'error'; message: string };

type LeaseState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'success'; data: ExtractResponse }
  | { phase: 'error'; message: string };

export default function ReviewPropertyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const placeId = searchParams.get('placeId');
  const eircode = searchParams.get('eircode');
  const leaseDocumentId = searchParams.get('leaseDocumentId');

  const [addressState, setAddressState] = useState<AddressState>({ phase: 'idle' });
  const [leaseState, setLeaseState] = useState<LeaseState>({ phase: 'idle' });
  const [debugOpen, setDebugOpen] = useState(true);

  // Address path
  useEffect(() => {
    if (leaseDocumentId) return;
    if (!placeId && !eircode) return;

    let cancelled = false;
    setAddressState({ phase: 'loading' });
    (async () => {
      try {
        const res = await fetch('/api/lettings/property-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(placeId ? { placeId } : { eircode }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          if (cancelled) return;
          setAddressState({
            phase: 'error',
            message: errBody?.error || `Lookup failed (${res.status})`,
          });
          return;
        }
        const data = (await res.json()) as LookupResponse;
        if (cancelled) return;
        setAddressState({ phase: 'success', data });
      } catch (err) {
        if (cancelled) return;
        setAddressState({
          phase: 'error',
          message: err instanceof Error ? err.message : 'Network error',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [placeId, eircode, leaseDocumentId]);

  // Lease path
  useEffect(() => {
    if (!leaseDocumentId) return;

    let cancelled = false;
    setLeaseState({ phase: 'loading' });
    (async () => {
      try {
        const res = await fetch('/api/lettings/extract-lease', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: leaseDocumentId }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          if (cancelled) return;
          setLeaseState({
            phase: 'error',
            message: errBody?.error || `Extraction failed (${res.status})`,
          });
          return;
        }
        const data = (await res.json()) as ExtractResponse;
        if (cancelled) return;
        setLeaseState({ phase: 'success', data });
      } catch (err) {
        if (cancelled) return;
        setLeaseState({
          phase: 'error',
          message: err instanceof Error ? err.message : 'Network error',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leaseDocumentId]);

  const addressStatus: RowStatus = useMemo(() => {
    if (addressState.phase === 'idle' || addressState.phase === 'loading') return 'pending';
    if (addressState.phase === 'error') return 'fail';
    return addressState.data.address.line1 || addressState.data.address.eircode ? 'ok' : 'fail';
  }, [addressState]);

  const berStatus: RowStatus = useMemo(() => {
    if (addressState.phase === 'idle' || addressState.phase === 'loading') return 'pending';
    if (addressState.phase === 'error') return 'skipped';
    return addressState.data.ber?.rating ? 'ok' : 'soft-miss';
  }, [addressState]);

  const pprStatus: RowStatus =
    addressState.phase === 'loading' || addressState.phase === 'idle'
      ? 'pending'
      : 'skipped';

  // Lease row statuses
  const leaseDocStatus: RowStatus = useMemo(() => {
    if (leaseState.phase === 'idle' || leaseState.phase === 'loading') return 'pending';
    if (leaseState.phase === 'error') return 'fail';
    return leaseState.data.status === 'failed' ? 'fail' : 'ok';
  }, [leaseState]);

  const tenantStatus: RowStatus = useMemo(() => {
    if (leaseState.phase !== 'success') return leaseDocStatus === 'fail' ? 'fail' : 'pending';
    return leaseState.data.extracted.primaryTenantName ? 'ok' : 'soft-miss';
  }, [leaseState, leaseDocStatus]);

  const rentDatesStatus: RowStatus = useMemo(() => {
    if (leaseState.phase !== 'success') return leaseDocStatus === 'fail' ? 'fail' : 'pending';
    const e = leaseState.data.extracted;
    return e.monthlyRentEur != null && e.leaseStartDate ? 'ok' : 'soft-miss';
  }, [leaseState, leaseDocStatus]);

  const rtbStatus: RowStatus = useMemo(() => {
    if (leaseState.phase !== 'success') return leaseDocStatus === 'fail' ? 'fail' : 'pending';
    return leaseState.data.extracted.rtbRegistrationNumber ? 'ok' : 'soft-miss';
  }, [leaseState, leaseDocStatus]);

  const continueEnabled = leaseDocumentId
    ? leaseState.phase === 'success' && leaseState.data.status !== 'failed'
    : addressStatus === 'ok';

  const handleContinue = () => {
    const params = new URLSearchParams();
    if (placeId) params.set('placeId', placeId);
    if (eircode) params.set('eircode', eircode);
    if (leaseDocumentId) params.set('leaseDocumentId', leaseDocumentId);
    router.push(`/agent/lettings/properties/new/save?${params.toString()}`);
  };

  return (
    <AgentShell>
      <div
        style={{
          minHeight: '100%',
          padding: '8px 20px 100px',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 0 18px',
          }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              padding: 0,
              borderRadius: 10,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              marginLeft: -8,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D0D12" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1
            style={{
              flex: 1,
              color: '#0D0D12',
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              margin: 0,
            }}
          >
            Add property
          </h1>
          <span
            style={{
              color: '#A0A8B0',
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '0.04em',
            }}
          >
            Step 2 of 3
          </span>
        </div>

        {/* LEASE PATH ─────────────────────────────────────── */}
        {leaseDocumentId ? (
          <>
            <div
              style={{
                maxWidth: 480,
                margin: '0 auto',
                padding: 16,
                background: '#fff',
                border: '0.5px solid #E5E7EB',
                borderRadius: 14,
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <p
                style={{
                  color: '#0D0D12',
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  margin: '0 0 12px',
                }}
              >
                {leaseState.phase === 'success'
                  ? 'Lease details ready'
                  : leaseState.phase === 'error'
                    ? 'Couldn’t read the lease'
                    : 'Reading your lease…'}
              </p>

              <StatusRow
                status={leaseDocStatus}
                label="Reading lease document"
                source="PDF text extraction"
                detail={
                  leaseState.phase === 'success' && leaseState.data.cached
                    ? 'Loaded previous extraction'
                    : undefined
                }
              />
              <StatusRow
                status={tenantStatus}
                label="Extracting tenant details"
                source="GPT-4o-mini"
                detail={
                  leaseState.phase === 'success'
                    ? leaseState.data.extracted.primaryTenantName
                      ? `${leaseState.data.extracted.primaryTenantName}${
                          leaseState.data.extracted.coTenantNames.length > 0
                            ? ` (+${leaseState.data.extracted.coTenantNames.length} co-tenant${leaseState.data.extracted.coTenantNames.length === 1 ? '' : 's'})`
                            : ''
                        }`
                      : 'Tenant name not found — fill in on the next screen'
                    : undefined
                }
              />
              <StatusRow
                status={rentDatesStatus}
                label="Extracting rent and dates"
                source="GPT-4o-mini"
                detail={
                  leaseState.phase === 'success'
                    ? formatRentDetail(leaseState.data.extracted)
                    : undefined
                }
              />
              <StatusRow
                status={rtbStatus}
                label="Looking for RTB number"
                source="GPT-4o-mini"
                detail={
                  leaseState.phase === 'success'
                    ? leaseState.data.extracted.rtbRegistrationNumber
                      ? leaseState.data.extracted.rtbRegistrationNumber
                      : 'Not found — register the tenancy with RTB if you haven’t already'
                    : undefined
                }
              />

              {leaseState.phase === 'error' && (
                <div
                  role="alert"
                  style={{
                    marginTop: 12,
                    padding: '10px 12px',
                    background: 'rgba(239,68,68,0.06)',
                    border: '0.5px solid rgba(239,68,68,0.25)',
                    borderRadius: 10,
                    color: '#B91C1C',
                    fontSize: 12,
                  }}
                >
                  {leaseState.message}
                </div>
              )}

              {leaseState.phase === 'success' && leaseState.data.status === 'failed' && (
                <div
                  role="alert"
                  style={{
                    marginTop: 12,
                    padding: '10px 12px',
                    background: 'rgba(239,68,68,0.06)',
                    border: '0.5px solid rgba(239,68,68,0.25)',
                    borderRadius: 10,
                    color: '#B91C1C',
                    fontSize: 12,
                  }}
                >
                  {leaseState.data.reason ?? 'Extraction failed — please try a different file or fill in manually.'}
                </div>
              )}
            </div>

            {leaseState.phase === 'success' && (
              <DebugPane
                open={debugOpen}
                onToggle={() => setDebugOpen((p) => !p)}
                label="Extracted lease data (debug)"
                json={leaseState.data.extracted}
              />
            )}
          </>
        ) : (
          /* ADDRESS PATH ───────────────────────────────── */
          <>
            <div
              style={{
                maxWidth: 480,
                margin: '0 auto',
                padding: 16,
                background: '#fff',
                border: '0.5px solid #E5E7EB',
                borderRadius: 14,
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <p
                style={{
                  color: '#0D0D12',
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  margin: '0 0 12px',
                }}
              >
                {addressState.phase === 'success'
                  ? 'Property details ready'
                  : 'Looking up property details…'}
              </p>

              <StatusRow
                status={addressStatus}
                label="Address verified"
                source={placeId ? 'Google Places' : 'Eircode'}
                detail={
                  addressState.phase === 'success'
                    ? formatAddressLine(addressState.data.address)
                    : undefined
                }
              />
              <StatusRow
                status={berStatus}
                label="BER rating"
                source="SEAI register"
                detail={
                  addressState.phase === 'success' && addressState.data.ber?.rating
                    ? `${addressState.data.ber.rating}${addressState.data.ber.expiryDate ? ` · expires ${addressState.data.ber.expiryDate}` : ''}`
                    : addressState.phase === 'success' && !addressState.data.ber?.rating
                      ? 'Not in SEAI register — you can upload the cert later'
                      : undefined
                }
              />
              <StatusRow
                status={pprStatus}
                label="Property details"
                source="Property Price Register"
                detail={
                  pprStatus === 'skipped' ? 'Not available — coming post-launch' : undefined
                }
              />

              {addressState.phase === 'error' && (
                <div
                  role="alert"
                  style={{
                    marginTop: 12,
                    padding: '10px 12px',
                    background: 'rgba(239,68,68,0.06)',
                    border: '0.5px solid rgba(239,68,68,0.25)',
                    borderRadius: 10,
                    color: '#B91C1C',
                    fontSize: 12,
                  }}
                >
                  Couldn&rsquo;t verify the address &mdash; please go back and try again.
                  <br />
                  <span style={{ opacity: 0.7 }}>{addressState.message}</span>
                </div>
              )}
            </div>

            {addressState.phase === 'success' && (
              <DebugPane
                open={debugOpen}
                onToggle={() => setDebugOpen((p) => !p)}
                label="Raw response (debug)"
                json={addressState.data}
              />
            )}
          </>
        )}

        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 'calc(76px + env(safe-area-inset-bottom))',
            padding: '12px 20px',
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <button
            type="button"
            disabled={!continueEnabled}
            onClick={handleContinue}
            style={{
              pointerEvents: 'auto',
              width: '100%',
              maxWidth: 480,
              height: 50,
              borderRadius: 12,
              border: 'none',
              background: continueEnabled
                ? 'linear-gradient(135deg, #D4AF37, #C49B2A)'
                : '#EDEDE6',
              color: continueEnabled ? '#0D0D12' : '#9CA3AF',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              cursor: continueEnabled ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              boxShadow: continueEnabled
                ? '0 1px 2px rgba(0,0,0,0.06), 0 6px 18px rgba(196,155,42,0.32)'
                : 'none',
            }}
          >
            Continue
          </button>
        </div>
      </div>

      <style>{`
        @keyframes oh-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </AgentShell>
  );
}

function StatusRow({
  status,
  label,
  source,
  detail,
}: {
  status: RowStatus;
  label: string;
  source: string;
  detail?: string;
}) {
  const muted = status === 'skipped' || status === 'soft-miss';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '10px 0',
        borderBottom: '0.5px solid rgba(0,0,0,0.04)',
        opacity: muted ? 0.85 : 1,
      }}
    >
      <span
        style={{
          flexShrink: 0,
          marginTop: 2,
          width: 20,
          height: 20,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <StatusIcon status={status} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            color: '#0D0D12',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {label}
        </span>
        <span
          style={{
            display: 'block',
            color: '#A0A8B0',
            fontSize: 12,
            marginTop: 2,
          }}
        >
          {source}
        </span>
        {detail ? (
          <span
            style={{
              display: 'block',
              color: '#0D0D12',
              fontSize: 12,
              marginTop: 4,
              lineHeight: 1.4,
            }}
          >
            {detail}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function StatusIcon({ status }: { status: RowStatus }) {
  if (status === 'pending') {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#A0A8B0"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ animation: 'oh-spin 900ms linear infinite' }}
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    );
  }
  if (status === 'ok') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (status === 'fail') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    );
  }
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: '#D8D8D2',
        display: 'inline-block',
      }}
    />
  );
}

function DebugPane({
  open,
  onToggle,
  label,
  json,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  json: unknown;
}) {
  return (
    <div
      style={{
        maxWidth: 480,
        margin: '16px auto 0',
        background: '#fff',
        border: '0.5px solid #E5E7EB',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '12px 16px',
          background: '#F8F8F4',
          border: 'none',
          borderBottom: open ? '0.5px solid rgba(0,0,0,0.04)' : 'none',
          color: '#6B7280',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'inherit',
        }}
      >
        {label}
        <span style={{ fontSize: 12 }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <pre
          style={{
            margin: 0,
            padding: 14,
            fontSize: 12,
            lineHeight: 1.5,
            fontFamily: '"SF Mono", Menlo, Monaco, monospace',
            color: '#0D0D12',
            background: '#fff',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {JSON.stringify(json, null, 2)}
        </pre>
      )}
    </div>
  );
}

function formatAddressLine(address: LookupResponse['address']): string {
  if (address.formattedAddress) return address.formattedAddress;
  return [address.line1, address.town, address.county, address.eircode]
    .filter(Boolean)
    .join(', ');
}

function formatRentDetail(extracted: ExtractedLease): string {
  const parts: string[] = [];
  if (extracted.monthlyRentEur != null) {
    parts.push(`€${extracted.monthlyRentEur.toLocaleString()}/month`);
  }
  if (extracted.leaseStartDate) {
    parts.push(`from ${extracted.leaseStartDate}`);
  }
  if (extracted.leaseEndDate) {
    parts.push(`to ${extracted.leaseEndDate}`);
  }
  if (parts.length === 0) return 'Rent or dates not found — fill in on the next screen';
  return parts.join(' · ');
}
