'use client';

import { useState, useEffect } from 'react';

interface IntroAnimationProps {
  developmentName: string;
  purchaserName: string;
  address: string;
  logoUrl?: string | null;
  handoverComplete?: boolean;
  onComplete: () => void;
}

export default function IntroAnimation({
  developmentName,
  purchaserName,
  address,
  logoUrl,
  handoverComplete = false,
  onComplete,
}: IntroAnimationProps) {
  const [step, setStep] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 800),
      setTimeout(() => setStep(2), 2200),
      setTimeout(() => setStep(3), 3600),
      setTimeout(() => {
        setFadeOut(true);
        setTimeout(onComplete, 800);
      }, 5000),
    ];

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 bg-gradient-to-br from-black via-black to-gold-500 z-50 flex items-center justify-center transition-opacity duration-700 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="text-center px-6 max-w-2xl">
        {/* Logo if available */}
        {logoUrl && (
          <div className={`mb-8 transition-all duration-1000 ${step >= 1 ? 'opacity-100' : 'opacity-0'}`}>
            <img src={logoUrl} alt="Development Logo" className="h-20 mx-auto object-contain" />
          </div>
        )}
        
        {/* Step 1: Welcome */}
        <div
          className={`transition-all duration-1000 ${
            step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
            {handoverComplete ? 'Welcome Home' : 'Your Home Journey'}
          </h1>
        </div>

        {/* Step 2: Development Name */}
        <div
          className={`transition-all duration-1000 delay-200 ${
            step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 bg-clip-text text-transparent">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              {developmentName}
            </h2>
          </div>
        </div>

        {/* Step 3: Personalized Message */}
        <div
          className={`transition-all duration-1000 delay-400 ${
            step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="text-xl md:text-2xl text-white/80 mb-2">
            Hello, <span className="text-white font-semibold">{purchaserName}</span>
          </p>
          <p className="text-lg text-white/60">
            {address}
          </p>
          <div className="mt-8">
            <div className="inline-block animate-pulse">
              <div className="h-1 w-24 bg-gradient-to-r from-transparent via-gold-500 to-transparent rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
