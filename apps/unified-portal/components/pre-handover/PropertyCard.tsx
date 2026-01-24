'use client';

import type { Property, Milestone } from '@/lib/pre-handover/types';
import { Home } from 'lucide-react';

interface Props {
  property: Property;
  milestones: Milestone[];
}

export function PropertyCard({ property, milestones }: Props) {
  const completedCount = milestones.filter((m) => m.completed).length;
  const totalCount = milestones.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  const currentMilestone = milestones.find((m) => m.current);

  const statusConfig = {
    on_track: {
      bg: 'bg-gradient-to-r from-emerald-50 to-emerald-100',
      border: 'border-emerald-200',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500',
      label: 'On Track',
    },
    delayed: {
      bg: 'bg-gradient-to-r from-amber-50 to-amber-100',
      border: 'border-amber-200',
      text: 'text-amber-700',
      dot: 'bg-amber-500',
      label: 'Delayed',
    },
    at_risk: {
      bg: 'bg-gradient-to-r from-red-50 to-red-100',
      border: 'border-red-200',
      text: 'text-red-700',
      dot: 'bg-red-500',
      label: 'At Risk',
    },
  };

  const status = statusConfig[property.status];

  return (
    <div className="bg-white/85 backdrop-blur-xl border border-white/90 rounded-2xl p-5 shadow-[0_2px_12px_rgba(12,12,12,0.04)]">
      {/* Home Icon */}
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FEF9C3] to-[#FEFCE8] flex items-center justify-center border border-[#FEF08A]">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8941F] flex items-center justify-center shadow-[0_4px_20px_rgba(212,175,55,0.08)]">
            <Home className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>

      {/* Property Info */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900">{property.address}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {property.bedrooms} Bed {property.propertyDesignation} · {property.houseType}
        </p>

        {/* Status Badge */}
        <div className="mt-4 flex justify-center">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${status.bg} border ${status.border}`}
          >
            <span className={`w-2 h-2 rounded-full ${status.dot}`} />
            <span className={`text-xs font-semibold ${status.text}`}>
              {status.label} · Est. {property.estimatedHandover}
            </span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="my-5 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

      {/* Progress Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Progress
          </span>
          <span className="text-sm font-bold text-[#D4AF37]">{progressPercent}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#FACC15] transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Current Milestone */}
        {currentMilestone && (
          <div className="mt-3 flex items-center justify-center gap-2">
            <span
              className="w-2 h-2 rounded-full bg-[#D4AF37]"
              style={{ animation: 'pulse 2s ease-in-out infinite' }}
            />
            <span className="text-sm text-gray-600">
              <strong className="font-semibold text-gray-900">{currentMilestone.label}</strong>
              <span className="text-gray-400"> · Est. {currentMilestone.estimatedDate}</span>
            </span>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.4);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(212, 175, 55, 0);
          }
        }
      `}</style>
    </div>
  );
}
