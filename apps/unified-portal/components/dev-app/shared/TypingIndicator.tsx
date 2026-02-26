'use client';
import { SURFACE_1, BORDER_LIGHT, TEXT_3 } from '@/lib/dev-app/design-system';
export default function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '14px 18px', background: SURFACE_1, borderRadius: 20, borderBottomLeftRadius: 6, border: `1px solid ${BORDER_LIGHT}`, width: 'fit-content' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: TEXT_3, animation: 'da-typingBounce 1.4s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  );
}
