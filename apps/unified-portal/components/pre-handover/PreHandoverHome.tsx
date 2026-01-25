'use client';

import { PropertyCard } from './PropertyCard';
import { QuickActionsGrid } from './QuickActionsGrid';
import { KeyDatesCard } from './KeyDatesCard';
import { AskQuestionCard } from './AskQuestionCard';
import type { PreHandoverData } from '@/lib/pre-handover/types';
import { Settings } from 'lucide-react';

interface Props {
  data: PreHandoverData;
  onOpenSheet: (name: string) => void;
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function PreHandoverHome({ data, onOpenSheet }: Props) {
  return (
    <div className="min-h-screen pb-28">
      {/* Header */}
      <header className="px-5 pt-[calc(16px+env(safe-area-inset-top))] pb-3 flex items-center justify-between
        animate-[fadeIn_0.3s_ease-out]">
        <div>
          <p className="text-xs text-gray-500 font-medium">{getTimeGreeting()}</p>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">My Home</h1>
        </div>
        <button
          onClick={() => onOpenSheet('settings')}
          className="group w-11 h-11 rounded-xl bg-white/90 backdrop-blur-xl border border-white/90 
            flex items-center justify-center active:scale-95 
            transition-all duration-[250ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]
            shadow-[0_2px_12px_rgba(12,12,12,0.04)] hover:shadow-[0_4px_16px_rgba(212,175,55,0.1)]
            hover:border-[#D4AF37]/20"
        >
          <Settings className="w-5 h-5 text-gray-500 group-hover:text-[#D4AF37] group-hover:rotate-45 
            transition-all duration-[250ms]" />
        </button>
      </header>

      {/* Main Content */}
      <main className="px-5 space-y-4">
        {/* Welcome Text */}
        <p className="text-sm text-gray-600 text-center animate-[fadeIn_0.4s_ease-out]"
          style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>
          Welcome to your new home journey,{' '}
          <strong className="text-gray-900 font-semibold">{data.purchaser.name}</strong>
        </p>

        {/* Property Card */}
        <div className="animate-[slideUp_0.5s_cubic-bezier(0.2,0.8,0.2,1)]"
          style={{ animationDelay: '150ms', animationFillMode: 'backwards' }}>
          <PropertyCard property={data.property} milestones={data.milestones} />
        </div>

        {/* Quick Actions */}
        <div className="animate-[slideUp_0.5s_cubic-bezier(0.2,0.8,0.2,1)]"
          style={{ animationDelay: '250ms', animationFillMode: 'backwards' }}>
          <QuickActionsGrid onOpenSheet={onOpenSheet} />
        </div>

        {/* Key Dates */}
        <div className="animate-[slideUp_0.5s_cubic-bezier(0.2,0.8,0.2,1)]"
          style={{ animationDelay: '350ms', animationFillMode: 'backwards' }}>
          <KeyDatesCard milestones={data.milestones} onClick={() => onOpenSheet('calendar')} />
        </div>

        {/* Ask Question */}
        <div className="animate-[slideUp_0.5s_cubic-bezier(0.2,0.8,0.2,1)]"
          style={{ animationDelay: '450ms', animationFillMode: 'backwards' }}>
          <AskQuestionCard onClick={() => onOpenSheet('chat')} />
        </div>
      </main>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
