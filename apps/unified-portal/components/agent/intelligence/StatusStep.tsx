'use client';
import { useState } from 'react';
import { T } from '@/lib/agent/tokens';
import { Step } from '@/lib/agent/types';
import { PrimaryButton } from '../ui/PrimaryButton';
import { GhostButton } from '../ui/GhostButton';
import { CheckCircle, Bell, Check } from 'lucide-react';

export function StatusStep({ step }: { step: Step }) {
  const [confirmed, setConfirmed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const isReminder = step.type === 'reminder';

  return (
    <div style={{ padding: '14px 16px', opacity: dismissed ? 0.4 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: isReminder ? T.warnL : T.vioL,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isReminder ? <Bell size={14} color={T.warn} /> : <CheckCircle size={14} color={T.vio} />}
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.t2 }}>{step.action}</span>
      </div>

      {step.detail && (
        <p style={{ fontSize: 12, color: T.t3, lineHeight: 1.6, margin: '0 0 12px' }}>{step.detail}</p>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {confirmed ? (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 18px', borderRadius: 10,
            background: T.go, color: '#FFFFFF', fontSize: 13, fontWeight: 600,
          }}>
            <Check size={14} /> Done ✓
          </div>
        ) : !dismissed ? (
          <>
            <PrimaryButton onClick={() => setConfirmed(true)}><Check size={14} /> Confirm</PrimaryButton>
            <GhostButton onClick={() => setDismissed(true)}>Dismiss</GhostButton>
          </>
        ) : null}
      </div>
    </div>
  );
}
