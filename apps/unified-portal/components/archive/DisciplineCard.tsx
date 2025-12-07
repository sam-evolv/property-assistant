'use client';

import Link from 'next/link';
import { 
  Building2, 
  Hammer, 
  Cog, 
  Zap, 
  Droplet,
  Mountain,
  Trees,
  Files,
  ClipboardCheck,
  ChevronRight
} from 'lucide-react';
import type { DisciplineType, DisciplineSummary } from '@/lib/archive-constants';

const disciplineIcons: Record<DisciplineType, typeof Building2> = {
  architectural: Building2,
  structural: Hammer,
  mechanical: Cog,
  electrical: Zap,
  plumbing: Droplet,
  civil: Mountain,
  landscape: Trees,
  handover: ClipboardCheck,
  other: Files,
};

const disciplineColors: Record<DisciplineType, { bg: string; icon: string; border: string }> = {
  architectural: { bg: 'bg-blue-500/10', icon: 'text-blue-400', border: 'border-blue-500/20' },
  structural: { bg: 'bg-orange-500/10', icon: 'text-orange-400', border: 'border-orange-500/20' },
  mechanical: { bg: 'bg-green-500/10', icon: 'text-green-400', border: 'border-green-500/20' },
  electrical: { bg: 'bg-yellow-500/10', icon: 'text-yellow-400', border: 'border-yellow-500/20' },
  plumbing: { bg: 'bg-cyan-500/10', icon: 'text-cyan-400', border: 'border-cyan-500/20' },
  civil: { bg: 'bg-amber-500/10', icon: 'text-amber-400', border: 'border-amber-500/20' },
  landscape: { bg: 'bg-emerald-500/10', icon: 'text-emerald-400', border: 'border-emerald-500/20' },
  handover: { bg: 'bg-violet-500/10', icon: 'text-violet-400', border: 'border-violet-500/20' },
  other: { bg: 'bg-gray-500/10', icon: 'text-gray-400', border: 'border-gray-500/20' },
};

interface DisciplineCardProps {
  discipline: DisciplineSummary;
}

export function DisciplineCard({ discipline }: DisciplineCardProps) {
  const Icon = disciplineIcons[discipline.discipline] || Files;
  const colors = disciplineColors[discipline.discipline] || disciplineColors.other;
  
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No files yet';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IE', { 
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <Link
      href={`/developer/archive/${discipline.discipline}`}
      className={`
        group relative block p-6 rounded-2xl border ${colors.border}
        bg-gradient-to-br from-gray-900 via-gray-900/95 to-black
        hover:shadow-xl hover:shadow-black/20
        transition-all duration-300 ease-out
        hover:-translate-y-1
      `}
    >
      {/* Icon */}
      <div className={`
        w-14 h-14 rounded-xl ${colors.bg} 
        flex items-center justify-center mb-4
        group-hover:scale-110 transition-transform duration-300
      `}>
        <Icon className={`w-7 h-7 ${colors.icon}`} />
      </div>

      {/* Content */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white group-hover:text-gold-400 transition-colors">
          {discipline.displayName}
        </h3>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">
            {discipline.fileCount} {discipline.fileCount === 1 ? 'file' : 'files'}
          </span>
          <span className="text-gray-500 text-xs">
            {formatDate(discipline.lastUpdated)}
          </span>
        </div>
      </div>

      {/* Hover Arrow */}
      <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-5 h-5 text-gold-400" />
      </div>
    </Link>
  );
}
