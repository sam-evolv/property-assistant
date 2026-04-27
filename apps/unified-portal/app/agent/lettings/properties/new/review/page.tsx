'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AgentShell from '../../../../_components/AgentShell';
import {
  getPendingLease,
  getPendingLeaseMeta,
  type LeaseMeta,
} from '@/lib/agent/lettings/leasePdfHandoff';

/**
 * Review screen — Session 6 build.
 *
 * Status-panel + raw JSON pane while the lookup orchestrator runs. Session 8
 * replaces this with the full review form. Session 7 wires real lease-PDF
 * extraction (right now lease-PDF input just shows the filename).
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

type LookupState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'success'; data: LookupResponse }
  | { phase: 'error'; message: string };

export default function ReviewPropertyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const placeId = searchParams.get('placeId');
  const eircode = searchParams.get('eircode');
  const leasePdfTempId = searchParams.get('leasePdf');

  const [state, setState] = useState<LookupState>({ phase: 'idle' });
  const [debugOpen, setDebugOpen] = useState(true);
  const [leaseMeta, setLeaseMeta] = useState<LeaseMeta | null>(null);
  const [leaseFilePresent, setLeaseFilePresent] = useState(false);

  // Lease PDF path — show metadata only; extraction is Session 7.
  useEffect(() => {
    if (!leasePdfTempId) return;
    setLeaseMeta(getPendingLeaseMeta(leasePdfTempId));
    setLeaseFilePresent(getPendingLease(leasePdfTempId) !== null);
  }, [leasePdfTempId]);

  // Address path — kick the orchestrator on mount.
  useEffect(() => {
    if (leasePdfTempId) return;
    if (!placeId && !eircode) return;

    let cancelled = false;
    setState({ phase: 'loading' });
    (async () => {
      try {
        const res = await fetch('/api/lettings/property-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            placeId ? { placeId } : { eircode },
          ),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          if (cancelled) return;
          setState({
            phase: 'error',
            message: errBody?.error || `Lookup failed (${res.status})`,
          });
          return;
        }
        const data = (await res.json()) as LookupResponse;
        if (cancelled) return;
        setState({ phase: 'success', data });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Network error';
        setState({ phase: 'error', message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [placeId, eircode, leasePdfTempId]);

  const addressStatus: RowStatus = useMemo(() => {
    if (state.phase === 'idle') return 'pending';
    if (state.phase === 'loading') return 'pending';
    if (state.phase === 'error') return 'fail';
    return state.data.address.line1 || state.data.address.eircode ? 'ok' : 'fail';
  }, [state]);

  const berStatus: RowStatus = useMemo(() => {
    if (state.phase === 'idle' || state.phase === 'loading') return 'pending';
    if (state.phase === 'error') return 'skipped';
    return state.data.ber?.rating ? 'ok' : 'soft-miss';
  }, [state]);

  // PPR is permanently out of scope for v1.0 — render as a soft "skipped" row
  // so the user understands we know it's not available, not that it failed.
  const pprStatus: RowStatus = state.phase === 'loading' || state.phase === 'idle'
    ? 'pending'
    : 'skipped';

  const continueEnabled = leasePdfTempId
    ? leaseFilePresent
    : addressStatus === 'ok';

  const handleContinue = () => {
    const params = new URLSearchParams();
    if (placeId) params.set('placeId', placeId);
    if (eircode) params.set('eircode', eircode);
    if (leasePdfTempId) params.set('leasePdf', leasePdfTempId);
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
        {/* Top bar */}
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

        {/* Lease PDF path — Session 7 will replace this */}
        {leasePdfTempId ? (
          <div
            style={{
              maxWidth: 480,
              margin: '24px auto 0',
              padding: 20,
              background: '#fff',
              border: '0.5px solid #E5E7EB',
              borderRadius: 14,
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <p
              style={{
                color: '#9EA8B5',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                margin: '0 0 8px',
              }}
            >
              Lease PDF detected
            </p>
            <p
              style={{
                color: '#0D0D12',
                fontSize: 15,
                fontWeight: 500,
                margin: '0 0 4px',
              }}
            >
              {leaseMeta?.name ?? 'Unknown file'}
            </p>
            <p
              style={{ color: '#A0A8B0', fontSize: 13, margin: '0 0 16px' }}
            >
              {leaseMeta ? `${(leaseMeta.size / 1024).toFixed(0)} KB` : ''}
              {leaseMeta && leaseFilePresent ? ' · ready to extract' : ''}
              {leaseMeta && !leaseFilePresent ? ' · file buffer lost — please re-drop on previous screen' : ''}
            </p>
            <p
              style={{
                color: '#6B7280',
                fontSize: 13,
                lineHeight: 1.5,
                margin: 0,
                padding: '12px',
                background: '#F8F8F4',
                border: '0.5px solid rgba(0,0,0,0.04)',
                borderRadius: 10,
              }}
            >
              Extraction coming in Session 7. For now this screen confirms the
              PDF made it through the handoff.
            </p>
          </div>
        ) : (
          <>
            {/* Status panel */}
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
                {state.phase === 'success'
                  ? 'Property details ready'
                  : 'Looking up property details…'}
              </p>

              <StatusRow
                status={addressStatus}
                label="Address verified"
                source={
                  placeId
                    ? 'Google Places'
                    : 'Eircode'
                }
                detail={
                  state.phase === 'success'
                    ? formatAddressLine(state.data.address)
                    : undefined
                }
              />
              <StatusRow
                status={berStatus}
                label="BER rating"
                source="SEAI register"
                detail={
                  state.phase === 'success' && state.data.ber?.rating
                    ? `${state.data.ber.rating}${state.data.ber.expiryDate ? ` · expires ${state.data.ber.expiryDate}` : ''}`
                    : state.phase === 'success' && !state.data.ber?.rating
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

              {state.phase === 'error' && (
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
                  Couldn&rsquo;t verify the address — please go back and try again.
                  <br />
                  <span style={{ opacity: 0.7 }}>{state.message}</span>
                </div>
              )}
            </div>

            {/* Raw JSON debug pane — gone in Session 8 */}
            {state.phase === 'success' && (
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
                  onClick={() => setDebugOpen((p) => !p)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#F8F8F4',
                    border: 'none',
                    borderBottom: debugOpen ? '0.5px solid rgba(0,0,0,0.04)' : 'none',
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
                  Raw response (debug)
                  <span style={{ fontSize: 12 }}>{debugOpen ? '▾' : '▸'}</span>
                </button>
                {debugOpen && (
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
                    {JSON.stringify(state.data, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </>
        )}

        {/* Continue button */}
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
  // soft-miss & skipped share a soft grey dot — both mean "no data, no error".
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

function formatAddressLine(address: LookupResponse['address']): string {
  if (address.formattedAddress) return address.formattedAddress;
  return [address.line1, address.town, address.county, address.eircode]
    .filter(Boolean)
    .join(', ');
}
