'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface MobileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  isDarkMode?: boolean;
}

export function MobileSheet({ isOpen, onClose, title, children, isDarkMode = false }: MobileSheetProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
      document.body.style.overflow = 'hidden';
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
        document.body.style.overflow = '';
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div 
        className={`
          absolute inset-0 bg-black/50 backdrop-blur-sm
          transition-opacity duration-300
          ${isAnimating ? 'opacity-100' : 'opacity-0'}
        `}
        onClick={onClose}
      />
      
      <div 
        ref={sheetRef}
        className={`
          absolute bottom-0 left-0 right-0
          max-h-[90vh] min-h-[200px]
          rounded-t-3xl
          ${isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white'}
          shadow-2xl
          transform transition-transform duration-300 ease-out
          ${isAnimating ? 'translate-y-0' : 'translate-y-full'}
          flex flex-col
          overflow-hidden
        `}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div 
            className={`w-10 h-1 rounded-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}
          />
        </div>
        
        {title && (
          <div className={`
            flex items-center justify-between px-5 pb-3
            border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-100'}
          `}>
            <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {title}
            </h2>
            <button 
              onClick={onClose}
              className={`
                p-2 -mr-2 rounded-full transition-colors
                active:scale-95
                ${isDarkMode 
                  ? 'text-gray-400 hover:bg-gray-800 active:bg-gray-700' 
                  : 'text-gray-500 hover:bg-gray-100 active:bg-gray-200'
                }
              `}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}

export default MobileSheet;
