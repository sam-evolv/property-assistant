'use client';
import { T } from '@/lib/agent/tokens';

const STAGES = [
  { key: 'deposit', label: 'Deposit' },
  { key: 'contracts', label: 'Contracts' },
  { key: 'signed', label: 'Signed' },
  { key: 'closing', label: 'Closing' },
];

interface Props {
  depositDate?: string | null;
  contractsDate?: string | null;
  contractsSignedDate?: string | null;
  closingDate?: string | null;
}

function formatShortDate(d: string): string {
  try {
    const date = new Date(d);
    return date.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
  } catch {
    return d;
  }
}

export function TimelineTrack({ depositDate, contractsDate, contractsSignedDate, closingDate }: Props) {
  const dates = [depositDate, contractsDate, contractsSignedDate, closingDate];
  const done = dates.map(d => !!d);

  return (
    <div style={{
      borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}`,
      padding: '12px 0', margin: '10px 0',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
        {STAGES.map((stage, i) => (
          <div key={stage.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            {i > 0 && (
              <div style={{
                position: 'absolute', top: 3, right: '50%', width: '100%', height: 1,
                background: (done[i] && done[i - 1]) ? T.go : T.s2,
              }} />
            )}
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: done[i] ? T.go : T.s2,
              position: 'relative', zIndex: 1,
            }} />
            <span style={{ fontSize: 9, fontWeight: 600, marginTop: 4, color: done[i] ? T.go : T.t4 }}>
              {stage.label}
            </span>
            {dates[i] && (
              <span style={{ fontSize: 9, color: T.t4, marginTop: 1 }}>
                {formatShortDate(dates[i]!)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
