'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function PurchaserDemoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const unitUid = searchParams.get('unitUid') || 'LV-PARK-003';
  const [error, setError] = useState<string | null>(null);
  const hasCalledRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate calls (React Strict Mode calls useEffect twice in dev)
    if (hasCalledRef.current) return;
    hasCalledRef.current = true;
    
    const generateTokenAndRedirect = async () => {
      try {
        // Call impersonation API to get a valid token
        const res = await fetch(`/api/super/impersonate?unitUid=${encodeURIComponent(unitUid)}`);
        
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Failed to generate token');
          return;
        }

        const { url } = await res.json();
        
        // Redirect to the purchaser portal with the token
        window.location.href = url;
      } catch (err) {
        console.error('[Purchaser Demo] Error:', err);
        setError('Failed to access purchaser portal');
      }
    };

    generateTokenAndRedirect();
  }, [unitUid]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-lg font-semibold text-red-900 mb-2">Error</h2>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600 mx-auto mb-4"></div>
            <h2 className="text-lg font-semibold text-gray-900">Accessing Purchaser Portal</h2>
            <p className="text-sm text-gray-600 mt-2">Generating secure access token...</p>
          </div>
        )}
      </div>
    </div>
  );
}
