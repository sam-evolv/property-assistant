'use client';

interface BreathingDotProps {
  color?: string;
  size?: number;
  className?: string;
}

export default function BreathingDot({
  color = '#059669',
  size = 8,
  className = '',
}: BreathingDotProps) {
  return (
    <span
      className={`relative inline-flex ${className}`}
      style={{ width: size, height: size }}
    >
      <span
        className="absolute inset-0 rounded-full animate-ping"
        style={{
          backgroundColor: color,
          opacity: 0.4,
          animationDuration: '2s',
        }}
      />
      <span
        className="relative inline-flex rounded-full"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
        }}
      />
    </span>
  );
}
