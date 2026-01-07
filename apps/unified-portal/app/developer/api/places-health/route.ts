import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }
  return createClient(url, key);
}

function getGoogleMapsApiKey(): string | null {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || null;
}

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

async function getAuthContext() {
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

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({
      success: false,
      error: 'db_env_mismatch',
      message: 'Database configuration missing',
      ...(isTestMode ? { debug: { supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'configured' : 'missing', service_key: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'configured' : 'missing' } } : {}),
    }, { status: 500 });
  }

  console.log('[PlacesHealth] Request:', { schemeId, schemeName, role: auth.role, tenantId: auth.tenantId });

  let projectData: { id: string; name: string; address?: string; organization_id?: string } | null = null;
  let schemeProfileData: { id: string; scheme_lat?: number; scheme_lng?: number; developer_org_id?: string } | null = null;
  let lookupMethod: string = '';
  let lookupError: string | null = null;

  if (schemeId) {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, address, organization_id')
      .eq('id', schemeId)
      .single();

    if (error) {
      console.error('[PlacesHealth] Projects lookup error:', error.message);
      lookupError = error.message;
    } else if (data) {
      projectData = data;
      lookupMethod = 'projects_by_id';
    }

    const { data: spData, error: spError } = await supabase
      .from('scheme_profile')
      .select('id, scheme_lat, scheme_lng, developer_org_id')
      .eq('id', schemeId)
      .single();

    if (spError) {
      console.error('[PlacesHealth] scheme_profile lookup error:', spError.message);
      if (!lookupError) lookupError = spError.message;
    } else if (spData) {
      schemeProfileData = spData;
      if (!lookupMethod) lookupMethod = 'scheme_profile_by_id';
    }
  }

  if (!projectData && schemeName && isTestMode && isAuthenticated) {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, address, organization_id')
      .ilike('name', `%${schemeName}%`)
      .limit(5);

    if (!error && data && data.length > 0) {
      projectData = data[0];
      lookupMethod = 'projects_by_name';
      
      if (data.length > 1) {
        return NextResponse.json({
          success: false,
          error: 'multiple_matches',
          message: `Found ${data.length} projects matching "${schemeName}"`,
          matches: data.map(p => ({ id: p.id, name: p.name })),
        });
      }
    }
  }

  if (!projectData && !schemeProfileData) {
    return NextResponse.json({
      success: false,
      error: 'scheme_not_found',
      message: schemeId 
        ? `No scheme found with id: ${schemeId}` 
        : `No scheme found matching name: ${schemeName}`,
      ...(isTestMode ? {
        debug: {
          lookup_error: lookupError,
          auth_role: auth.role,
          auth_tenant: auth.tenantId,
        },
      } : {}),
    }, { status: 404 });
  }

  const schemeOrgId = projectData?.organization_id || schemeProfileData?.developer_org_id;
  if (auth.role === 'developer' && schemeOrgId && schemeOrgId !== auth.tenantId) {
    return NextResponse.json({
      success: false,
      error: 'forbidden',
      message: 'You do not have access to this scheme',
    }, { status: 403 });
  }

  let hasLocation = false;
  let lat: number | undefined;
  let lng: number | undefined;
  let locationSource: string | undefined;

  if (schemeProfileData?.scheme_lat && schemeProfileData?.scheme_lng) {
    hasLocation = true;
    lat = schemeProfileData.scheme_lat;
    lng = schemeProfileData.scheme_lng;
    locationSource = 'scheme_profile';
  } else if (projectData?.address) {
    const apiKey = getGoogleMapsApiKey();
    if (apiKey) {
      const geocoded = await geocodeAddress(projectData.address, apiKey);
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

  const { data: cacheData } = await supabase
    .from('poi_cache')
    .select('category')
    .eq('scheme_id', schemeId || projectData?.id);

  const response: Record<string, any> = {
    success: true,
    schemeId: schemeId || projectData?.id,
    schemeName: projectData?.name,
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
        exists: (cacheData?.length || 0) > 0,
        categories: cacheData?.map(c => c.category) || [],
      },
    },
    checkedAt: new Date().toISOString(),
  };

  if (isTestMode && isAuthenticated) {
    response.debug = {
      lookup_method: lookupMethod,
      project_address: projectData?.address,
      project_org_id: projectData?.organization_id,
      scheme_profile_org_id: schemeProfileData?.developer_org_id,
      auth_role: auth.role,
      auth_tenant_id: auth.tenantId,
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL?.split('.')[0] + '...',
    };
  }

  return NextResponse.json(response);
}
