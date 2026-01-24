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
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="px-5 pt-[calc(12px+env(safe-area-inset-top))] pb-2 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">{getTimeGreeting()}</p>
          <h1 className="text-lg font-bold text-gray-900">My Home</h1>
        </div>
        <button
          onClick={() => onOpenSheet('settings')}
          className="w-10 h-10 rounded-xl bg-white/70 backdrop-blur border border-white/90 flex items-center justify-center active:scale-95 transition-transform shadow-sm"
        >
          <Settings className="w-5 h-5 text-gray-500" />
        </button>
      </header>

      {/* Main Content */}
      <main className="px-5 space-y-4">
        {/* Welcome Text */}
        <p className="text-sm text-gray-600 text-center">
          Welcome to your new home journey,{' '}
          <strong className="text-gray-900">{data.purchaser.name}</strong>
        </p>

        {/* Property Card */}
        <PropertyCard property={data.property} milestones={data.milestones} />

        {/* Quick Actions */}
        <QuickActionsGrid onOpenSheet={onOpenSheet} />

        {/* Key Dates */}
        <KeyDatesCard milestones={data.milestones} onClick={() => onOpenSheet('calendar')} />

        {/* Ask Question */}
        <AskQuestionCard onClick={() => onOpenSheet('chat')} />
      </main>
    </div>
  );
}
