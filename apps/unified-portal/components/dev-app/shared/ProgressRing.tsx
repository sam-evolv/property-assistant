'use client';
import { GOLD, SURFACE_2, TEXT_1, EASE_PREMIUM } from '@/lib/dev-app/design-system';
interface ProgressRingProps { percent: number; size?: number; stroke?: number; color?: string; delay?: number; }
export default function ProgressRing({ percent, size = 44, stroke = 3, color = GOLD, delay = 300 }: ProgressRingProps) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const target = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={SURFACE_2} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={circ} strokeLinecap="round"
        style={{ '--circ': circ, '--target': target, animation: `da-ringDraw 1.4s ${EASE_PREMIUM} ${delay}ms both` } as any} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        fill={TEXT_1} fontSize={size * 0.26} fontWeight="700" letterSpacing="-0.02em"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>
        {percent}%
      </text>
    </svg>
  );
}
