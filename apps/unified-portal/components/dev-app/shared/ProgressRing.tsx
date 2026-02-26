'use client';
import { TEXT_1, EASE_PREMIUM } from '@/lib/dev-app/design-system';

interface ProgressRingProps {
  percent: number;
  size?: number;
  stroke?: number;
  color?: string;
  delay?: number;
}

export default function ProgressRing({ percent, size = 48, stroke = 3.5, color, delay = 300 }: ProgressRingProps) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const target = circ - (percent / 100) * circ;
  const ringColor = color || (percent >= 70 ? '#059669' : percent >= 40 ? '#d97706' : '#dc2626');

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={ringColor} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={circ} strokeLinecap="round"
        style={{
          '--circ': `${circ}`,
          '--target': `${target}`,
          animation: `da-ringDraw 1.2s ${EASE_PREMIUM} ${delay}ms both`,
        } as React.CSSProperties} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        fill={TEXT_1} fontSize={size * 0.24} fontWeight="700"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>
        {percent}%
      </text>
    </svg>
  );
}
