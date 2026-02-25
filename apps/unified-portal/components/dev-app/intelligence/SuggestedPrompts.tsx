'use client';

import OHLogo from '../shared/OHLogo';

const PROMPTS = [
  'Does Unit 35 have a kitchen selected?',
  'Which units are ready for drawdown?',
  'Email the solicitor about Units 35, 37, 38',
  'Summarise Willow Brook pipeline status',
];

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
}

export default function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
      <div className="flex flex-col items-center mb-8">
        <OHLogo size={48} variant="full" />
        <p className="text-[13px] text-[#9ca3af] mt-2">Your on-site co-worker</p>
      </div>

      <div className="w-full space-y-2">
        {PROMPTS.map((prompt, i) => (
          <button
            key={i}
            onClick={() => onSelect(prompt)}
            className="w-full text-left p-3.5 rounded-xl border border-[#f3f4f6] bg-white transition-all active:scale-[0.97] hover:border-[#D4AF37]/30"
            style={{
              opacity: 0,
              animation: `devapp-fadeInUp 0.45s cubic-bezier(0.16,1,0.3,1) ${i * 80}ms forwards`,
            }}
          >
            <p className="text-[13px] text-[#111827] leading-snug">
              &ldquo;{prompt}&rdquo;
            </p>
          </button>
        ))}
      </div>

      <style jsx>{`
        @keyframes devapp-fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
