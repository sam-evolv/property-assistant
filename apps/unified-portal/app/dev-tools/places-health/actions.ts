'use server';

interface PlacesHealthResult {
  success: boolean;
  data?: any;
  error?: string;
}

export async function runPlacesHealthcheck(
  schemeId?: string,
  schemeName?: string
): Promise<PlacesHealthResult> {
  if (process.env.DEV_TOOLS !== 'true') {
    return { success: false, error: 'DEV_TOOLS not enabled' };
  }

  const testSecret = process.env.ASSISTANT_TEST_SECRET;
  if (!testSecret) {
    return { success: false, error: 'ASSISTANT_TEST_SECRET not configured' };
  }

  const params = new URLSearchParams();
  
  if (schemeId) {
    params.set('schemeId', schemeId);
  } else if (schemeName) {
    params.set('schemeName', schemeName);
  } else {
    return { success: false, error: 'Either schemeId or schemeName is required' };
  }

  const url = `http://localhost:5000/api/developer/places-health?${params.toString()}`;

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

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      return { 
        success: false, 
        error: `API returned non-JSON response (status ${response.status}): ${text.substring(0, 200)}...` 
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Request failed' };
  }
}

export async function getGateStatus(): Promise<{ devToolsEnabled: boolean; secretPresent: boolean }> {
  return {
    devToolsEnabled: process.env.DEV_TOOLS === 'true',
    secretPresent: !!process.env.ASSISTANT_TEST_SECRET,
  };
}
