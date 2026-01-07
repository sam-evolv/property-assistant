import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { assertSchemeAccess, AuthContext } from '@/lib/security/scheme-access';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function getGoogleMapsApiKey(): string | null {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || null;
}

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

async function getAuthContext(): Promise<AuthContext> {
  const cookieStore = cookies();
  const adminId = cookieStore.get('admin_id')?.value;
  const tenantId = cookieStore.get('tenant_id')?.value;
  const role = cookieStore.get('user_role')?.value;
  return { adminId, tenantId, role };
}

async function geocodeAddress(address: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', address);
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    const data = await response.json();

    if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
  } catch {
  }
  return null;
}

async function testPlacesApiCall(lat: number, lng: number, apiKey: string): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
    url.searchParams.set('location', `${lat},${lng}`);
    url.searchParams.set('radius', '1000');
    url.searchParams.set('type', 'supermarket');
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    const data = await response.json();

    if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
      return { success: true, status: data.status };
    }
    return { success: false, status: data.status, error: data.error_message };
  } catch (err: any) {
    return { success: false, status: 'NETWORK_ERROR', error: err.message };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const schemeId = searchParams.get('schemeId');
  const schemeName = searchParams.get('schemeName');
  const isTestMode = request.headers.get('X-Test-Mode') === 'places-diagnostics';

  const auth = await getAuthContext();
  const isAuthenticated = !!auth.adminId && !!auth.tenantId;
  const allowedRoles = ['developer', 'admin', 'super_admin'];
  const hasAllowedRole = auth.role && allowedRoles.includes(auth.role);

  if (!isAuthenticated) {
    return NextResponse.json({
      success: false,
      error: 'unauthorized',
      message: 'Authentication required',
    }, { status: 401 });
  }

  if (!hasAllowedRole) {
    return NextResponse.json({
      success: false,
      error: 'forbidden',
      message: 'Developer, admin, or super_admin role required',
    }, { status: 403 });
  }

  if (!schemeId && !schemeName) {
    return NextResponse.json({
      success: false,
      error: 'missing_scheme_id',
      message: 'schemeId or schemeName query parameter is required',
    }, { status: 400 });
  }

  if (schemeId && schemeId.includes('-') && !isValidUUID(schemeId)) {
    return NextResponse.json({
      success: false,
      error: 'invalid_scheme_id_format',
      message: 'schemeId appears to be a malformed UUID',
    }, { status: 400 });
  }

  if (schemeName && !isTestMode) {
    return NextResponse.json({
      success: false,
      error: 'test_mode_required',
      message: 'schemeName lookup requires X-Test-Mode header',
    }, { status: 400 });
  }

  console.log('[PlacesHealth] Authorized request from role:', auth.role);

  const schemeAccess = await assertSchemeAccess(
    { schemeId: schemeId || undefined, schemeName: schemeName || undefined },
    auth
  );

  if (!schemeAccess.success) {
    if (schemeAccess.error === 'forbidden') {
      return NextResponse.json({
        success: false,
        error: 'forbidden',
        message: 'Access denied',
      }, { status: 403 });
    }

    return NextResponse.json({
      success: false,
      error: 'scheme_not_found',
      message: schemeId 
        ? 'No scheme found with that id' 
        : 'No scheme found matching that name',
    }, { status: 404 });
  }

  let hasLocation = false;
  let lat: number | undefined;
  let lng: number | undefined;
  let locationSource: string | undefined;

  if (schemeAccess.schemeLat && schemeAccess.schemeLng) {
    hasLocation = true;
    lat = schemeAccess.schemeLat;
    lng = schemeAccess.schemeLng;
    locationSource = 'scheme_profile';
  } else if (schemeAccess.schemeAddress) {
    const apiKey = getGoogleMapsApiKey();
    if (apiKey) {
      const geocoded = await geocodeAddress(schemeAccess.schemeAddress, apiKey);
      if (geocoded) {
        hasLocation = true;
        lat = geocoded.lat;
        lng = geocoded.lng;
        locationSource = 'geocoded_address';
      }
    }
  }

  const apiKeyConfigured = !!getGoogleMapsApiKey();
  let liveCallSuccess = false;
  let liveCallStatus: string | undefined;
  let liveCallError: string | undefined;

  if (hasLocation && lat !== undefined && lng !== undefined && apiKeyConfigured) {
    const testResult = await testPlacesApiCall(lat, lng, getGoogleMapsApiKey()!);
    liveCallSuccess = testResult.success;
    liveCallStatus = testResult.status;
    liveCallError = testResult.error;
  }

  const supabase = getServiceClient();
  let cacheCategories: string[] = [];

  if (supabase && schemeAccess.schemeId) {
    const { data: cacheData } = await supabase
      .from('poi_cache')
      .select('category')
      .eq('scheme_id', schemeAccess.schemeId);
    cacheCategories = cacheData?.map(c => c.category) || [];
  }

  const response: Record<string, any> = {
    success: true,
    schemeId: schemeAccess.schemeId,
    schemeName: schemeAccess.schemeName,
    health: {
      location: {
        present: hasLocation,
        lat,
        lng,
        source: locationSource,
      },
      apiKey: {
        configured: apiKeyConfigured,
      },
      liveCall: {
        success: liveCallSuccess,
        status: liveCallStatus,
        error: liveCallError,
      },
      cache: {
        exists: cacheCategories.length > 0,
        categories: cacheCategories,
      },
    },
    checkedAt: new Date().toISOString(),
  };

  if (isTestMode) {
    response.debug = {
      lookup_method: schemeAccess.lookupMethod,
      scheme_address: schemeAccess.schemeAddress,
      auth_role: auth.role,
      auth_tenant_id: auth.tenantId,
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL?.split('.')[0] + '...',
    };
  }

  return NextResponse.json(response);
}
