'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HandoverRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/developer');
  }, [router]);
  
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <p className="text-gray-400">Redirecting...</p>
    </div>
  );
}
