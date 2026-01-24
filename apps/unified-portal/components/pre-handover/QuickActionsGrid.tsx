'use client';

import { Clock, FileText, HelpCircle, Phone, LucideIcon } from 'lucide-react';

interface Props {
  onOpenSheet: (name: string) => void;
}

interface Action {
  id: string;
  label: string;
  icon: LucideIcon;
  bgColor: string;
  iconColor: string;
}

const actions: Action[] = [
  {
    id: 'timeline',
    label: 'Timeline',
    icon: Clock,
    bgColor: 'bg-violet-50',
    iconColor: 'text-violet-500',
  },
  { id: 'docs', label: 'Docs', icon: FileText, bgColor: 'bg-blue-50', iconColor: 'text-blue-500' },
  { id: 'faq', label: 'FAQ', icon: HelpCircle, bgColor: 'bg-amber-50', iconColor: 'text-amber-500' },
  {
    id: 'contact',
    label: 'Contact',
    icon: Phone,
    bgColor: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
  },
];

export function QuickActionsGrid({ onOpenSheet }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            onClick={() => onOpenSheet(action.id)}
            className="bg-white/85 backdrop-blur border border-white/90 rounded-xl p-3 text-center active:scale-95 transition-transform shadow-[0_2px_12px_rgba(12,12,12,0.04)]"
          >
            <div
              className={`w-10 h-10 mx-auto rounded-xl ${action.bgColor} flex items-center justify-center mb-2`}
            >
              <Icon className={`w-5 h-5 ${action.iconColor}`} />
            </div>
            <span className="text-xs font-medium text-gray-600">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
