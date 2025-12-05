'use client';

import { DisciplineCard } from './DisciplineCard';
import type { DisciplineSummary } from '@/lib/archive-constants';

interface DisciplineGridProps {
  disciplines: DisciplineSummary[];
  isLoading?: boolean;
}

export function DisciplineGrid({ disciplines, isLoading }: DisciplineGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="p-6 rounded-2xl border border-gray-800 bg-gray-900 animate-pulse"
          >
            <div className="w-14 h-14 rounded-xl bg-gray-800 mb-4" />
            <div className="h-5 w-32 bg-gray-800 rounded mb-2" />
            <div className="h-4 w-20 bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (disciplines.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <div className="w-20 h-20 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">No documents yet</h3>
        <p className="text-gray-400 max-w-md mx-auto">
          Upload documents to this development to organize them in the Smart Archive.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {disciplines.map((discipline) => (
        <DisciplineCard key={discipline.discipline} discipline={discipline} />
      ))}
    </div>
  );
}
