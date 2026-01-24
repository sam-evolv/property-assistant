'use client';

import { useEffect, useCallback } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: string;
}

export function BottomSheet({ isOpen, onClose, children, maxHeight = '75vh' }: BottomSheetProps) {
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-300 ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet Content */}
      <div
        className={`absolute bottom-0 left-0 right-0 rounded-t-3xl overflow-hidden transition-transform duration-400 ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{
          maxHeight,
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FAF8F3 100%)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.12)',
          transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Sheet Header Component
interface SheetHeaderProps {
  title: string;
  subtitle?: string;
}

export function SheetHeader({ title, subtitle }: SheetHeaderProps) {
  return (
    <div className="sticky top-0 bg-white px-6 py-5 border-b border-stone-100">
      <div className="w-12 h-1.5 bg-stone-200 rounded-full mx-auto mb-4" />
      <h2 className="font-serif text-xl text-brand-dark">{title}</h2>
      {subtitle && <p className="text-sm text-brand-muted mt-1">{subtitle}</p>}
    </div>
  );
}

// Sheet Item Component
interface SheetItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  highlight?: boolean;
}

export function SheetItem({ children, onClick, className = '', highlight = false }: SheetItemProps) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-4 rounded-2xl bg-stone-50 text-left transition-all hover:bg-brand-gold/5 ${
        highlight ? 'bg-brand-gold/5' : ''
      } ${className}`}
    >
      {children}
    </Component>
  );
}
