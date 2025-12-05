'use client';

import Link from 'next/link';
import { 
  Building2, 
  Wrench, 
  Zap, 
  Wind, 
  MapPin, 
  Construction, 
  ClipboardCheck, 
  FileCheck, 
  AlertCircle, 
  FolderOpen,
  ChevronRight
} from 'lucide-react';
import type { DisciplineType, DisciplineSummary } from '@/lib/archive';

const disciplineIcons: Record<DisciplineType, typeof Building2> = {
  architectural: Building2,
  engineering: Wrench,
  electrical: Zap,
  mechanical: Wind,
  planning: MapPin,
  civils: Construction,
  'as-builts': ClipboardCheck,
  handover: FileCheck,
  important: AlertCircle,
  uncategorized: FolderOpen,
};

const disciplineColors: Record<DisciplineType, { bg: string; icon: string; border: string }> = {
  architectural: { bg: 'bg-blue-500/10', icon: 'text-blue-400', border: 'border-blue-500/20' },
  engineering: { bg: 'bg-orange-500/10', icon: 'text-orange-400', border: 'border-orange-500/20' },
  electrical: { bg: 'bg-yellow-500/10', icon: 'text-yellow-400', border: 'border-yellow-500/20' },
  mechanical: { bg: 'bg-cyan-500/10', icon: 'text-cyan-400', border: 'border-cyan-500/20' },
  planning: { bg: 'bg-green-500/10', icon: 'text-green-400', border: 'border-green-500/20' },
  civils: { bg: 'bg-amber-500/10', icon: 'text-amber-400', border: 'border-amber-500/20' },
  'as-builts': { bg: 'bg-purple-500/10', icon: 'text-purple-400', border: 'border-purple-500/20' },
  handover: { bg: 'bg-emerald-500/10', icon: 'text-emerald-400', border: 'border-emerald-500/20' },
  important: { bg: 'bg-red-500/10', icon: 'text-red-400', border: 'border-red-500/20' },
  uncategorized: { bg: 'bg-gray-500/10', icon: 'text-gray-400', border: 'border-gray-500/20' },
};

interface DisciplineCardProps {
  discipline: DisciplineSummary;
}

export function DisciplineCard({ discipline }: DisciplineCardProps) {
  const Icon = disciplineIcons[discipline.discipline] || FolderOpen;
  const colors = disciplineColors[discipline.discipline] || disciplineColors.uncategorized;
  
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

      {/* Important Badge */}
      {discipline.discipline === 'important' && discipline.fileCount > 0 && (
        <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
          {discipline.fileCount}
        </div>
      )}
    </Link>
  );
}
