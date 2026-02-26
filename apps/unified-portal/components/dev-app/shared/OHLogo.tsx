'use client';
import { GOLD, TEXT_1 } from '@/lib/dev-app/design-system';
interface OHLogoProps { size?: number; color?: string; }
export default function OHLogo({ size = 24, color = GOLD }: OHLogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="10" fill={`${color}12`} />
      <path d="M20 8L10 15V28H16V22H24V28H30V15L20 8Z" fill={color} fillOpacity="0.9" />
      <rect x="17" y="17" width="6" height="5" rx="0.5" fill="white" fillOpacity="0.9" />
    </svg>
  );
}
export function OHLogoFull({ height = 20 }: { height?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <OHLogo size={height * 1.4} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{ fontSize: height * 0.75, fontWeight: 800, color: TEXT_1, letterSpacing: '-0.03em' }}>OpenHouse</span>
        <span style={{ fontSize: height * 0.45, fontWeight: 700, color: GOLD, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 1 }}>Intelligence</span>
      </div>
    </div>
  );
}
export function ChatAvatar({ size = 26 }: { size?: number }) {
  return <OHLogo size={size} />;
}
