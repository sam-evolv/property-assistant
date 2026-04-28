'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import AgentShell from '../../../_components/AgentShell';
import { uploadLeasePdf } from '@/lib/agent/lettings/leasePdfHandoff';

// Minimal shape of the bits of the Google Places JS API we touch. We don't
// take a dep on @types/google.maps just for two interfaces.
type PlacePrediction = {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
};

type PlacesService = {
  getPlacePredictions: (
    request: {
      input: string;
      componentRestrictions?: { country: string };
      types?: string[];
    },
    callback: (predictions: PlacePrediction[] | null, status: string) => void,
  ) => void;
};

type GoogleMapsGlobal = {
  maps?: {
    places?: {
      AutocompleteService: new () => PlacesService;
      PlacesServiceStatus: { OK: string };
    };
  };
};

declare global {
  interface Window {
    google?: GoogleMapsGlobal;
  }
}

const EIRCODE_REGEX = /^[A-Z][0-9]{2}\s?[A-Z0-9]{4}$/i;
const MAX_LEASE_BYTES = 10 * 1024 * 1024;

function normaliseEircode(input: string): string | null {
  const compact = input.trim().toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z][0-9]{2}[A-Z0-9]{4}$/.test(compact)) return null;
  return `${compact.slice(0, 3)} ${compact.slice(3)}`;
}

export default function AddPropertyPage() {
  const router = useRouter();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const hasApiKey = apiKey.length > 0;

  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [placesReady, setPlacesReady] = useState(false);
  const [leaseError, setLeaseError] = useState<string | null>(null);
  const [leaseUploading, setLeaseUploading] = useState(false);
  const [dropActive, setDropActive] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const serviceRef = useRef<PlacesService | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmedQuery = query.trim();
  const eircodeMatch = useMemo(() => {
    if (!EIRCODE_REGEX.test(trimmedQuery)) return null;
    return normaliseEircode(trimmedQuery);
  }, [trimmedQuery]);

  const initService = useCallback(() => {
    if (serviceRef.current) {
      setPlacesReady(true);
      return;
    }
    const places = window.google?.maps?.places;
    if (!places) return;
    try {
      serviceRef.current = new places.AutocompleteService();
      setPlacesReady(true);
    } catch (err) {
      console.error('[lettings/new] failed to init Places service', err);
    }
  }, []);

  // If the script was already loaded by a previous navigation, the onLoad on
  // <Script> won't fire again. Probe for window.google on mount.
  useEffect(() => {
    if (hasApiKey) initService();
  }, [hasApiKey, initService]);

  // Debounced predictions fetch. Eircode entries skip Places entirely.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!hasApiKey || !placesReady || !serviceRef.current) {
      setPredictions([]);
      return;
    }
    if (eircodeMatch) {
      setPredictions([]);
      return;
    }
    if (trimmedQuery.length < 3) {
      setPredictions([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const service = serviceRef.current;
      if (!service) return;
      service.getPlacePredictions(
        {
          input: trimmedQuery,
          componentRestrictions: { country: 'ie' },
          types: ['address'],
        },
        (results, status) => {
          const okStatus = window.google?.maps?.places?.PlacesServiceStatus.OK;
          if (status === okStatus && results) {
            setPredictions(results);
          } else {
            setPredictions([]);
          }
        },
      );
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [trimmedQuery, eircodeMatch, hasApiKey, placesReady]);

  const handleSelectPlace = useCallback(
    (placeId: string) => {
      router.push(`/agent/lettings/properties/new/review?placeId=${encodeURIComponent(placeId)}`);
    },
    [router],
  );

  const handleSelectEircode = useCallback(
    (eircode: string) => {
      router.push(`/agent/lettings/properties/new/review?eircode=${encodeURIComponent(eircode)}`);
    },
    [router],
  );

  const handleLeaseFile = useCallback(
    async (file: File | null) => {
      setLeaseError(null);
      if (!file) return;
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setLeaseError('That file isn’t a PDF. Drop a PDF lease.');
        return;
      }
      if (file.size > MAX_LEASE_BYTES) {
        setLeaseError('PDF is over 10MB. Try a smaller file.');
        return;
      }
      setLeaseUploading(true);
      try {
        const { documentId } = await uploadLeasePdf(file);
        router.push(
          `/agent/lettings/properties/new/review?leaseDocumentId=${encodeURIComponent(documentId)}`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setLeaseError(message);
        setLeaseUploading(false);
      }
    },
    [router],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDropActive(false);
      const file = e.dataTransfer.files?.[0] ?? null;
      handleLeaseFile(file);
    },
    [handleLeaseFile],
  );

  return (
    <AgentShell>
      {hasApiKey && (
        <Script
          id="google-maps-places"
          src={`https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`}
          strategy="afterInteractive"
          onLoad={initService}
        />
      )}

      <div
        style={{
          minHeight: '100%',
          padding: '8px 20px 80px',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* Top bar: back arrow + title */}
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
            Add property
          </h1>
        </div>

        {/* Address card */}
        <div style={{ marginTop: 16 }}>
          <h2
            style={{
              color: '#0D0D12',
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              margin: '0 0 4px',
            }}
          >
            What&rsquo;s the address?
          </h2>
          <p
            style={{
              color: '#A0A8B0',
              fontSize: 13,
              margin: '0 0 18px',
            }}
          >
            Start typing an address or paste an Eircode. We&rsquo;ll fill in the rest.
          </p>

          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. 14 Longview Park, Cork or T12 X4F2"
              style={{
                width: '100%',
                height: 56,
                padding: '0 16px',
                background: '#fff',
                border: '0.5px solid #E5E7EB',
                borderRadius: 14,
                fontSize: 15,
                fontFamily: 'inherit',
                color: '#0D0D12',
                outline: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(212,175,55,0.55)';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(212,175,55,0.18)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#E5E7EB';
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)';
              }}
            />

            {/* Eircode shortcut row — wins over Places when input matches */}
            {eircodeMatch && (
              <SuggestionList>
                <SuggestionRow
                  onClick={() => handleSelectEircode(eircodeMatch)}
                  icon={<EircodeKeyIcon />}
                  primary={`Use Eircode: ${eircodeMatch}`}
                  secondary="Skip address search — Eircode is unique"
                />
              </SuggestionList>
            )}

            {/* Places predictions */}
            {!eircodeMatch && predictions.length > 0 && (
              <SuggestionList>
                {predictions.map((p) => (
                  <SuggestionRow
                    key={p.place_id}
                    onClick={() => handleSelectPlace(p.place_id)}
                    icon={<PinIcon />}
                    primary={p.structured_formatting?.main_text ?? p.description}
                    secondary={p.structured_formatting?.secondary_text ?? ''}
                  />
                ))}
              </SuggestionList>
            )}

            {/* Graceful degradation when no API key */}
            {!eircodeMatch && !hasApiKey && trimmedQuery.length >= 3 && (
              <div
                style={{
                  marginTop: 8,
                  padding: '12px 14px',
                  background: '#FFF8E5',
                  border: '0.5px solid rgba(212,175,55,0.35)',
                  borderRadius: 10,
                  color: '#8A6A00',
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                Address autocomplete unavailable &mdash; type the full address manually,
                or paste an Eircode for an instant match.
              </div>
            )}
          </div>
        </div>

        {/* Lease PDF drop card */}
        <div style={{ marginTop: 24 }}>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDropActive(true);
            }}
            onDragLeave={() => setDropActive(false)}
            onDrop={onDrop}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: 24,
              borderRadius: 14,
              border: dropActive
                ? '1.5px dashed rgba(212,175,55,0.55)'
                : '1.5px dashed #E5E7EB',
              background: dropActive ? 'rgba(212,175,55,0.04)' : '#fff',
              transition: 'background 120ms ease, border-color 120ms ease',
              textAlign: 'center',
            }}
          >
            {leaseUploading ? <UploadSpinner /> : <FileUpIcon />}
            <p
              style={{
                color: '#0D0D12',
                fontSize: 15,
                fontWeight: 500,
                margin: '4px 0 2px',
              }}
            >
              {leaseUploading ? 'Uploading lease…' : 'Got the lease handy?'}
            </p>
            <p
              style={{
                color: '#A0A8B0',
                fontSize: 13,
                margin: 0,
                maxWidth: 280,
                lineHeight: 1.45,
              }}
            >
              {leaseUploading
                ? 'Holding tight — extraction starts on the next screen.'
                : 'Drop the PDF and we’ll fill in the tenant, rent, and dates for you.'}
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(e) => handleLeaseFile(e.target.files?.[0] ?? null)}
              disabled={leaseUploading}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={leaseUploading}
              style={{
                marginTop: 10,
                padding: '8px 16px',
                borderRadius: 10,
                background: leaseUploading ? '#F5F5F3' : '#fff',
                border: '0.5px solid #D8D8D2',
                color: leaseUploading ? '#9CA3AF' : '#0D0D12',
                fontSize: 13,
                fontWeight: 500,
                cursor: leaseUploading ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              {leaseUploading ? 'Uploading…' : 'Choose file'}
            </button>

            {leaseError && (
              <p
                role="alert"
                style={{
                  marginTop: 8,
                  color: '#B91C1C',
                  fontSize: 12,
                  margin: '8px 0 0',
                }}
              >
                {leaseError}
              </p>
            )}
          </div>
        </div>

        {/* Spreadsheet import link */}
        <div style={{ marginTop: 22, textAlign: 'center' }}>
          <Link
            href="/agent/lettings/properties/import"
            style={{
              color: '#A0A8B0',
              fontSize: 13,
              textDecoration: 'none',
              borderBottom: '1px solid transparent',
            }}
          >
            Import multiple from a spreadsheet
          </Link>
        </div>
      </div>
    </AgentShell>
  );
}

function SuggestionList({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 8,
        background: '#fff',
        border: '0.5px solid #E5E7EB',
        borderRadius: 12,
        boxShadow: '0 6px 20px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

function SuggestionRow({
  icon,
  primary,
  secondary,
  onClick,
}: {
  icon: React.ReactNode;
  primary: string;
  secondary?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '12px 14px',
        background: '#fff',
        border: 'none',
        borderBottom: '0.5px solid rgba(0,0,0,0.04)',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: 9,
          background: '#F5F5F3',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            color: '#0D0D12',
            fontSize: 14,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {primary}
        </span>
        {secondary ? (
          <span
            style={{
              display: 'block',
              color: '#A0A8B0',
              fontSize: 12,
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {secondary}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function EircodeKeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C49B2A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21 2-9.6 9.6" />
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-2 2" />
      <path d="m18 5 3 3" />
      <path d="m15 8 3 3" />
    </svg>
  );
}

function FileUpIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#A0A8B0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M12 12v6" />
      <path d="m9 15 3-3 3 3" />
    </svg>
  );
}

function UploadSpinner() {
  return (
    <>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#C49B2A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ animation: 'oh-upload-spin 900ms linear infinite' }}
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <style>{`
        @keyframes oh-upload-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
