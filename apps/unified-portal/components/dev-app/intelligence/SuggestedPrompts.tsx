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
      <div className="da-anim-scale flex flex-col items-center mb-6">
        <OHLogo size={48} />
        <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginTop: 14, marginBottom: 0 }}>
          OpenHouse Intelligence
        </h2>
        <p style={{ fontSize: 13, color: '#6b7280', fontWeight: 450, marginTop: 6, textAlign: 'center', lineHeight: 1.5 }}>
          Your on-site co-worker. Ask about any unit, check compliance,
          draft emails, and take action — all from here.
        </p>
      </div>

      <div style={{ fontSize: 11.5, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 12 }}>
        TRY ASKING
      </div>

      <div className="w-full space-y-2">
        {PROMPTS.map((prompt, i) => (
          <button
            key={i}
            onClick={() => onSelect(prompt)}
            className={`da-press da-anim-in da-s${Math.min(i + 1, 7)} w-full text-left`}
            style={{
              padding: '12px 16px',
              borderRadius: 14,
              border: 'none',
              background: '#f9fafb',
              cursor: 'pointer',
            }}
          >
            <p style={{ fontSize: 13.5, color: '#111827', lineHeight: 1.4, margin: 0, fontWeight: 500 }}>
              &ldquo;{prompt}&rdquo;
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
