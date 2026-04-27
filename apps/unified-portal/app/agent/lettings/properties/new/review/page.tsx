'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AgentShell from '../../../../_components/AgentShell';

type FieldSource = 'google_places' | 'eircode' | 'seai_register' | 'lease_pdf' | null;

// Returns the source if the current form value still matches what the API
// returned. Once the user edits a field, the icon disappears (manual override).
function getFieldSource(
  formValue: unknown,
  lookupValue: unknown,
  extractionValue: unknown,
  lookupSource: FieldSource = null,
): FieldSource {
  if (formValue === null || formValue === '' || formValue === undefined) return null;
  if (extractionValue !== null && extractionValue !== undefined && formValue === extractionValue) {
    return 'lease_pdf';
  }
  if (lookupValue !== null && lookupValue !== undefined && formValue === lookupValue) {
    return lookupSource ?? 'google_places';
  }
  return null;
}

const SOURCE_LABEL: Record<NonNullable<FieldSource>, string> = {
  google_places: 'Google Places',
  eircode: 'Eircode lookup',
  seai_register: 'SEAI register',
  lease_pdf: 'AI extracted from your lease',
};

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
  originalFilename?: string | null;
  fileSizeBytes?: number | null;
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

// Mirrors the completeness scoring from migration 052 so the ring can update
// live without a server round-trip. Server still enforces on save.
function computeCompleteness(
  state: FormState,
  lookup: LookupResponse | null,
  extraction: ExtractResponse | null,
): number {
  let score = 0;
  // Property (60). The address card is sourced from lookupData; treat
  // address_line_1 + eircode as a single +10 slot.
  if (lookup?.address?.line1) score += 10;
  if (state.property.propertyType) score += 8;
  if (state.property.bedrooms != null) score += 8;
  if (state.property.bathrooms != null) score += 4;
  if (state.property.floorAreaSqm != null) score += 5;
  if (state.property.yearBuilt != null) score += 3;
  if (state.property.berRating) score += 12;
  if (state.property.berCertNumber) score += 5;
  if (state.property.berExpiryDate) score += 5;
  // Tenancy (30). Vacant properties don't lose points for missing tenancy
  // data; off_market follows the tenanted scoring (a tenancy may still exist).
  if (state.status === 'vacant') {
    score += 30;
  } else {
    if (state.tenancy.monthlyRentEur != null) score += 6;
    if (state.tenancy.depositAmountEur != null) score += 4;
    if (state.tenancy.leaseStartDate) score += 4;
    if (state.tenancy.leaseEndDate) score += 4;
    if (state.tenancy.rtbRegistrationNumber) score += 8;
    if (state.tenancy.leaseType) score += 4;
  }
  // Documents (10). Lease PDF: +5. BER cert document upload isn't shipped
  // yet (Session 10), so treat populated cert# + expiry as equivalent to
  // "BER cert on record" for v1.0 scoring.
  if (extraction?.documentId) score += 5;
  if (state.property.berCertNumber && state.property.berExpiryDate) score += 5;
  return Math.min(100, score);
}

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
        if (next.tenancy.tenantName == null) {
          // Join primary + co-tenants with ' & ' so multi-tenant lets render
          // as a single human-readable string (e.g. "Mary Murphy & John Murphy").
          const names = [ex.primaryTenantName, ...ex.coTenantNames].filter(
            (n): n is string => typeof n === 'string' && n.length > 0,
          );
          next.tenancy.tenantName = names.length > 0 ? names.join(' & ') : null;
        }
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

  const updateTenancy = (patch: Partial<FormState['tenancy']>) =>
    setForm((prev) => ({ ...prev, tenancy: { ...prev.tenancy, ...patch } }));

  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Close any open popover on outside click. The trigger button stops
  // propagation so taps on it never reach this listener.
  useEffect(() => {
    if (!openPopover) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest('[data-popover-trigger]') || t.closest('[data-popover-content]')) return;
      setOpenPopover(null);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [openPopover]);

  // Precompute the values the auto-fill effect would have written, so the
  // strict-equality match in getFieldSource still recognises seeded data.
  // BER rating is lower-cased on seed; tenant name is primary + co-tenants
  // joined with ' & '.
  const seededBerRating = lookupData?.ber?.rating ? lookupData.ber.rating.toLowerCase() : null;
  const ex = extractionData?.extracted ?? null;
  const seededTenantName = ex
    ? [ex.primaryTenantName, ...ex.coTenantNames]
        .filter((n): n is string => typeof n === 'string' && n.length > 0)
        .join(' & ') || null
    : null;

  const completeness = computeCompleteness(form, lookupData, extractionData);

  const requiredValues: Array<unknown> = [
    form.property.propertyType,
    form.property.bedrooms,
    ...(form.status === 'tenanted'
      ? [form.tenancy.tenantName, form.tenancy.monthlyRentEur, form.tenancy.leaseStartDate]
      : []),
  ];
  const missingRequired = requiredValues.filter((v) => v == null || v === '').length;
  const saveDisabled = missingRequired > 0;
  const saveLabel =
    missingRequired > 0
      ? `${missingRequired} required field${missingRequired === 1 ? '' : 's'} missing`
      : completeness < 100
        ? `Save with ${100 - completeness}% outstanding`
        : 'Save property';

  const handleSave = async () => {
    if (saving || saveDisabled) return;
    setSaving(true);
    setError(null);

    // Reuse 8c-ii's source detection. Remap the UI 'lease_pdf' value to
    // the DB enum 'lease_pdf_extraction'.
    const sourceEntries: Array<[string, FieldSource]> = [
      ['propertyType', getFieldSource(form.property.propertyType, null, null)],
      ['bedrooms', getFieldSource(form.property.bedrooms, null, null)],
      ['berRating', getFieldSource(form.property.berRating, seededBerRating, null, 'seai_register')],
      ['berCertNumber', getFieldSource(form.property.berCertNumber, lookupData?.ber?.certNumber ?? null, null, 'seai_register')],
      ['berExpiryDate', getFieldSource(form.property.berExpiryDate, lookupData?.ber?.expiryDate ?? null, null, 'seai_register')],
      ['tenantName', getFieldSource(form.tenancy.tenantName, null, seededTenantName)],
      ['monthlyRentEur', getFieldSource(form.tenancy.monthlyRentEur, null, ex?.monthlyRentEur ?? null)],
      ['depositAmountEur', getFieldSource(form.tenancy.depositAmountEur, null, ex?.depositAmountEur ?? null)],
      ['rentPaymentDay', getFieldSource(form.tenancy.rentPaymentDay, null, ex?.rentPaymentDay ?? null)],
      ['leaseStartDate', getFieldSource(form.tenancy.leaseStartDate, null, ex?.leaseStartDate ?? null)],
      ['leaseEndDate', getFieldSource(form.tenancy.leaseEndDate, null, ex?.leaseEndDate ?? null)],
      ['leaseType', getFieldSource(form.tenancy.leaseType, null, ex?.leaseType ?? null)],
      ['rtbRegistrationNumber', getFieldSource(form.tenancy.rtbRegistrationNumber, null, ex?.rtbRegistrationNumber ?? null)],
    ];
    const provenance = sourceEntries
      .filter((e): e is [string, NonNullable<FieldSource>] => e[1] !== null)
      .map(([fieldName, src]) => ({
        fieldName,
        source: src === 'lease_pdf' ? 'lease_pdf_extraction' : src,
      }));

    const body = {
      status: form.status,
      address: lookupData?.address ?? { line1: '' },
      property: form.property,
      tenancy: form.status === 'vacant' ? null : form.tenancy,
      leaseDocumentId,
      provenance,
      completenessScore: completeness,
    };

    try {
      const res = await fetch('/api/lettings/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.propertyId) {
        const message = json?.error || `Save failed (${res.status})`;
        console.error('[review/save] failed:', message);
        setError(`Couldn't save: ${message}`);
        setSaving(false);
        return;
      }
      router.push(`/agent/lettings/properties/${json.propertyId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      console.error('[review/save] error:', message);
      setError(`Couldn't save: ${message}`);
      setSaving(false);
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
                    <SourceIcon source={getFieldSource(form.property.propertyType, null, null)} fieldName="propertyType" openPopover={openPopover} setOpenPopover={setOpenPopover} />
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
                    <SourceIcon source={getFieldSource(form.property.bedrooms, null, null)} fieldName="bedrooms" openPopover={openPopover} setOpenPopover={setOpenPopover} />
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
                    <SourceIcon source={getFieldSource(form.property.berRating, seededBerRating, null, 'seai_register')} fieldName="berRating" openPopover={openPopover} setOpenPopover={setOpenPopover} />
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
                    <SourceIcon source={getFieldSource(form.property.berCertNumber, lookupData?.ber?.certNumber ?? null, null, 'seai_register')} fieldName="berCertNumber" openPopover={openPopover} setOpenPopover={setOpenPopover} />
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
                    <SourceIcon source={getFieldSource(form.property.berExpiryDate, lookupData?.ber?.expiryDate ?? null, null, 'seai_register')} fieldName="berExpiryDate" openPopover={openPopover} setOpenPopover={setOpenPopover} />
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
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-medium text-[#6B7280] mb-1">
                      Tenant name <span className="text-red-500">*</span>
                      <SourceIcon source={getFieldSource(form.tenancy.tenantName, null, seededTenantName)} fieldName="tenantName" openPopover={openPopover} setOpenPopover={setOpenPopover} />
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mary Murphy"
                      value={form.tenancy.tenantName ?? ''}
                      onChange={(e) =>
                        updateTenancy({ tenantName: e.target.value === '' ? null : e.target.value })
                      }
                      className="h-10 w-full border border-[#E5E7EB] rounded-lg px-3 text-sm text-[#0D0D12] bg-white focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                    />
                    <p className="text-[11px] text-[#A0A8B0] mt-1">
                      For multiple tenants, separate with &lsquo; &amp; &rsquo;
                    </p>
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#6B7280] mb-1">
                      Tenant email
                    </label>
                    <input
                      type="email"
                      value={form.tenancy.tenantEmail ?? ''}
                      onChange={(e) =>
                        updateTenancy({ tenantEmail: e.target.value === '' ? null : e.target.value })
                      }
                      className="h-10 w-full border border-[#E5E7EB] rounded-lg px-3 text-sm text-[#0D0D12] bg-white focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#6B7280] mb-1">
                      Tenant phone
                    </label>
                    <input
                      type="tel"
                      value={form.tenancy.tenantPhone ?? ''}
                      onChange={(e) =>
                        updateTenancy({ tenantPhone: e.target.value === '' ? null : e.target.value })
                      }
                      className="h-10 w-full border border-[#E5E7EB] rounded-lg px-3 text-sm text-[#0D0D12] bg-white focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#6B7280] mb-1">
                      Monthly rent <span className="text-red-500">*</span>
                      <SourceIcon source={getFieldSource(form.tenancy.monthlyRentEur, null, ex?.monthlyRentEur ?? null)} fieldName="monthlyRentEur" openPopover={openPopover} setOpenPopover={setOpenPopover} />
                    </label>
                    <div className="flex">
                      <span className="h-10 w-10 bg-gray-50 border border-r-0 border-[#E5E7EB] rounded-l-lg flex items-center justify-center text-sm text-gray-500">€</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={form.tenancy.monthlyRentEur ?? ''}
                        onChange={(e) =>
                          updateTenancy({ monthlyRentEur: e.target.value === '' ? null : Number(e.target.value) })
                        }
                        className="h-10 flex-1 min-w-0 border border-[#E5E7EB] rounded-r-lg px-3 text-sm text-[#0D0D12] bg-white focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#6B7280] mb-1">
                      Deposit amount
                      <SourceIcon source={getFieldSource(form.tenancy.depositAmountEur, null, ex?.depositAmountEur ?? null)} fieldName="depositAmountEur" openPopover={openPopover} setOpenPopover={setOpenPopover} />
                    </label>
                    <div className="flex">
                      <span className="h-10 w-10 bg-gray-50 border border-r-0 border-[#E5E7EB] rounded-l-lg flex items-center justify-center text-sm text-gray-500">€</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={form.tenancy.depositAmountEur ?? ''}
                        onChange={(e) =>
                          updateTenancy({ depositAmountEur: e.target.value === '' ? null : Number(e.target.value) })
                        }
                        className="h-10 flex-1 min-w-0 border border-[#E5E7EB] rounded-r-lg px-3 text-sm text-[#0D0D12] bg-white focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#6B7280] mb-1">
                      Rent payment day
                      <SourceIcon source={getFieldSource(form.tenancy.rentPaymentDay, null, ex?.rentPaymentDay ?? null)} fieldName="rentPaymentDay" openPopover={openPopover} setOpenPopover={setOpenPopover} />
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      inputMode="numeric"
                      value={form.tenancy.rentPaymentDay ?? ''}
                      onChange={(e) =>
                        updateTenancy({ rentPaymentDay: e.target.value === '' ? null : Number(e.target.value) })
                      }
                      className="h-10 w-full border border-[#E5E7EB] rounded-lg px-3 text-sm text-[#0D0D12] bg-white focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#6B7280] mb-1">
                      Lease start <span className="text-red-500">*</span>
                      <SourceIcon source={getFieldSource(form.tenancy.leaseStartDate, null, ex?.leaseStartDate ?? null)} fieldName="leaseStartDate" openPopover={openPopover} setOpenPopover={setOpenPopover} />
                    </label>
                    <input
                      type="date"
                      value={form.tenancy.leaseStartDate ?? ''}
                      onChange={(e) =>
                        updateTenancy({ leaseStartDate: e.target.value === '' ? null : e.target.value })
                      }
                      className="h-10 w-full border border-[#E5E7EB] rounded-lg px-3 text-sm text-[#0D0D12] bg-white focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#6B7280] mb-1">
                      Lease end
                      <SourceIcon source={getFieldSource(form.tenancy.leaseEndDate, null, ex?.leaseEndDate ?? null)} fieldName="leaseEndDate" openPopover={openPopover} setOpenPopover={setOpenPopover} />
                    </label>
                    <input
                      type="date"
                      value={form.tenancy.leaseEndDate ?? ''}
                      onChange={(e) =>
                        updateTenancy({ leaseEndDate: e.target.value === '' ? null : e.target.value })
                      }
                      className="h-10 w-full border border-[#E5E7EB] rounded-lg px-3 text-sm text-[#0D0D12] bg-white focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#6B7280] mb-1">
                      Lease type
                      <SourceIcon source={getFieldSource(form.tenancy.leaseType, null, ex?.leaseType ?? null)} fieldName="leaseType" openPopover={openPopover} setOpenPopover={setOpenPopover} />
                    </label>
                    <select
                      value={form.tenancy.leaseType ?? ''}
                      onChange={(e) =>
                        updateTenancy({ leaseType: e.target.value === '' ? null : e.target.value })
                      }
                      className="h-10 w-full border border-[#E5E7EB] rounded-lg px-3 text-sm text-[#0D0D12] bg-white focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                    >
                      <option value="">Select…</option>
                      <option value="fixed_term">Fixed term</option>
                      <option value="periodic">Periodic</option>
                      <option value="part_4">Part 4</option>
                      <option value="further_part_4">Further Part 4</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#6B7280] mb-1">
                      RTB registration number
                      <SourceIcon source={getFieldSource(form.tenancy.rtbRegistrationNumber, null, ex?.rtbRegistrationNumber ?? null)} fieldName="rtbRegistrationNumber" openPopover={openPopover} setOpenPopover={setOpenPopover} />
                    </label>
                    <input
                      type="text"
                      value={form.tenancy.rtbRegistrationNumber ?? ''}
                      onChange={(e) =>
                        updateTenancy({ rtbRegistrationNumber: e.target.value === '' ? null : e.target.value })
                      }
                      className="h-10 w-full border border-[#E5E7EB] rounded-lg px-3 text-sm text-[#0D0D12] bg-white focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                    />
                  </div>
                </div>
              )}
            </SectionContainer>
          )}

          {/* Section: COMPLIANCE (off-market follows tenanted rules for RTB) */}
          <SectionContainer title="COMPLIANCE" style={{ marginTop: 24 }}>
            <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2.5">
                {form.property.berCertNumber && form.property.berCertNumber.length > 0 ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="2">
                    <circle cx="12" cy="12" r="4" />
                  </svg>
                )}
                <span className="text-sm text-[#0D0D12]">BER cert</span>
              </div>
              <span className="text-xs text-[#A0A8B0]">
                {form.property.berCertNumber && form.property.berCertNumber.length > 0 ? 'On record' : 'Outstanding'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="2">
                  <circle cx="12" cy="12" r="4" />
                </svg>
                <span className="text-sm text-[#0D0D12]">Gas safety cert</span>
              </div>
              <span className="text-xs text-[#A0A8B0]">Outstanding</span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="2">
                  <circle cx="12" cy="12" r="4" />
                </svg>
                <span className="text-sm text-[#0D0D12]">Electrical cert</span>
              </div>
              <span className="text-xs text-[#A0A8B0]">Outstanding</span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2.5">
                {form.status === 'vacant' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                ) : form.tenancy.rtbRegistrationNumber && form.tenancy.rtbRegistrationNumber.length > 0 ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="2">
                    <circle cx="12" cy="12" r="4" />
                  </svg>
                )}
                <span className="text-sm text-[#0D0D12]">RTB registration</span>
              </div>
              <span className="text-xs text-[#A0A8B0]">
                {form.status === 'vacant'
                  ? 'Not applicable'
                  : form.tenancy.rtbRegistrationNumber && form.tenancy.rtbRegistrationNumber.length > 0
                    ? 'Registered'
                    : 'Outstanding'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2.5">
                {extractionData?.documentId ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="2">
                    <circle cx="12" cy="12" r="4" />
                  </svg>
                )}
                <span className="text-sm text-[#0D0D12]">Signed lease on file</span>
              </div>
              <span className="text-xs text-[#A0A8B0]">
                {extractionData?.documentId ? 'Uploaded' : 'Outstanding'}
              </span>
            </div>
          </SectionContainer>

          {/* Section: DOCUMENTS */}
          <SectionContainer title="DOCUMENTS" style={{ marginTop: 24 }}>
            {extractionData?.documentId ? (
              <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <div className="flex-1 min-w-0">
                  {extractionData.originalFilename ? (
                    <div className="text-sm font-medium text-[#0D0D12] truncate">
                      {extractionData.originalFilename}
                    </div>
                  ) : (
                    <div className="text-sm font-medium text-[#0D0D12] truncate">Lease document</div>
                  )}
                  {typeof extractionData.fileSizeBytes === 'number' && (
                    <div className="text-xs text-[#A0A8B0]">
                      {extractionData.fileSizeBytes < 1024
                        ? `${extractionData.fileSizeBytes} B`
                        : extractionData.fileSizeBytes < 1024 * 1024
                          ? `${(extractionData.fileSizeBytes / 1024).toFixed(0)} KB`
                          : `${(extractionData.fileSizeBytes / 1024 / 1024).toFixed(1)} MB`}
                    </div>
                  )}
                </div>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#FAF3DD] text-[#A47E1B] rounded-full uppercase tracking-wider">
                  Lease
                </span>
              </div>
            ) : (
              <p className="text-xs text-[#A0A8B0]">
                No documents yet. You&rsquo;ll be able to add documents from the property page after saving.
              </p>
            )}
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
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 flex-shrink-0">
                <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90">
                  <circle cx="20" cy="20" r="16" fill="none" stroke="#F3F4F6" strokeWidth="3.5" />
                  <circle
                    cx="20"
                    cy="20"
                    r="16"
                    fill="none"
                    stroke="#D4AF37"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 16}
                    strokeDashoffset={2 * Math.PI * 16 * (1 - completeness / 100)}
                    style={{ transition: 'stroke-dashoffset 250ms cubic-bezier(0.16, 1, 0.3, 1)' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-semibold text-[#0D0D12]">{completeness}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={saveDisabled || saving}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 8,
                  border: 'none',
                  background: '#D4AF37',
                  color: '#FFFFFF',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: saveDisabled || saving ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: saveDisabled || saving ? 'none' : '0 1px 2px rgba(0,0,0,0.06), 0 6px 18px rgba(196,155,42,0.32)',
                  opacity: saveDisabled || saving ? 0.5 : 1,
                  pointerEvents: saveDisabled || saving ? 'none' : 'auto',
                }}
              >
                {saving ? 'Saving…' : saveLabel}
              </button>
            </div>
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

function SourceIcon({
  source,
  fieldName,
  openPopover,
  setOpenPopover,
}: {
  source: FieldSource;
  fieldName: string;
  openPopover: string | null;
  setOpenPopover: (next: string | null) => void;
}) {
  if (!source) return null;
  const isOpen = openPopover === fieldName;
  const stroke = source === 'lease_pdf' ? '#D4AF37' : '#6B7280';
  return (
    <span className="relative inline-flex ml-1.5">
      <button
        type="button"
        data-popover-trigger
        onClick={(e) => {
          e.stopPropagation();
          setOpenPopover(isOpen ? null : fieldName);
        }}
        className="inline-flex items-center justify-center w-4 h-4 rounded hover:bg-gray-100 transition-colors"
        aria-label={`Source: ${SOURCE_LABEL[source]}`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {source === 'google_places' && (
            <>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </>
          )}
          {source === 'eircode' && (
            <>
              <line x1="4" y1="9" x2="20" y2="9" />
              <line x1="4" y1="15" x2="20" y2="15" />
              <line x1="10" y1="3" x2="8" y2="21" />
              <line x1="16" y1="3" x2="14" y2="21" />
            </>
          )}
          {source === 'seai_register' && (
            <>
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <line x1="9" y1="6" x2="15" y2="6" />
              <line x1="9" y1="10" x2="15" y2="10" />
              <line x1="9" y1="14" x2="11" y2="14" />
            </>
          )}
          {source === 'lease_pdf' && (
            <path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z" />
          )}
        </svg>
      </button>
      {isOpen && (
        <div
          data-popover-content
          className="absolute z-50 mt-1 left-0 top-full w-56 bg-[#0D0D12] text-white rounded-lg shadow-lg p-3 text-xs"
        >
          <div className="font-medium mb-0.5">{SOURCE_LABEL[source]}</div>
          <div className="text-[#A0A8B0]">
            Filled automatically from this source. Edit to override.
          </div>
        </div>
      )}
    </span>
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
