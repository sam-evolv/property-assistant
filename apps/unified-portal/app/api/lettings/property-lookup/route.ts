import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { fetchPlaceDetails, addressFromEircodeOnly, type ResolvedAddress } from '@/lib/lettings/places-details';
import { lookupBerByAddress, type BerLookupResult } from '@/lib/lettings/seai-ber-lookup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/lettings/property-lookup
 *
 * Read-only orchestrator. Given an address signal (Google placeId OR
 * eircode), resolves the canonical address and fires the auto-fill lookups
 * in parallel. Returns the structured result + a provenance array the
 * review screen renders as "BER from SEAI register" attribution. No DB
 * writes — persistence happens at save time in Session 8.
 */

type LookupSource = 'google_places' | 'eircode' | 'seai_register';

type ProvenanceEntry = {
  field: string;
  source: LookupSource;
  confidence: number;
};

type LookupResponse = {
  address: ResolvedAddress;
  ber: BerLookupResult | null;
  ppr: null; // TODO post-launch
  provenance: ProvenanceEntry[];
};

export async function POST(request: NextRequest) {
  const started = Date.now();
  try {
    await requireRole(['developer', 'admin', 'super_admin']);

    const body = await request.json().catch(() => null);
    const placeId = typeof body?.placeId === 'string' ? body.placeId.trim() : '';
    const eircodeRaw = typeof body?.eircode === 'string' ? body.eircode.trim() : '';

    if ((!placeId && !eircodeRaw) || (placeId && eircodeRaw)) {
      return NextResponse.json(
        { error: 'Provide exactly one of placeId or eircode' },
        { status: 400 },
      );
    }

    const eircode = eircodeRaw
      ? normaliseEircode(eircodeRaw)
      : undefined;
    if (eircodeRaw && !eircode) {
      return NextResponse.json(
        { error: 'Eircode does not match Irish postal code format' },
        { status: 400 },
      );
    }

    const lookupTag = placeId ? `place#${placeId.slice(0, 8)}` : redactEircode(eircode!);
    console.log(`[lettings-lookup] start tag=${lookupTag}`);

    // Resolve the canonical address first — every downstream lookup needs
    // a known eircode to be useful, so we have to wait on Places before
    // SEAI can run if the user came in via a placeId. With an eircode in
    // hand we run both in parallel.
    let address: ResolvedAddress | null = null;
    let berPromise: Promise<BerLookupResult | null>;
    let addressSource: LookupSource;

    if (placeId) {
      address = await fetchPlaceDetails(placeId);
      if (!address) {
        return NextResponse.json(
          { error: 'Could not resolve address from Google Places' },
          { status: 502 },
        );
      }
      addressSource = 'google_places';
      const eircodeForBer = address.eircode;
      berPromise = eircodeForBer
        ? lookupBerByAddress(address.formattedAddress ?? address.line1, eircodeForBer)
        : Promise.resolve(null);
    } else {
      // eircode-only path: we can fire SEAI immediately and synthesise a
      // minimal address record for the review screen.
      address = addressFromEircodeOnly(eircode!);
      addressSource = 'eircode';
      berPromise = lookupBerByAddress('', eircode);
    }

    const ber = await berPromise;

    const provenance: ProvenanceEntry[] = [];
    pushProvenance(provenance, 'address_line_1', addressSource, 0.95, !!address.line1);
    pushProvenance(provenance, 'town', addressSource, 0.92, !!address.town);
    pushProvenance(provenance, 'county', addressSource, 0.92, !!address.county);
    pushProvenance(provenance, 'eircode', addressSource, 0.99, !!address.eircode);
    pushProvenance(provenance, 'latitude', addressSource, 0.95, address.lat != null);
    pushProvenance(provenance, 'longitude', addressSource, 0.95, address.lng != null);

    if (ber) {
      pushProvenance(provenance, 'ber_rating', 'seai_register', 0.9, !!ber.rating);
      pushProvenance(provenance, 'ber_cert_number', 'seai_register', 0.9, !!ber.certNumber);
      pushProvenance(provenance, 'ber_expiry_date', 'seai_register', 0.9, !!ber.expiryDate);
    }

    const response: LookupResponse = {
      address,
      ber,
      ppr: null,
      provenance,
    };

    console.log(
      `[lettings-lookup] ok tag=${lookupTag} ber_present=${ber ? 'true' : 'false'} duration_ms=${Date.now() - started}`,
    );
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED' || message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error(`[lettings-lookup] error duration_ms=${Date.now() - started} reason=${message}`);
    return NextResponse.json(
      { error: 'Property lookup failed' },
      { status: 500 },
    );
  }
}

function pushProvenance(
  list: ProvenanceEntry[],
  field: string,
  source: LookupSource,
  confidence: number,
  populated: boolean,
): void {
  if (!populated) return;
  list.push({ field, source, confidence });
}

function normaliseEircode(input: string): string | null {
  const compact = input.toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z][0-9]{2}[A-Z0-9]{4}$/.test(compact)) return null;
  return `${compact.slice(0, 3)} ${compact.slice(3)}`;
}

function redactEircode(eircode: string): string {
  return `eircode#${eircode.slice(0, 3)}***`;
}
