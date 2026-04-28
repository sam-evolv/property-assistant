'use client';

export default function LettingsComingSoon({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 32px 80px',
        textAlign: 'center',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <p
        style={{
          color: '#9EA8B5',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          margin: '0 0 8px',
        }}
      >
        {title}
      </p>
      <p
        style={{
          color: '#6B7280',
          fontSize: 14,
          lineHeight: 1.5,
          margin: 0,
          maxWidth: 280,
        }}
      >
        {body}
      </p>
    </div>
  );
}
