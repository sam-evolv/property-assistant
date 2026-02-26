'use client';
import { useState, useEffect } from 'react';
import { GREEN, TEXT_1, TEXT_2 } from '@/lib/dev-app/design-system';
import type { Sector } from '@/lib/dev-app/design-system';
import BreathingDot from './BreathingDot';
export default function LiveBar({ sector }: { sector: Sector }) {
  const [count, setCount] = useState(2);
  useEffect(() => {
    const iv = setInterval(() => setCount(c => c === 2 ? 3 : 2), 8000);
    return () => clearInterval(iv);
  }, []);
  const label = sector === 'bts' ? 'purchasers' : sector === 'btr' ? 'tenants' : 'students';
  return (
    <div className="da-anim-in da-s1" style={{
      margin: '0 20px', padding: '10px 16px', borderRadius: 12,
      background: `linear-gradient(135deg, ${GREEN}06, ${GREEN}10)`,
      border: `1px solid ${GREEN}15`,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <BreathingDot color={GREEN} size={7} />
      <span style={{ fontSize: 12.5, color: TEXT_2, fontWeight: 500 }}>
        <strong style={{ color: TEXT_1, fontWeight: 700 }}>{count}</strong> {label} active in the app right now
      </span>
    </div>
  );
}
