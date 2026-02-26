'use client';
import { SURFACE_1, BORDER_LIGHT, TEXT_3 } from '@/lib/dev-app/design-system';
import { ChatAvatar } from './OHLogo';

export default function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
      <ChatAvatar size={26} />
      <div style={{
        display: 'flex', gap: 4, padding: '14px 18px',
        background: SURFACE_1, borderRadius: 20, borderBottomLeftRadius: 6,
        border: `1px solid ${BORDER_LIGHT}`,
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: '50%', background: '#9ca3af',
            animation: `da-typingBounce 1.4s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}
