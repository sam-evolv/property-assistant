'use client';

import { GOLD } from '@/lib/dev-app/design-system';

interface OHLogoProps {
  size?: number;
  variant?: 'icon' | 'full' | 'stacked';
  className?: string;
}

export default function OHLogo({ size = 24, variant = 'icon', className = '' }: OHLogoProps) {
  const src =
    variant === 'icon'
      ? '/oh-logo-icon.png'
      : variant === 'full'
        ? '/oh-logo-horizontal.png'
        : '/oh-logo-stacked.png';

  const width = variant === 'full' ? size * 3.5 : size;
  const height = size;

  return (
    <img
      src={src}
      alt="OpenHouse AI"
      width={width}
      height={height}
      className={className}
      style={{ objectFit: 'contain', mixBlendMode: 'multiply' }}
    />
  );
}

export function OHLogoFull({ height = 20 }: { height?: number }) {
  return <OHLogo size={height} variant="full" />;
}

export function ChatAvatar({ size = 26 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `${GOLD}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <img
        src="/oh-logo-icon.png"
        alt="OpenHouse AI"
        width={size * 0.65}
        height={size * 0.65}
        style={{ objectFit: 'contain', mixBlendMode: 'multiply' }}
      />
    </div>
  );
}
