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
        {/* Upgrade 5: Welcome hero block */}
        <div className="rounded-2xl bg-gradient-to-br from-[#0F0F0F] to-[#1A1A0A] p-4 text-white
          shadow-[0_8px_24px_rgba(0,0,0,0.12)] animate-[slideUp_0.5s_cubic-bezier(0.2,0.8,0.2,1)]"
          style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>
          <p className="text-[10px] font-semibold text-[#D4AF37]/80 uppercase tracking-widest mb-1">Your New Home</p>
          <h2 className="text-xl font-bold tracking-tight leading-tight">
            Welcome, <span className="text-[#D4AF37]">{data.purchaser.name.split(' ')[0]}</span>
          </h2>
          <p className="text-[11px] text-white/50 mt-1">Your home journey is underway</p>
          <div className="mt-3 h-px bg-gradient-to-r from-[#D4AF37]/30 via-[#FACC15]/20 to-transparent" />
          <p className="mt-2 text-[10px] text-white/40">OpenHouse AI · Powered by your developer</p>
        </div>

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
