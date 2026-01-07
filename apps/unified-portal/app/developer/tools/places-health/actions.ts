'use server';

import { cookies } from 'next/headers';

interface PlacesHealthResult {
  success: boolean;
  data?: any;
  error?: string;
}

export async function runPlacesHealthcheck(
  schemeId?: string,
  schemeName?: string
): Promise<PlacesHealthResult> {
  const cookieStore = cookies();
  const adminId = cookieStore.get('admin_id')?.value;
  const tenantId = cookieStore.get('tenant_id')?.value;
  const role = cookieStore.get('user_role')?.value;

  if (!adminId || !tenantId) {
    return { success: false, error: 'Not authenticated' };
  }

  const allowedRoles = ['developer', 'admin', 'super_admin'];
  if (!role || !allowedRoles.includes(role)) {
    return { success: false, error: 'Insufficient permissions' };
  }

  const testSecret = process.env.ASSISTANT_TEST_SECRET;
  if (!testSecret) {
    return { success: false, error: 'Test secret not configured' };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000';
  const params = new URLSearchParams();
  
  if (schemeId) {
    params.set('schemeId', schemeId);
  } else if (schemeName) {
    params.set('schemeName', schemeName);
  } else {
    return { success: false, error: 'Either schemeId or schemeName is required' };
  }

  const url = `${baseUrl}/developer/api/places-health?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Test-Mode': 'places-diagnostics',
        'X-Test-Secret': testSecret,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const data = await response.json();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Request failed' };
  }
}
