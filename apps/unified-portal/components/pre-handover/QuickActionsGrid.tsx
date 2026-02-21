'use client';

import { Clock, FileText, HelpCircle, Phone, LucideIcon } from 'lucide-react';

interface Props {
  onOpenSheet: (name: string) => void;
}

interface Action {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  bgGradient: string;
  iconColor: string;
}

const actions: Action[] = [
  {
    id: 'timeline',
    label: 'Timeline',
    description: 'Track progress',
    icon: Clock,
    bgGradient: 'bg-gradient-to-br from-[#FEFCE8] to-[#FEF9C3]',
    iconColor: 'text-[#A67C3A]',
  },
  {
    id: 'docs',
    label: 'Docs',
    description: 'Floor plans & more',
    icon: FileText,
    bgGradient: 'bg-gradient-to-br from-[#FEF9C3] to-[#FEF08A]',
    iconColor: 'text-[#8B6428]',
  },
  {
    id: 'faq',
    label: 'FAQ',
    description: 'Common questions',
    icon: HelpCircle,
    bgGradient: 'bg-gradient-to-br from-[#FDE047]/30 to-[#FACC15]/30',
    iconColor: 'text-[#B8941F]',
  },
  {
    id: 'contact',
    label: 'Contact',
    description: 'Get in touch',
    icon: Phone,
    bgGradient: 'bg-gradient-to-br from-[#D4AF37]/20 to-[#B8941F]/20',
    iconColor: 'text-[#D4AF37]',
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
            className="group bg-white/90 backdrop-blur-xl border border-white/90 rounded-xl pt-3 pb-3 px-2 text-center
              active:scale-[0.96] transition-all duration-200
              shadow-[0_2px_8px_rgba(12,12,12,0.03)] hover:shadow-[0_4px_12px_rgba(212,175,55,0.1)]
              hover:border-[#D4AF37]/20"
          >
            <div
              className={`w-9 h-9 mx-auto rounded-lg ${action.bgGradient} flex items-center justify-center mb-1.5
                border border-[#D4AF37]/10 group-hover:border-[#D4AF37]/25 transition-all duration-200
                group-hover:shadow-[0_0_12px_rgba(212,175,55,0.12)]`}
            >
              <Icon className={`w-4 h-4 ${action.iconColor} transition-transform duration-200 group-hover:scale-110`} />
            </div>
            <span className="text-[11px] font-semibold text-gray-700 group-hover:text-[#8B6428] transition-colors duration-200">
              {action.label}
            </span>
            <p className="text-[9px] text-gray-400 mt-0.5 leading-tight">{action.description}</p>
          </button>
        );
      })}
    </div>
  );
}
