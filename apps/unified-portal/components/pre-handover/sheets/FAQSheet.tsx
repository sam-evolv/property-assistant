'use client';

import { SheetHeader } from '../BottomSheet';
import type { FAQ } from '../types';

// Icons
const KeyIcon = () => (
  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
);

const ClipboardIcon = () => (
  <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const LightningIcon = () => (
  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const WifiIcon = () => (
  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
  </svg>
);

const AlertIcon = () => (
  <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="chevron w-5 h-5 text-stone-400 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

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

const ICON_STYLES: Record<number, { bg: string; icon: React.ReactNode }> = {
  0: { bg: 'from-amber-100 to-amber-50', icon: <KeyIcon /> },
  1: { bg: 'from-violet-100 to-violet-50', icon: <ClipboardIcon /> },
  2: { bg: 'from-blue-100 to-blue-50', icon: <LightningIcon /> },
  3: { bg: 'from-emerald-100 to-emerald-50', icon: <WifiIcon /> },
  4: { bg: 'from-rose-100 to-rose-50', icon: <AlertIcon /> },
};

export function FAQSheet({ faqs }: FAQSheetProps) {
  const displayFaqs = faqs.length > 0 ? faqs : DEFAULT_FAQS;

  return (
    <>
      <SheetHeader title="Frequently Asked" />
      <div className="px-6 py-5 space-y-3 overflow-auto" style={{ maxHeight: 'calc(80vh - 100px)' }}>
        {displayFaqs.map((faq, index) => {
          const style = ICON_STYLES[index % 5];
          return (
            <details key={faq.id} className="group rounded-2xl bg-stone-50 overflow-hidden">
              <summary className="flex items-center gap-3 p-4 cursor-pointer list-none">
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${style.bg} flex items-center justify-center shrink-0`}
                >
                  {style.icon}
                </div>
                <span className="flex-1 text-sm font-medium text-brand-dark">{faq.question}</span>
                <ChevronDownIcon />
              </summary>
              <div className="px-4 pb-4 ml-[52px]">
                <p className="text-sm text-brand-muted leading-relaxed">{faq.answer}</p>
              </div>
            </details>
          );
        })}
      </div>

      <style jsx>{`
        details[open] summary .chevron {
          transform: rotate(180deg);
        }
        summary::-webkit-details-marker {
          display: none;
        }
      `}</style>
    </>
  );
}
