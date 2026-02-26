'use client';
import { RED } from '@/lib/dev-app/design-system';

interface BreathingDotProps { color?: string; size?: number; }

export default function BreathingDot({ color = RED, size = 8 }: BreathingDotProps) {
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <div style={{
        position: 'absolute',
        inset: -3,
        borderRadius: '50%',
        background: color,
        opacity: 0.2,
        animation: 'da-pulseRing 2s ease-in-out infinite',
      }} />
      <div style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        animation: 'da-breathe 2s ease-in-out infinite',
      }} />
    </div>
  );
}
