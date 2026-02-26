'use client';
import { GREEN } from '@/lib/dev-app/design-system';
interface BreathingDotProps { color?: string; size?: number; }
export default function BreathingDot({ color = GREEN, size = 8 }: BreathingDotProps) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size + 8, height: size + 8 }}>
      <span style={{ position: 'absolute', width: size + 6, height: size + 6, borderRadius: '50%', background: color, animation: 'da-pulseRing 2s ease-out infinite' }} />
      <span style={{ width: size, height: size, borderRadius: '50%', background: color, animation: 'da-breathe 2s ease-in-out infinite', position: 'relative', zIndex: 1 }} />
    </span>
  );
}
