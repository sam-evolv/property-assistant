'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AgentShell from '../../../../_components/AgentShell';
import {
  getPendingLease,
  getPendingLeaseMeta,
  type LeaseMeta,
} from '@/lib/agent/lettings/leasePdfHandoff';

/**
 * Review screen — STUB. Session 5 only verifies the entry-screen redirect
 * contract. Sessions 6 (lookups), 7 (lease extraction), and 8 (full review
 * form + save) replace this wholesale.
 */
export default function ReviewPropertyStubPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const placeId = searchParams.get('placeId');
  const eircode = searchParams.get('eircode');
  const leasePdfTempId = searchParams.get('leasePdf');

  const [leaseMeta, setLeaseMeta] = useState<LeaseMeta | null>(null);
  const [leaseFilePresent, setLeaseFilePresent] = useState(false);

  useEffect(() => {
    if (!leasePdfTempId) return;
    setLeaseMeta(getPendingLeaseMeta(leasePdfTempId));
    setLeaseFilePresent(getPendingLease(leasePdfTempId) !== null);
  }, [leasePdfTempId]);

  const inputType = placeId
    ? 'place'
    : eircode
      ? 'eircode'
      : leasePdfTempId
        ? 'leasePdf'
        : 'none';

  return (
    <AgentShell>
      <div
        style={{
          minHeight: '100%',
          padding: '8px 20px 80px',
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
              color: '#0D0D12',
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              margin: 0,
            }}
          >
            Review property
          </h1>
        </div>

        <div
          style={{
            marginTop: 16,
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
            Coming soon
          </p>
          <p
            style={{
              color: '#0D0D12',
              fontSize: 15,
              lineHeight: 1.5,
              margin: '0 0 18px',
            }}
          >
            The review screen will load lookups + AI extraction here. For now
            this is a stub so the entry-screen redirect contract can be verified.
          </p>

          <DetectedInputBlock
            inputType={inputType}
            placeId={placeId}
            eircode={eircode}
            leasePdfTempId={leasePdfTempId}
            leaseMeta={leaseMeta}
            leaseFilePresent={leaseFilePresent}
          />
        </div>
      </div>
    </AgentShell>
  );
}

function DetectedInputBlock({
  inputType,
  placeId,
  eircode,
  leasePdfTempId,
  leaseMeta,
  leaseFilePresent,
}: {
  inputType: 'place' | 'eircode' | 'leasePdf' | 'none';
  placeId: string | null;
  eircode: string | null;
  leasePdfTempId: string | null;
  leaseMeta: LeaseMeta | null;
  leaseFilePresent: boolean;
}) {
  const baseStyle = {
    color: '#0D0D12',
    fontSize: 13,
    fontFamily: '"SF Mono", Menlo, Monaco, monospace',
    background: '#F5F5F3',
    border: '0.5px solid #E5E7EB',
    borderRadius: 10,
    padding: '10px 12px',
    margin: 0,
    overflowX: 'auto' as const,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
  };

  if (inputType === 'none') {
    return (
      <p style={{ color: '#A0A8B0', fontSize: 13, margin: 0 }}>
        No input detected. Open this screen via the &ldquo;Add property&rdquo; flow.
      </p>
    );
  }

  return (
    <>
      <p
        style={{
          color: '#6B7280',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          margin: '0 0 6px',
        }}
      >
        Detected input
      </p>
      {inputType === 'place' && (
        <pre style={baseStyle}>
{`{
  "source": "google_places",
  "placeId": "${placeId}"
}`}
        </pre>
      )}
      {inputType === 'eircode' && (
        <pre style={baseStyle}>
{`{
  "source": "eircode",
  "eircode": "${eircode}"
}`}
        </pre>
      )}
      {inputType === 'leasePdf' && (
        <pre style={baseStyle}>
{`{
  "source": "lease_pdf",
  "tempId": "${leasePdfTempId}",
  "fileMeta": ${leaseMeta ? JSON.stringify(leaseMeta, null, 2) : 'null'},
  "fileBufferPresent": ${leaseFilePresent}
}`}
        </pre>
      )}
    </>
  );
}
