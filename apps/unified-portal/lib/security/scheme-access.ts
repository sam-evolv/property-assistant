import { createClient } from '@supabase/supabase-js';

export interface AuthContext {
  adminId?: string;
  tenantId?: string;
  role?: string;
}

export interface SchemeAccessResult {
  success: boolean;
  schemeId?: string;
  schemeName?: string;
  schemeAddress?: string;
  schemeLat?: number;
  schemeLng?: number;
  error?: 'scheme_not_found' | 'forbidden' | 'db_error';
  lookupMethod?: string;
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function assertSchemeAccess(
  query: { schemeId?: string; schemeName?: string },
  auth: AuthContext
): Promise<SchemeAccessResult> {
  const supabase = getServiceClient();
  if (!supabase) {
    return { success: false, error: 'db_error' };
  }

  const { schemeId, schemeName } = query;
  const { tenantId, role } = auth;
  const isAdminOrSuper = role === 'admin' || role === 'super_admin';

  if (!tenantId && !isAdminOrSuper) {
    return { success: false, error: 'forbidden' };
  }

  if (schemeId) {
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('id, name, address, organization_id')
      .eq('id', schemeId)
      .single();

    if (projectError || !projectData) {
      const { data: spData, error: spError } = await supabase
        .from('scheme_profile')
        .select('id, scheme_name, scheme_address, scheme_lat, scheme_lng, developer_org_id')
        .eq('id', schemeId)
        .single();

      if (spError || !spData) {
        return { success: false, error: 'scheme_not_found' };
      }

      if (!isAdminOrSuper && spData.developer_org_id !== tenantId) {
        return { success: false, error: 'scheme_not_found' };
      }

      return {
        success: true,
        schemeId: spData.id,
        schemeName: spData.scheme_name,
        schemeAddress: spData.scheme_address,
        schemeLat: spData.scheme_lat,
        schemeLng: spData.scheme_lng,
        lookupMethod: 'scheme_profile_by_id',
      };
    }

    if (!isAdminOrSuper && projectData.organization_id !== tenantId) {
      return { success: false, error: 'scheme_not_found' };
    }

    const { data: spData } = await supabase
      .from('scheme_profile')
      .select('id, scheme_name, scheme_address, scheme_lat, scheme_lng')
      .eq('id', schemeId)
      .single();

    return {
      success: true,
      schemeId: projectData.id,
      schemeName: spData?.scheme_name || projectData.name,
      schemeAddress: spData?.scheme_address || projectData.address,
      schemeLat: spData?.scheme_lat,
      schemeLng: spData?.scheme_lng,
      lookupMethod: 'projects_by_id',
    };
  }

  if (schemeName) {
    let baseQuery = supabase
      .from('projects')
      .select('id, name, address, organization_id')
      .ilike('name', `%${schemeName}%`);

    if (!isAdminOrSuper && tenantId) {
      baseQuery = baseQuery.eq('organization_id', tenantId);
    }

    const { data, error } = await baseQuery.limit(10);

    if (error || !data || data.length === 0) {
      return { success: false, error: 'scheme_not_found' };
    }

    if (data.length > 1) {
      return {
        success: false,
        error: 'scheme_not_found',
        lookupMethod: 'multiple_matches',
      };
    }

    const project = data[0];

    const { data: spData } = await supabase
      .from('scheme_profile')
      .select('id, scheme_lat, scheme_lng')
      .eq('id', project.id)
      .single();

    return {
      success: true,
      schemeId: project.id,
      schemeName: project.name,
      schemeAddress: project.address,
      schemeLat: spData?.scheme_lat,
      schemeLng: spData?.scheme_lng,
      lookupMethod: 'projects_by_name',
    };
  }

  return { success: false, error: 'scheme_not_found' };
}
