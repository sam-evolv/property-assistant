'use client';
import { useState } from 'react';
import { T } from '@/lib/agent/tokens';
import { Step } from '@/lib/agent/types';
import { GoldButton } from '../ui/GoldButton';
import { GhostButton } from '../ui/GhostButton';
import { TrendingUp, Send, Check } from 'lucide-react';

export function ReportStep({ step }: { step: Step }) {
  const [sent, setSent] = useState(false);

  return (
    <div style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: T.goL, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <TrendingUp size={14} color={T.go} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.t2 }}>{step.action}</span>
      </div>

      {step.detail && (
        <div style={{
          background: T.s1, border: `1px solid ${T.line}`, borderRadius: 10,
          padding: '10px 12px', marginBottom: 12,
        }}>
          <p style={{ fontSize: 12, color: T.t2, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>
            {step.detail}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {sent ? (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 18px', borderRadius: 10,
            background: T.go, color: '#FFFFFF', fontSize: 13, fontWeight: 600,
          }}>
            <Check size={14} /> Sent ✓
          </div>
        ) : (
          <>
            <GoldButton onClick={() => setSent(true)}><Send size={14} /> Send to Developer</GoldButton>
            <GhostButton>Edit</GhostButton>
          </>
        )}
      </div>
    </div>
  );
}
