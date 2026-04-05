'use client';

interface TimelineTrackProps {
  depositDate: string | null;
  contractsDate: string | null;
  signedDate: string | null;
  closingDate: string | null;
}

const STAGES = [
  { key: 'depositDate', label: 'DEPOSIT' },
  { key: 'contractsDate', label: 'CONTRACTS' },
  { key: 'signedDate', label: 'SIGNED' },
  { key: 'closingDate', label: 'CLOSING' },
] as const;

export default function TimelineTrack({
  depositDate,
  contractsDate,
  signedDate,
  closingDate,
}: TimelineTrackProps) {
  const dates: Record<string, string | null> = {
    depositDate,
    contractsDate,
    signedDate,
    closingDate,
  };

  const completed = STAGES.map(s => !!dates[s.key]);

  return (
    <div
      style={{
        borderTop: '1px solid rgba(0,0,0,0.04)',
        borderBottom: '1px solid rgba(0,0,0,0.04)',
        padding: '12px 0',
      }}
    >
      {/* Track row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          padding: '0 4px',
        }}
      >
        {STAGES.map((stage, i) => (
          <div key={stage.key} style={{ display: 'contents' }}>
            {/* Dot */}
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                flexShrink: 0,
                zIndex: 1,
                ...(completed[i]
                  ? {
                      background: 'linear-gradient(135deg, #10B981, #059669)',
                      boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.15)',
                    }
                  : {
                      background: 'transparent',
                      border: '1.5px solid rgba(0,0,0,0.15)',
                    }),
              }}
            />
            {/* Connector (between dots, not after last) */}
            {i < STAGES.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 1.5,
                  margin: '0 4px',
                  ...(completed[i] && completed[i + 1]
                    ? {
                        background: 'linear-gradient(90deg, #10B981, #059669)',
                      }
                    : {
                        background:
                          'repeating-linear-gradient(90deg, transparent 0px, transparent 3px, rgba(0,0,0,0.12) 3px, rgba(0,0,0,0.12) 7px)',
                      }),
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Labels row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
          padding: '0 0',
        }}
      >
        {STAGES.map((stage, i) => (
          <div
            key={stage.key + '-label'}
            style={{
              textAlign: 'center',
              flex: 1,
            }}
          >
            <div
              style={{
                fontSize: 8.5,
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase' as const,
                color: completed[i] ? '#10B981' : '#A0A8B0',
                lineHeight: 1,
              }}
            >
              {stage.label}
            </div>
            {dates[stage.key] && (
              <div
                style={{
                  fontSize: 9,
                  color: '#9CA3AF',
                  marginTop: 2,
                  lineHeight: 1,
                }}
              >
                {formatDate(dates[stage.key]!)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}
