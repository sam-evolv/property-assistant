'use client';

import { useEffect, useCallback } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: string;
}

export function BottomSheet({ isOpen, onClose, children, maxHeight = '70vh' }: BottomSheetProps) {
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
      className={`fixed inset-0 z-50 transition-opacity duration-250 ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        className="absolute inset-0 bg-[#0B0B0B]/35 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={`absolute bottom-0 left-0 right-0 rounded-t-[24px] transition-transform duration-[350ms] ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{
          maxHeight,
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FAFAF8 100%)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.12), 0 -2px_12px rgba(212,175,55,0.08)',
          transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          borderRadius: '24px 24px 0 0',
          overflow: 'hidden',
        }}
      >
        <div className="overflow-auto" style={{ maxHeight }}>
          {children}
        </div>
      </div>
    </div>
  );
}

interface SheetHeaderProps {
  title: string;
  subtitle?: string;
}

export function SheetHeader({ title, subtitle }: SheetHeaderProps) {
  return (
    <div className="sticky top-0 bg-white/98 backdrop-blur-2xl px-5 pt-3 pb-2.5 border-b border-[#D4AF37]/10
      rounded-t-[20px]">
      <div className="w-10 h-1 bg-gradient-to-r from-[#D4AF37] via-[#FACC15] to-[#D4AF37] rounded-full mx-auto mb-3 
        shadow-[0_0_8px_rgba(212,175,55,0.3)]" />
      <h2 className="font-semibold text-base text-gray-900 tracking-tight">{title}</h2>
      {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

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
      className={`group w-full flex items-center gap-3 p-3 rounded-xl text-left 
        transition-all duration-200
        ${highlight 
          ? 'bg-gradient-to-r from-[#FEFCE8]/80 to-[#FEF9C3]/60 border border-[#D4AF37]/20' 
          : 'bg-gray-50/80 hover:bg-[#FEFCE8]/60 border border-transparent hover:border-[#D4AF37]/15'
        }
        ${onClick ? 'active:scale-[0.98] cursor-pointer' : ''} 
        ${className}`}
    >
      {children}
    </Component>
  );
}
