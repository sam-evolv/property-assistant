'use client';

import { Sparkles, ClipboardCheck, FileText, Users } from 'lucide-react';

interface QuickActionsProps {
  onAction: (action: string) => void;
}

const ACTIONS = [
  { id: 'ask-intel', label: 'Ask Intelligence', icon: Sparkles, color: '#D4AF37' },
  { id: 'log-visit', label: 'Log Site Visit', icon: ClipboardCheck, color: '#059669' },
  { id: 'view-compliance', label: 'Compliance', icon: FileText, color: '#2563eb' },
  { id: 'homeowners', label: 'Homeowners', icon: Users, color: '#7c3aed' },
];

export default function QuickActions({ onAction }: QuickActionsProps) {
  return (
    <div className="px-4 pb-4">
      <h2 className="text-[12px] font-semibold text-[#6b7280] uppercase tracking-wider mb-2">
        Quick Actions
      </h2>
      <div className="grid grid-cols-4 gap-2">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => onAction(action.id)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-[#f3f4f6] bg-white transition-all active:scale-[0.95]"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${action.color}10` }}
              >
                <Icon size={20} style={{ color: action.color }} />
              </div>
              <span className="text-[10px] font-medium text-[#6b7280] text-center leading-tight">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
