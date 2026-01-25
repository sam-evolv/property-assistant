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
    <div className="min-h-screen pb-20">
      <header className="px-4 pt-[calc(12px+env(safe-area-inset-top))] pb-2 flex items-center justify-between
        animate-[fadeIn_0.3s_ease-out]">
        <div>
          <p className="text-[10px] text-gray-500 font-medium">{getTimeGreeting()}</p>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">My Home</h1>
        </div>
        <button
          onClick={() => onOpenSheet('settings')}
          className="group w-9 h-9 rounded-lg bg-white/90 backdrop-blur-xl border border-white/90 
            flex items-center justify-center active:scale-95 
            transition-all duration-200
            shadow-[0_2px_8px_rgba(12,12,12,0.04)] hover:border-[#D4AF37]/20"
        >
          <Settings className="w-4 h-4 text-gray-500 group-hover:text-[#D4AF37] group-hover:rotate-45 
            transition-all duration-200" />
        </button>
      </header>

      <main className="px-4 space-y-3">
        <p className="text-xs text-gray-600 text-center animate-[fadeIn_0.4s_ease-out]"
          style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>
          Welcome to your new home journey,{' '}
          <strong className="text-gray-900 font-semibold">{data.purchaser.name}</strong>
        </p>

        <div className="animate-[slideUp_0.5s_cubic-bezier(0.2,0.8,0.2,1)]"
          style={{ animationDelay: '150ms', animationFillMode: 'backwards' }}>
          <PropertyCard property={data.property} milestones={data.milestones} />
        </div>

        <div className="animate-[slideUp_0.5s_cubic-bezier(0.2,0.8,0.2,1)]"
          style={{ animationDelay: '250ms', animationFillMode: 'backwards' }}>
          <QuickActionsGrid onOpenSheet={onOpenSheet} />
        </div>

        <div className="animate-[slideUp_0.5s_cubic-bezier(0.2,0.8,0.2,1)]"
          style={{ animationDelay: '350ms', animationFillMode: 'backwards' }}>
          <KeyDatesCard milestones={data.milestones} onClick={() => onOpenSheet('calendar')} />
        </div>

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
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
