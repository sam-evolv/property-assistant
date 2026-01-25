'use client';

import { SheetHeader } from '../BottomSheet';
import type { FAQ } from '../types';
import { Key, ClipboardCheck, Zap, Wifi, AlertTriangle, ChevronDown } from 'lucide-react';

interface FAQSheetProps {
  faqs: FAQ[];
}

const DEFAULT_FAQS: FAQ[] = [
  {
    id: '1',
    question: 'When will I get my keys?',
    answer: "Keys are handed over on closing day, after your solicitor confirms funds have transferred. This typically happens in the morning, and you'll meet our site manager at the property.",
  },
  {
    id: '2',
    question: 'What happens at snagging?',
    answer: "You'll walk through your new home with our site manager to identify any minor defects — things like paint touch-ups, door adjustments, or cosmetic issues. We'll fix everything before handover.",
  },
  {
    id: '3',
    question: 'How do I set up electricity?',
    answer: 'Contact your chosen supplier (Electric Ireland, Energia, etc.) before closing with the MPRN from your documents. Set this up at least 1 week before handover.',
  },
  {
    id: '4',
    question: 'What about broadband?',
    answer: "Fibre is available. Contact Virgin Media, Eir, or Sky 2-3 weeks before closing. They'll need your Eircode from your documents.",
  },
  {
    id: '5',
    question: 'What if something breaks?',
    answer: "Your home has a 2-year builder's warranty. After handover, use the Property Assistant to report issues and contact our aftercare team.",
  },
];

const ICON_STYLES = [
  { bg: 'from-[#FEFCE8] to-[#FEF9C3]', iconColor: 'text-[#A67C3A]', Icon: Key },
  { bg: 'from-[#FEF9C3] to-[#FEF08A]', iconColor: 'text-[#8B6428]', Icon: ClipboardCheck },
  { bg: 'from-[#FDE047]/30 to-[#FACC15]/30', iconColor: 'text-[#B8941F]', Icon: Zap },
  { bg: 'from-[#D4AF37]/15 to-[#B8941F]/15', iconColor: 'text-[#D4AF37]', Icon: Wifi },
  { bg: 'from-[#FEFCE8] to-[#FEF9C3]', iconColor: 'text-[#A67C3A]', Icon: AlertTriangle },
];

export function FAQSheet({ faqs }: FAQSheetProps) {
  const displayFaqs = faqs.length > 0 ? faqs : DEFAULT_FAQS;

  return (
    <>
      <SheetHeader title="Frequently Asked" />
      <div className="px-6 py-5 space-y-3 overflow-auto" style={{ maxHeight: 'calc(80vh - 100px)' }}>
        {displayFaqs.map((faq, index) => {
          const style = ICON_STYLES[index % 5];
          const Icon = style.Icon;
          return (
            <details key={faq.id} className="group rounded-2xl bg-gray-50/80 overflow-hidden
              border border-transparent hover:border-[#D4AF37]/15 transition-all duration-[250ms]">
              <summary className="flex items-center gap-3.5 p-4 cursor-pointer list-none">
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${style.bg} flex items-center justify-center shrink-0
                    border border-[#D4AF37]/10`}
                >
                  <Icon className={`w-5 h-5 ${style.iconColor}`} />
                </div>
                <span className="flex-1 text-sm font-medium text-gray-900">{faq.question}</span>
                <ChevronDown className="chevron w-5 h-5 text-gray-400 transition-transform duration-[250ms]" />
              </summary>
              <div className="px-4 pb-4 ml-[54px]">
                <p className="text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
              </div>
            </details>
          );
        })}
      </div>

      <style jsx>{`
        details[open] summary .chevron {
          transform: rotate(180deg);
        }
        details[open] {
          background: linear-gradient(to right, rgba(254, 252, 232, 0.6), rgba(254, 249, 195, 0.4));
          border-color: rgba(212, 175, 55, 0.15);
        }
        summary::-webkit-details-marker {
          display: none;
        }
      `}</style>
    </>
  );
}
