'use client';

import { BG, T1, T3 } from '@/lib/agent/design-tokens';

export default function ProfileTab() {
  return (
    <div style={{ background: BG, minHeight: '100%', padding: '56px 16px 32px' }}>
      <div style={{ color: T1, fontSize: 20, fontWeight: 700 }}>Profile</div>
      <div style={{ color: T3, fontSize: 13, marginTop: 4 }}>Coming soon.</div>
    </div>
  );
}
