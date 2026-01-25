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
    <div className="bg-white/90 backdrop-blur-xl border border-white/90 rounded-2xl p-4 
      shadow-[0_4px_20px_rgba(12,12,12,0.05)] transition-all duration-200
      hover:shadow-[0_6px_24px_rgba(212,175,55,0.08)]">
      <div className="flex justify-center mb-3">
        <div className="relative">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FEFCE8] via-[#FEF9C3] to-[#FEF08A] 
            flex items-center justify-center border border-[#D4AF37]/20 shadow-[0_4px_16px_rgba(212,175,55,0.1)]">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8941F] 
              flex items-center justify-center shadow-[0_2px_8px_rgba(212,175,55,0.2)]">
              <Home className="w-4.5 h-4.5 text-white" />
            </div>
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white border border-[#D4AF37]/30 
            flex items-center justify-center shadow-sm">
            <span className="text-[8px] font-bold text-[#D4AF37]">{completedCount}/{totalCount}</span>
          </div>
        </div>
      </div>

      <div className="text-center">
        <h2 className="text-base font-bold text-gray-900 tracking-tight leading-tight">{property.address}</h2>
        <p className="text-[11px] text-gray-500 mt-1">
          {property.bedrooms} Bed {property.propertyDesignation} · {property.houseType}
        </p>

        <div className="mt-2.5 flex justify-center">
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${status.bg} border ${status.border}
              shadow-sm transition-all duration-200`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot} animate-pulse`} />
            <span className={`text-[10px] font-semibold ${status.text}`}>
              {status.label} · Est. {property.estimatedHandover}
            </span>
          </div>
        </div>
      </div>

      <div className="my-4 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/20 to-transparent" />

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Progress
          </span>
          <span className="text-xs font-bold text-[#D4AF37]">{progressPercent}%</span>
        </div>
        
        <div className="relative">
          <div className="h-2 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] via-[#FACC15] to-[#D4AF37] 
                transition-all duration-500
                shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          
          <div className="absolute inset-0 flex items-center justify-between px-0.5">
            {milestones.slice(0, 6).map((milestone, idx) => {
              const isCompleted = milestone.completed;
              const isCurrent = milestone.current;
              return (
                <div
                  key={milestone.id}
                  className={`w-3 h-3 rounded-full flex items-center justify-center transition-all duration-300
                    ${isCompleted 
                      ? 'bg-[#D4AF37] shadow-[0_0_6px_rgba(212,175,55,0.4)]' 
                      : isCurrent
                        ? 'bg-white border-[1.5px] border-[#D4AF37] shadow-sm'
                        : 'bg-gray-200 border border-gray-300'
                    }`}
                >
                  {isCompleted && <Check className="w-2 h-2 text-white" strokeWidth={3} />}
                  {isCurrent && <span className="w-1 h-1 rounded-full bg-[#D4AF37] animate-pulse" />}
                </div>
              );
            })}
          </div>
        </div>

        {currentMilestone && (
          <div className="mt-3 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg 
            bg-gradient-to-r from-[#FEFCE8]/50 to-[#FEF9C3]/50 border border-[#D4AF37]/10">
            <span className="w-2 h-2 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#FACC15] animate-pulse 
              shadow-[0_0_6px_rgba(212,175,55,0.4)]" />
            <span className="text-xs text-gray-700">
              <strong className="font-semibold text-gray-900">{currentMilestone.label}</strong>
              <span className="text-gray-400"> · Est. {currentMilestone.estimatedDate}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
