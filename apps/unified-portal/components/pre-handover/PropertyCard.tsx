'use client';

import type { Property, Milestone } from '@/lib/pre-handover/types';
import { Home, Check } from 'lucide-react';

interface Props {
  property: Property;
  milestones: Milestone[];
}

export function PropertyCard({ property, milestones }: Props) {
  const completedCount = milestones.filter((m) => m.completed).length;
  const totalCount = milestones.length || 1;
  const progressPercent = Math.round((completedCount / totalCount) * 100) || 0;
  const currentMilestone = milestones.find((m) => m.current);
  const currentIndex = milestones.findIndex((m) => m.current);

  const statusConfig = {
    on_track: {
      bg: 'bg-gradient-to-r from-emerald-50 to-emerald-100',
      border: 'border-emerald-200/80',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500',
      label: 'On Track',
    },
    delayed: {
      bg: 'bg-gradient-to-r from-amber-50 to-amber-100',
      border: 'border-amber-200/80',
      text: 'text-amber-700',
      dot: 'bg-amber-500',
      label: 'Delayed',
    },
    at_risk: {
      bg: 'bg-gradient-to-r from-red-50 to-red-100',
      border: 'border-red-200/80',
      text: 'text-red-700',
      dot: 'bg-red-500',
      label: 'At Risk',
    },
  };

  const status = statusConfig[property.status];

  return (
    <div className="bg-white/90 backdrop-blur-xl border border-white/90 rounded-[20px] p-6 
      shadow-[0_4px_24px_rgba(12,12,12,0.06)] transition-all duration-[250ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]
      hover:shadow-[0_8px_32px_rgba(212,175,55,0.08)]">
      {/* Home Icon - Enhanced */}
      <div className="flex justify-center mb-5">
        <div className="relative">
          <div className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-[#FEFCE8] via-[#FEF9C3] to-[#FEF08A] 
            flex items-center justify-center border border-[#D4AF37]/20 shadow-[0_8px_32px_rgba(212,175,55,0.12)]">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8941F] 
              flex items-center justify-center shadow-[0_4px_16px_rgba(212,175,55,0.25)]">
              <Home className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border-2 border-[#D4AF37]/30 
            flex items-center justify-center shadow-sm">
            <span className="text-[10px] font-bold text-[#D4AF37]">{completedCount}/{totalCount}</span>
          </div>
        </div>
      </div>

      {/* Property Info */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">{property.address}</h2>
        <p className="text-sm text-gray-500 mt-1.5">
          {property.bedrooms} Bed {property.propertyDesignation} · {property.houseType}
        </p>

        {/* Status Badge - Enhanced */}
        <div className="mt-4 flex justify-center">
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${status.bg} border ${status.border}
              shadow-sm transition-all duration-[250ms]`}
          >
            <span className={`w-2 h-2 rounded-full ${status.dot} animate-pulse`} />
            <span className={`text-xs font-semibold ${status.text}`}>
              {status.label} · Est. {property.estimatedHandover}
            </span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="my-6 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/20 to-transparent" />

      {/* Progress Section - Enhanced with milestone dots */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Progress
          </span>
          <span className="text-sm font-bold text-[#D4AF37]">{progressPercent}%</span>
        </div>
        
        {/* Segmented Progress Bar with Milestone Dots */}
        <div className="relative">
          {/* Background track */}
          <div className="h-2.5 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] via-[#FACC15] to-[#D4AF37] 
                transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]
                shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          
          {/* Milestone dots overlay */}
          <div className="absolute inset-0 flex items-center justify-between px-0.5">
            {milestones.slice(0, 6).map((milestone, idx) => {
              const isCompleted = milestone.completed;
              const isCurrent = milestone.current;
              return (
                <div
                  key={milestone.id}
                  className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-300
                    ${isCompleted 
                      ? 'bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.4)]' 
                      : isCurrent
                        ? 'bg-white border-2 border-[#D4AF37] shadow-sm'
                        : 'bg-gray-200 border-2 border-gray-300'
                    }`}
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  {isCompleted && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                  {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Current Milestone - Enhanced */}
        {currentMilestone && (
          <div className="mt-4 flex items-center justify-center gap-2.5 py-2 px-4 rounded-xl 
            bg-gradient-to-r from-[#FEFCE8]/50 to-[#FEF9C3]/50 border border-[#D4AF37]/10">
            <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#FACC15] animate-pulse 
              shadow-[0_0_8px_rgba(212,175,55,0.4)]" />
            <span className="text-sm text-gray-700">
              <strong className="font-semibold text-gray-900">{currentMilestone.label}</strong>
              <span className="text-gray-400"> · Est. {currentMilestone.estimatedDate}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
