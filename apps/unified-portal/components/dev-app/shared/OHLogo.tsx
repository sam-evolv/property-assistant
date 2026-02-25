'use client';

interface OHLogoProps {
  size?: number;
  variant?: 'icon' | 'full' | 'icon-gold';
  className?: string;
}

export default function OHLogo({ size = 24, variant = 'icon', className = '' }: OHLogoProps) {
  const goldColor = '#D4AF37';
  const darkColor = '#111827';
  const fillColor = variant === 'icon-gold' ? goldColor : darkColor;

  if (variant === 'full') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <path
            d="M16 3L3 13h4v14h18V13h4L16 3z"
            fill={fillColor}
          />
          <rect x="13" y="19" width="6" height="8" rx="1" fill="white" />
        </svg>
        <span
          className="font-bold tracking-tight"
          style={{
            fontSize: size * 0.65,
            color: darkColor,
            letterSpacing: '-0.02em',
          }}
        >
          OpenHouse
          <span style={{ color: goldColor }}> AI</span>
        </span>
      </div>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path
        d="M16 3L3 13h4v14h18V13h4L16 3z"
        fill={fillColor}
      />
      <rect x="13" y="19" width="6" height="8" rx="1" fill="white" />
    </svg>
  );
}

export function ChatAvatar({ size = 30 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: 'rgba(212,175,55,0.08)',
      }}
    >
      <OHLogo size={size - 8} variant="icon-gold" />
    </div>
  );
}
