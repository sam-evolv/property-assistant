'use client';

interface ShimmerEffectProps {
  className?: string;
  children: React.ReactNode;
  active?: boolean;
}

export default function ShimmerEffect({
  className = '',
  children,
  active = true,
}: ShimmerEffectProps) {
  if (!active) return <>{children}</>;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {children}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(212,175,55,0.08) 50%, transparent)',
          backgroundSize: '200% 100%',
          animation: 'devapp-shimmer 3s linear infinite',
        }}
      />
      <style jsx>{`
        @keyframes devapp-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}
