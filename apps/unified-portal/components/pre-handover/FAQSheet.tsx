'use client';

import { useState } from 'react';
import type { FAQ } from '@/lib/pre-handover/types';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  faqs: FAQ[];
}

export function FAQSheet({ faqs }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-5">Frequently Asked Questions</h2>

      <div className="space-y-3">
        {faqs.map((faq) => (
          <div key={faq.id} className="bg-gray-50 rounded-xl overflow-hidden">
            <button
              onClick={() => toggle(faq.id)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <span className="text-sm font-semibold text-gray-900 pr-4">{faq.question}</span>
              <ChevronDown
                className={cn(
                  'w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200',
                  openId === faq.id && 'rotate-180'
                )}
              />
            </button>

            <div
              className={cn(
                'overflow-hidden transition-all duration-200',
                openId === faq.id ? 'max-h-96' : 'max-h-0'
              )}
            >
              <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed">{faq.answer}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
