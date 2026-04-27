'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AgentShell from '../../../../_components/AgentShell';

/**
 * Review screen — Session 8a layout skeleton.
 *
 * Wholesale rebuild of the Session 7 debug-pane review. This chunk lays in
 * the page structure: top bar, address card, status segmented control,
 * empty section containers, and a stub save button. 8b populates the
 * Property + Tenancy sections with real fields. 8c wires up persistence,
 * the completeness ring and source icons.
 *
 * Data flow:
 *   - URL params (placeId | eircode | leaseDocumentId) drive two parallel
 *     fetches on mount: /api/lettings/property-lookup and
 *     /api/lettings/extract-lease. Results are held in lookupData and
 *     extractionData. 8b reads them to seed the form.
 *
 * UI status → DB column mapping (used by the 8c save handler — the
 * segmented control here only stores the UI value):
 *   Vacant     → agent_letting_properties.status = 'vacant'
 *   Tenanted   → agent_letting_properties.status = 'let'
 *   Off-market → agent_letting_properties.status = 'off_market'
 */

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

type StatusValue = 'vacant' | 'tenanted' | 'off_market';

type FormState = {
  status: StatusValue;
  property: {
    propertyType: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    floorAreaSqm: number | null;
    yearBuilt: number | null;
    berRating: string | null;
    berCertNumber: string | null;
    berExpiryDate: string | null;
  };
  tenancy: {
    tenantName: string | null;
    tenantEmail: string | null;
    tenantPhone: string | null;
    monthlyRentEur: number | null;
    depositAmountEur: number | null;
    rentPaymentDay: number | null;
    leaseStartDate: string | null;
    leaseEndDate: string | null;
    leaseType: string | null;
    rtbRegistrationNumber: string | null;
  };
};

const INITIAL_PROPERTY: FormState['property'] = {
  propertyType: null,
  bedrooms: null,
  bathrooms: null,
  floorAreaSqm: null,
  yearBuilt: null,
  berRating: null,
  berCertNumber: null,
  berExpiryDate: null,
};

const INITIAL_TENANCY: FormState['tenancy'] = {
  tenantName: null,
  tenantEmail: null,
  tenantPhone: null,
  monthlyRentEur: null,
  depositAmountEur: null,
  rentPaymentDay: null,
  leaseStartDate: null,
  leaseEndDate: null,
  leaseType: null,
  rtbRegistrationNumber: null,
};

export default function ReviewPropertyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const placeId = searchParams.get('placeId');
  const eircode = searchParams.get('eircode');
  const leaseDocumentId = searchParams.get('leaseDocumentId');

  const [lookupData, setLookupData] = useState<LookupResponse | null>(null);
  const [extractionData, setExtractionData] = useState<ExtractResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(
    Boolean(placeId || eircode || leaseDocumentId),
  );
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(() => ({
    status: leaseDocumentId ? 'tenanted' : 'vacant',
    property: { ...INITIAL_PROPERTY },
    tenancy: { ...INITIAL_TENANCY },
  }));

  // Parallel data fetch on mount. Either, both or neither call may run
  // depending on what the previous screen handed us in the URL.
  useEffect(() => {
    const haveAddress = Boolean(placeId || eircode);
    const haveLease = Boolean(leaseDocumentId);
    if (!haveAddress && !haveLease) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const lookupCall: Promise<LookupResponse | null> = haveAddress
      ? fetch('/api/lettings/property-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(placeId ? { placeId } : { eircode }),
        }).then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.error || `Address lookup failed (${res.status})`);
          }
          return (await res.json()) as LookupResponse;
        })
      : Promise.resolve(null);

    const extractCall: Promise<ExtractResponse | null> = haveLease
      ? fetch('/api/lettings/extract-lease', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: leaseDocumentId }),
        }).then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.error || `Lease extraction failed (${res.status})`);
          }
          return (await res.json()) as ExtractResponse;
        })
      : Promise.resolve(null);

    Promise.allSettled([lookupCall, extractCall]).then((results) => {
      if (cancelled) return;
      const [lookupRes, extractRes] = results;
      const messages: string[] = [];

      if (lookupRes.status === 'fulfilled') {
        setLookupData(lookupRes.value);
      } else if (haveAddress) {
        messages.push(
          lookupRes.reason instanceof Error
            ? lookupRes.reason.message
            : 'Address lookup failed',
        );
      }

      if (extractRes.status === 'fulfilled') {
        setExtractionData(extractRes.value);
      } else if (haveLease) {
        messages.push(
          extractRes.reason instanceof Error
            ? extractRes.reason.message
            : 'Lease extraction failed',
        );
      }

      setError(messages.length > 0 ? messages.join(' · ') : null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [placeId, eircode, leaseDocumentId]);

  // Seed the form from API responses. Only writes into fields that are
  // still null — once 8b/8c add real inputs, user edits won't get clobbered
  // by a re-render with the same data.
  useEffect(() => {
    if (!lookupData && !extractionData) return;
    setForm((prev) => {
      const next: FormState = {
        ...prev,
        property: { ...prev.property },
        tenancy: { ...prev.tenancy },
      };
      if (lookupData?.ber) {
        // SEAI returns rating as upper-case ("A1"); storage values are
        // lower-case ("a1") so the <select> option matches.
        if (next.property.berRating == null) {
          next.property.berRating = lookupData.ber.rating ? lookupData.ber.rating.toLowerCase() : null;
        }
        if (next.property.berCertNumber == null) next.property.berCertNumber = lookupData.ber.certNumber;
        if (next.property.berExpiryDate == null) next.property.berExpiryDate = lookupData.ber.expiryDate;
      }
      const ex = extractionData?.extracted;
      if (ex) {
        if (next.tenancy.tenantName == null) next.tenancy.tenantName = ex.primaryTenantName;
        if (next.tenancy.monthlyRentEur == null) next.tenancy.monthlyRentEur = ex.monthlyRentEur;
        if (next.tenancy.depositAmountEur == null) next.tenancy.depositAmountEur = ex.depositAmountEur;
        if (next.tenancy.rentPaymentDay == null) next.tenancy.rentPaymentDay = ex.rentPaymentDay;
        if (next.tenancy.leaseStartDate == null) next.tenancy.leaseStartDate = ex.leaseStartDate;
        if (next.tenancy.leaseEndDate == null) next.tenancy.leaseEndDate = ex.leaseEndDate;
        if (next.tenancy.leaseType == null) next.tenancy.leaseType = ex.leaseType;
        if (next.tenancy.rtbRegistrationNumber == null) {
          next.tenancy.rtbRegistrationNumber = ex.rtbRegistrationNumber;
        }
      }
      return next;
    });
  }, [lookupData, extractionData]);

  const addressLine = useMemo(() => {
    if (loading) return null;
    if (lookupData?.address) {
      const a = lookupData.address;
      return (
        a.formattedAddress ||
        [a.line1, a.town, a.county, a.eircode].filter(Boolean).join(', ')
      );
    }
    if (eircode && !lookupData) {
      // Lookup failed but we have the eircode the user typed.
      return eircode;
    }
    return null;
  }, [loading, lookupData, eircode]);

  const sourcesLabel = useMemo(() => {
    if (loading) return null;
    const parts: string[] = [];
    if (lookupData) {
      const sources = new Set<string>();
      for (const p of lookupData.provenance) {
        if (p.source === 'google_places') sources.add('Google Places');
        else if (p.source === 'eircode') sources.add('Eircode');
        else if (p.source === 'seai_register') sources.add('SEAI register');
      }
      if (sources.size > 0) parts.push(Array.from(sources).join(' + '));
    }
    if (extractionData) {
      parts.push('the lease document');
    }
    if (parts.length === 0) return null;
    return `From ${parts.join(' + ')}`;
  }, [loading, lookupData, extractionData]);

  const addressFailed =
    !loading && Boolean(placeId || eircode) && !lookupData && !addressLine;

  const tenancyVisible = form.status === 'tenanted' || form.status === 'off_market';

  const updateProperty = (patch: Partial<FormState['property']>) =>
    setForm((prev) => ({ ...prev, property: { ...prev.property, ...patch } }));

  const handleSave = () => {
    console.log('[review/8a] Save tapped — current form state:', form);
    if (typeof window !== 'undefined') {
      window.alert('Save handler coming in part 3 of this session');
    }
  };

  return (
    <AgentShell>
      <div
        style={{
          minHeight: '100%',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          background: '#FAFAF8',
        }}
      >
        {/* Sticky top bar */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            height: 56,
            padding: '0 16px',
            background: '#FAFAF8',
            borderBottom: '0.5px solid rgba(0,0,0,0.06)',
          }}
        >
          <button
            type="button"
            onClick={() => router.push('/agent/lettings/properties/new')}
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
              textAlign: 'center',
              color: '#0D0D12',
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              margin: 0,
            }}
          >
            Review property
          </h1>
          <span
            style={{
              minWidth: 36,
              textAlign: 'right',
              color: '#A0A8B0',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            3 of 3
          </span>
        </div>

        {/* Scrollable content */}
        <div
          style={{
            maxWidth: 480,
            margin: '0 auto',
            padding: '24px 16px 120px',
          }}
        >
          {error && (
            <div
              role="alert"
              style={{
                marginBottom: 16,
                padding: '10px 12px',
                background: 'rgba(239,68,68,0.06)',
                border: '0.5px solid rgba(239,68,68,0.25)',
                borderRadius: 10,
                color: '#B91C1C',
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          {/* Address card (locked, read-only) */}
          <AddressCard
            loading={loading}
            failed={addressFailed}
            addressLine={addressLine}
            sourcesLabel={sourcesLabel}
            extractionPresent={Boolean(extractionData)}
          />

          {/* Status segmented control */}
          <div style={{ marginTop: 24 }}>
            <SegmentedStatus
              value={form.status}
              onChange={(next) => setForm((prev) => ({ ...prev, status: next }))}
            />
          </div>

          {/* Section: PROPERTY */}
          <SectionContainer title="PROPERTY" style={{ marginTop: 24 }}>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-[#6B7280] mb-1">
                    Property type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.property.propertyType ?? ''}
                    onChange={(e) =>
                      updateProperty({ propertyType: e.target.value === '' ? null : e.target.value })
                    }
                    className="h-10 w-full border border-[#E5E7EB] rounded-lg px-3 text-sm text-[#0D0D12] bg-white focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                  >
                    <option value="">Select…</option>
                    <option value="apartment">Apartment</option>
                    <option value="house_terraced">House (terraced)</option>
                    <option value="house_semi_detached">House (semi-detached)</option>
                    <option value="house_detached">House (detached)</option>
                    <option value="house_end_of_terrace">House (end of terrace)</option>
                    <option value="duplex">Duplex</option>
                    <option value="studio">Studio</option>
                    <option value="bungalow">Bungalow</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#6B7280] mb-1">
                    Bedrooms <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={form.property.bedrooms ?? ''}
                    onChange={(e) =>
                      updateProperty({ bedrooms: e.target.value === '' ? null : Number(e.target.value) })
                    }
                    className="h-10 w-full border border-[#E5E7EB] rounded-lg px-3 text-sm text-[#0D0D12] bg-white focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#6B7280] mb-1">
                    Bathrooms
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={form.property.bathrooms ?? ''}
                    onChange={(e) =>
                      updateProperty({ bathrooms: e.target.value === '' ? null : Number(e.target.value) })
                    }
                    className="h-10 w-full border border-[#E5E7EB] rounded-lg px-3 text-sm text-[#0D0D12] bg-white focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#6B7280] mb-1">
                    Floor area (sqm)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={form.property.floorAreaSqm ?? ''}
                    onChange={(e) =>
                      updateProperty({ floorAreaSqm: e.target.value === '' ? null : Number(e.target.value) })
                    }
                    className="h-10 w-full border border-[#E5E7EB] rounded-lg px-3 text-sm text-[#0D0D12] bg-white focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#6B7280] mb-1">
                    Year built
                  </label>
                  <input
                    type="number"
                    min={1700}
                    max={2030}
                    inputMode="numeric"
                    value={form.property.yearBuilt ?? ''}
                    onChange={(e) =>
                      updateProperty({ yearBuilt: e.target.value === '' ? null : Number(e.target.value) })
                    }
                    className="h-10 w-full border border-[#E5E7EB] rounded-lg px-3 text-sm text-[#0D0D12] bg-white focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#6B7280] mb-1">
                    BER rating
                  </label>
                  <select
                    value={form.property.berRating ?? ''}
                    onChange={(e) =>
                      updateProperty({ berRating: e.target.value === '' ? null : e.target.value })
                    }
                    className="h-10 w-full border border-[#E5E7EB] rounded-lg px-3 text-sm text-[#0D0D12] bg-white focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                  >
                    <option value="">Select…</option>
                    <option value="a1">A1</option>
                    <option value="a2">A2</option>
                    <option value="a3">A3</option>
                    <option value="b1">B1</option>
                    <option value="b2">B2</option>
                    <option value="b3">B3</option>
                    <option value="c1">C1</option>
                    <option value="c2">C2</option>
                    <option value="c3">C3</option>
                    <option value="d1">D1</option>
                    <option value="d2">D2</option>
                    <option value="e1">E1</option>
                    <option value="e2">E2</option>
                    <option value="f">F</option>
                    <option value="g">G</option>
                    <option value="exempt">Exempt</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#6B7280] mb-1">
                    BER cert number
                  </label>
                  <input
                    type="text"
                    value={form.property.berCertNumber ?? ''}
                    onChange={(e) =>
                      updateProperty({ berCertNumber: e.target.value === '' ? null : e.target.value })
                    }
                    className="h-10 w-full border border-[#E5E7EB] rounded-lg px-3 text-sm text-[#0D0D12] bg-white focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#6B7280] mb-1">
                    BER expiry
                  </label>
                  <input
                    type="date"
                    value={form.property.berExpiryDate ?? ''}
                    onChange={(e) =>
                      updateProperty({ berExpiryDate: e.target.value === '' ? null : e.target.value })
                    }
                    className="h-10 w-full border border-[#E5E7EB] rounded-lg px-3 text-sm text-[#0D0D12] bg-white focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                  />
                </div>
              </div>
            )}
          </SectionContainer>

          {/* Section: TENANCY (conditional on status) */}
          {tenancyVisible && (
            <SectionContainer title="TENANCY" style={{ marginTop: 24 }}>
              <SectionPlaceholder />
            </SectionContainer>
          )}

          {/* Section: COMPLIANCE */}
          <SectionContainer title="COMPLIANCE" style={{ marginTop: 24 }}>
            <SectionPlaceholder />
          </SectionContainer>

          {/* Section: DOCUMENTS */}
          <SectionContainer title="DOCUMENTS" style={{ marginTop: 24 }}>
            <SectionPlaceholder />
          </SectionContainer>
        </div>

        {/* Sticky save footer.
            Sits flush with the top of AgentShell's BottomNav (76px tall) so
            the bottom nav remains visible below it — see report. */}
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 'calc(76px + env(safe-area-inset-bottom))',
            zIndex: 60,
            padding: 16,
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: '0.5px solid rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            <button
              type="button"
              onClick={handleSave}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 8,
                border: 'none',
                background: '#D4AF37',
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 6px 18px rgba(196,155,42,0.32)',
              }}
            >
              Save property
            </button>
          </div>
        </div>
      </div>
    </AgentShell>
  );
}

function AddressCard({
  loading,
  failed,
  addressLine,
  sourcesLabel,
  extractionPresent,
}: {
  loading: boolean;
  failed: boolean;
  addressLine: string | null;
  sourcesLabel: string | null;
  extractionPresent: boolean;
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: '0.5px solid #E5E7EB',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 2 }}>
        <MapPinIcon />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {loading ? (
          <>
            <div className="h-5 bg-gray-100 animate-pulse rounded w-3/4" />
            <div className="h-3 bg-gray-100 animate-pulse rounded w-1/2" style={{ marginTop: 8 }} />
          </>
        ) : failed ? (
          <>
            <p style={{ margin: 0, color: '#EF4444', fontSize: 16, fontWeight: 600 }}>
              Address could not be verified
            </p>
            <p style={{ margin: '4px 0 0', color: '#A0A8B0', fontSize: 12 }}>
              Go back and try again
            </p>
          </>
        ) : (
          <>
            <p
              style={{
                margin: 0,
                color: '#0D0D12',
                fontSize: 16,
                fontWeight: 600,
                lineHeight: 1.35,
              }}
            >
              {addressLine ?? (extractionPresent ? 'Address from lease' : 'No address provided')}
            </p>
            {sourcesLabel && (
              <p style={{ margin: '4px 0 0', color: '#A0A8B0', fontSize: 12 }}>
                {sourcesLabel}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SegmentedStatus({
  value,
  onChange,
}: {
  value: StatusValue;
  onChange: (next: StatusValue) => void;
}) {
  const options: { value: StatusValue; label: string }[] = [
    { value: 'vacant', label: 'Vacant' },
    { value: 'tenanted', label: 'Tenanted' },
    { value: 'off_market', label: 'Off-market' },
  ];
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        width: '100%',
        background: '#F3F4F6',
        borderRadius: 8,
        padding: 4,
        gap: 0,
      }}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={selected}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1,
              height: 36,
              borderRadius: 6,
              border: 'none',
              background: selected ? '#FFFFFF' : 'transparent',
              color: selected ? '#0D0D12' : '#6B7280',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: selected ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              transition: 'background 120ms ease, color 120ms ease',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function SectionContainer({
  title,
  children,
  style,
}: {
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section
      style={{
        background: '#fff',
        border: '0.5px solid #E5E7EB',
        borderRadius: 12,
        padding: 16,
        ...style,
      }}
    >
      <h2
        style={{
          margin: '0 0 12px',
          color: '#9EA8B5',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function SectionPlaceholder() {
  return (
    <p style={{ margin: 0, color: '#A0A8B0', fontSize: 13, lineHeight: 1.5 }}>
      Form fields coming in part 2 of this session
    </p>
  );
}

function MapPinIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#D4AF37"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
