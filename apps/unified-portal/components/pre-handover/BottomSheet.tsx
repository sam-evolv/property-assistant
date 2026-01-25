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
        className="absolute inset-0 bg-[#0B0B0B]/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet Content */}
      <div
        className={`absolute bottom-0 left-0 right-0 rounded-t-[28px] overflow-hidden transition-transform duration-[400ms] ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{
          maxHeight,
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FAFAF8 100%)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.12), 0 -2px 16px rgba(212,175,55,0.08)',
          transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        {children}
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
    <div className="sticky top-0 bg-white/95 backdrop-blur-xl px-6 py-5 border-b border-[#D4AF37]/10">
      <div className="w-12 h-1.5 bg-gradient-to-r from-[#D4AF37] to-[#FACC15] rounded-full mx-auto mb-4 
        shadow-[0_0_8px_rgba(212,175,55,0.3)]" />
      <h2 className="font-semibold text-xl text-gray-900 tracking-tight">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
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
      className={`group w-full flex items-center gap-4 p-4 rounded-2xl text-left 
        transition-all duration-[250ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]
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
