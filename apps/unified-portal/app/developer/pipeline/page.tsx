'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// =============================================================================
// Design Tokens - Refined Utility Aesthetic
// =============================================================================

const tokens = {
  bg: '#FFFFFF',
  bgSubtle: '#F8FAFC',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
};

// =============================================================================
// Types
// =============================================================================

interface DevelopmentStats {
  released: number;
  inProgress: number;
  handedOver: number;
}

interface Development {
  id: string;
  name: string;
  code: string;
  totalUnits: number;
  stats: DevelopmentStats;
}

// =============================================================================
// Development List Page - Pure Table, No Decoration
// =============================================================================

export default function PipelinePage() {
  const router = useRouter();
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDevelopments() {
      try {
        const response = await fetch('/api/pipeline');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setDevelopments(data.developments || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error');
      } finally {
        setIsLoading(false);
      }
    }
    fetchDevelopments();
  }, []);

  // Loading skeleton - minimal
  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: tokens.bg, fontFamily: "'DM Sans', sans-serif" }}>
        <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
        <div style={{ padding: '24px 32px' }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ height: '24px', width: '140px', backgroundColor: tokens.bgSubtle, borderRadius: '4px' }} />
          </div>
          <div style={{ border: `1px solid ${tokens.border}`, borderRadius: '8px', overflow: 'hidden' }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ height: '48px', borderBottom: i < 4 ? `1px solid ${tokens.borderLight}` : 'none', backgroundColor: tokens.bg }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state - minimal
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: tokens.bg, fontFamily: "'DM Sans', sans-serif" }}>
        <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: tokens.textMuted, fontSize: '14px', marginBottom: '16px' }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              color: tokens.bg,
              backgroundColor: tokens.text,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (developments.length === 0) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: tokens.bg, fontFamily: "'DM Sans', sans-serif" }}>
        <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
        <div style={{ padding: '24px 32px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: tokens.text, marginBottom: '24px' }}>
            Sales Pipeline
          </h1>
          <div style={{
            border: `1px solid ${tokens.border}`,
            borderRadius: '8px',
            padding: '64px 32px',
            textAlign: 'center',
          }}>
            <p style={{ color: tokens.textMuted, fontSize: '14px' }}>
              No developments found
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: tokens.bg, fontFamily: "'DM Sans', sans-serif" }}>
      <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>

      <div style={{ padding: '24px 32px' }}>
        {/* Page Title - Simple, no badges */}
        <h1 style={{
          fontSize: '18px',
          fontWeight: 600,
          color: tokens.text,
          marginBottom: '24px',
          letterSpacing: '-0.01em',
        }}>
          Sales Pipeline
        </h1>

        {/* Table Container */}
        <div style={{
          border: `1px solid ${tokens.border}`,
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: tokens.bg,
        }}>
          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: tokens.bgSubtle }}>
                <th style={{
                  height: '40px',
                  padding: '0 16px',
                  textAlign: 'left',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: tokens.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  borderBottom: `1px solid ${tokens.border}`,
                }}>
                  Development
                </th>
                <th style={{
                  height: '40px',
                  padding: '0 16px',
                  textAlign: 'right',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: tokens.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  borderBottom: `1px solid ${tokens.border}`,
                  width: '100px',
                }}>
                  Released
                </th>
                <th style={{
                  height: '40px',
                  padding: '0 16px',
                  textAlign: 'right',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: tokens.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  borderBottom: `1px solid ${tokens.border}`,
                  width: '100px',
                }}>
                  In Progress
                </th>
                <th style={{
                  height: '40px',
                  padding: '0 16px',
                  textAlign: 'right',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: tokens.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  borderBottom: `1px solid ${tokens.border}`,
                  width: '120px',
                }}>
                  Handed Over
                </th>
              </tr>
            </thead>
            <tbody>
              {developments.map((dev, index) => (
                <tr
                  key={dev.id}
                  onClick={() => router.push(`/developer/pipeline/${dev.id}`)}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: tokens.bg,
                    transition: 'background-color 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = tokens.bgSubtle;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = tokens.bg;
                  }}
                >
                  <td style={{
                    height: '48px',
                    padding: '0 16px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: tokens.text,
                    borderBottom: index < developments.length - 1 ? `1px solid ${tokens.borderLight}` : 'none',
                  }}>
                    {dev.name}
                  </td>
                  <td style={{
                    height: '48px',
                    padding: '0 16px',
                    textAlign: 'right',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: tokens.text,
                    fontVariantNumeric: 'tabular-nums',
                    borderBottom: index < developments.length - 1 ? `1px solid ${tokens.borderLight}` : 'none',
                  }}>
                    {dev.stats.released}
                  </td>
                  <td style={{
                    height: '48px',
                    padding: '0 16px',
                    textAlign: 'right',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: dev.stats.inProgress > 0 ? '#B45309' : tokens.textMuted,
                    fontVariantNumeric: 'tabular-nums',
                    borderBottom: index < developments.length - 1 ? `1px solid ${tokens.borderLight}` : 'none',
                  }}>
                    {dev.stats.inProgress}
                  </td>
                  <td style={{
                    height: '48px',
                    padding: '0 16px',
                    textAlign: 'right',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: dev.stats.handedOver > 0 ? '#047857' : tokens.textMuted,
                    fontVariantNumeric: 'tabular-nums',
                    borderBottom: index < developments.length - 1 ? `1px solid ${tokens.borderLight}` : 'none',
                  }}>
                    {dev.stats.handedOver}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
