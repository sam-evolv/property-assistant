'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { usePurchaserSession } from '@/contexts/PurchaserContext';
import { Home, MapPin, Loader2 } from 'lucide-react';

export default function PurchaserWelcomePage() {
  const router = useRouter();
  const { session, isLoading } = usePurchaserSession();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace('/purchaser');
      return;
    }

    if (session) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            router.replace('/purchaser/app');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isLoading, session, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        {session.developmentLogoUrl ? (
          <div className="mb-8">
            <Image
              src={session.developmentLogoUrl}
              alt={session.developmentName}
              width={200}
              height={80}
              className="h-20 w-auto object-contain mx-auto"
            />
          </div>
        ) : (
          <div className="w-20 h-20 bg-gold-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
            <Home className="w-10 h-10 text-gold-500" />
          </div>
        )}

        <h1 className="text-3xl font-bold text-white mb-4">
          Welcome to {session.developmentName}
        </h1>

        {session.address && (
          <div className="flex items-center justify-center gap-2 text-grey-400 mb-8">
            <MapPin className="w-4 h-4" />
            <span>{session.address}</span>
          </div>
        )}

        <p className="text-grey-400 mb-2">
          Hello, {session.purchaserName}
        </p>

        <div className="mt-8">
          <div className="inline-flex items-center gap-2 text-gold-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading your home in {countdown}...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
