'use client';

import { Clock, FileText, HelpCircle, Phone, LucideIcon } from 'lucide-react';

interface Props {
  onOpenSheet: (name: string) => void;
}

interface Action {
  id: string;
  label: string;
  icon: LucideIcon;
  bgGradient: string;
  iconColor: string;
}

const actions: Action[] = [
  {
    id: 'timeline',
    label: 'Timeline',
    icon: Clock,
    bgGradient: 'bg-gradient-to-br from-[#FEFCE8] to-[#FEF9C3]',
    iconColor: 'text-[#A67C3A]',
  },
  {
    id: 'docs',
    label: 'Docs',
    icon: FileText,
    bgGradient: 'bg-gradient-to-br from-[#FEF9C3] to-[#FEF08A]',
    iconColor: 'text-[#8B6428]',
  },
  {
    id: 'faq',
    label: 'FAQ',
    icon: HelpCircle,
    bgGradient: 'bg-gradient-to-br from-[#FDE047]/30 to-[#FACC15]/30',
    iconColor: 'text-[#B8941F]',
  },
  {
    id: 'contact',
    label: 'Contact',
    icon: Phone,
    bgGradient: 'bg-gradient-to-br from-[#D4AF37]/20 to-[#B8941F]/20',
    iconColor: 'text-[#D4AF37]',
  },
];

export function QuickActionsGrid({ onOpenSheet }: Props) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {actions.map((action, index) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            onClick={() => onOpenSheet(action.id)}
            className="group bg-white/90 backdrop-blur-xl border border-white/90 rounded-2xl p-4 text-center 
              active:scale-[0.96] transition-all duration-[250ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]
              shadow-[0_2px_12px_rgba(12,12,12,0.04)] hover:shadow-[0_4px_20px_rgba(212,175,55,0.12)]
              hover:border-[#D4AF37]/20"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div
              className={`w-11 h-11 mx-auto rounded-xl ${action.bgGradient} flex items-center justify-center mb-2.5
                border border-[#D4AF37]/10 group-hover:border-[#D4AF37]/30 transition-all duration-[250ms]
                group-hover:shadow-[0_0_16px_rgba(212,175,55,0.15)]`}
            >
              <Icon className={`w-5 h-5 ${action.iconColor} transition-transform duration-[250ms] group-hover:scale-110`} />
            </div>
            <span className="text-xs font-semibold text-gray-700 group-hover:text-[#8B6428] transition-colors duration-[250ms]">
              {action.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
