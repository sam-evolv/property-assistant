'use client';
import { T } from '@/lib/agent/tokens';
import { Step } from '@/lib/agent/types';
import { EmailStep } from './EmailStep';
import { StatusStep } from './StatusStep';
import { ReportStep } from './ReportStep';
import { Zap } from 'lucide-react';

export function TaskResponse({ steps }: { steps: Step[] }) {
  return (
    <div style={{
      background: T.card, borderRadius: 16, border: `1px solid ${T.line}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '14px 16px', borderBottom: `1px solid ${T.line}`,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 8,
          background: T.goldL, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Zap size={12} color={T.gold} fill={T.gold} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.t1, flex: 1 }}>Intelligence</span>
        <span style={{ fontSize: 11, color: T.t3 }}>{steps.length} step{steps.length !== 1 ? 's' : ''}</span>
      </div>

      {steps.map((step, i) => (
        <div key={i} style={{ borderBottom: i < steps.length - 1 ? `1px solid ${T.line}` : 'none' }}>
          {step.type === 'email' && <EmailStep step={step} />}
          {(step.type === 'status' || step.type === 'reminder') && <StatusStep step={step} />}
          {step.type === 'report' && <ReportStep step={step} />}
        </div>
      ))}
    </div>
  );
}
