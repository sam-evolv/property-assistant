export interface PurchaserFetchResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  isSessionExpired: boolean;
}

export async function purchaserFetch<T>(
  url: string,
  options?: RequestInit
): Promise<PurchaserFetchResult<T>> {
  try {
    const response = await fetch(url, options);

    if (response.status === 401) {
      return {
        ok: false,
        isSessionExpired: true,
        error: 'Session expired',
      };
    }

    if (!response.ok) {
      let errorMessage = 'Request failed';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
      }
      return {
        ok: false,
        isSessionExpired: false,
        error: errorMessage,
      };
    }

    const data = await response.json() as T;
    return {
      ok: true,
      data,
      isSessionExpired: false,
    };
  } catch (error) {
    return {
      ok: false,
      isSessionExpired: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}
