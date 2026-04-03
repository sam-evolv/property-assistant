'use client';

import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '48px 28px', textAlign: 'center',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: '#F9FAFB', border: '1px solid #E5E7EB',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
      }}>
        {icon}
      </div>
      <p style={{ color: '#111827', fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', margin: '0 0 6px' }}>
        {title}
      </p>
      <p style={{ color: '#6B7280', fontSize: 13, lineHeight: 1.6, margin: '0 0 20px', maxWidth: 240 }}>
        {subtitle}
      </p>
      {action && (
        <button onClick={action.onClick} className="interactive" style={{
          padding: '11px 22px', borderRadius: 12,
          background: '#111827', color: '#fff', border: 'none',
          fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)',
        }}>
          {action.label}
        </button>
      )}
    </div>
  );
}
