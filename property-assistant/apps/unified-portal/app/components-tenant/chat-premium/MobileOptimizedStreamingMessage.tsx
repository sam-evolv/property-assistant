'use client';

import { memo } from 'react';
import dynamic from 'next/dynamic';
import { useIsMobileWithSSR } from '@/hooks/useMobile';

const MotionStreamingMessage = dynamic(
  () => import('./StreamingMessage'),
  { ssr: false, loading: () => null }
);

const CSSStreamingDots = memo(function CSSStreamingDots() {
  return (
    <div className="flex justify-start mb-4 animate-fadeIn">
      <div className="flex-shrink-0 mr-2 mt-1">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-md">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      </div>
      <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-white border border-gray-200 shadow-sm">
        <div className="flex items-center space-x-1.5">
          <div className="w-2 h-2 bg-gold-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-gold-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-gold-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
});

export default function MobileOptimizedStreamingMessage() {
  const { isMobile, mounted } = useIsMobileWithSSR();

  if (!mounted || isMobile) {
    return <CSSStreamingDots />;
  }

  return <MotionStreamingMessage />;
}
