'use client';
export default function ShimmerOverlay() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.06), transparent)', animation: 'da-shimmer 3s ease-in-out infinite' }} />
    </div>
  );
}
