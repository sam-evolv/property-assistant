'use client';
import { T } from '@/lib/agent/tokens';
import { useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function BottomSheet({ open, onClose, children }: Props) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(13,13,24,0.35)',
        }}
      />
      {/* Sheet */}
      <div style={{
        position: 'relative', zIndex: 1,
        background: T.card,
        borderRadius: '20px 20px 0 0',
        padding: '24px 20px 32px',
        maxHeight: '88vh',
        overflowY: 'auto',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
      }}>
        {/* Handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: T.s3, margin: '0 auto 16px',
        }} />
        {children}
      </div>
    </div>
  );
}
