'use client';

import { forwardRef, useEffect, useRef } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { SUGGESTION_CHIPS } from './mock-data';

interface SmartSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export const SmartSearchBar = forwardRef<HTMLInputElement, SmartSearchBarProps>(
  function SmartSearchBar({ value, onChange }, ref) {
    const internalRef = useRef<HTMLInputElement>(null);
    const inputRef = (ref as React.RefObject<HTMLInputElement>) ?? internalRef;

    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          inputRef.current?.focus();
        }
      };
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }, [inputRef]);

    return (
      <div>
        <div
          className="flex items-center gap-2.5 bg-white border border-[#EAEAE4] rounded-lg px-3.5 py-2.5 shadow-sm transition-all duration-150 focus-within:border-[#D4AF37] focus-within:shadow-[0_0_0_3px_rgba(212,175,55,0.12)]"
        >
          <Search className="w-4 h-4 text-[#8A8A82] flex-shrink-0" strokeWidth={1.75} />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Search or ask anything, try 'warranties expiring in Q2' or 'all SolarEdge jobs'..."
            className="flex-1 bg-transparent border-none outline-none text-[14px] text-[#111111] placeholder:text-[#8A8A82]"
          />
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FDF9EB] border border-[#F0E2B0] rounded-full text-[11px] font-semibold text-[#D4AF37]">
            <Sparkles className="w-2.5 h-2.5" strokeWidth={2} />
            AI Search
          </span>
          <div className="flex gap-0.5">
            <span className="font-mono text-[10px] px-1.5 py-0.5 bg-[#F3F3EF] border border-[#EAEAE4] rounded text-[#8A8A82]">
              ⌘
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 bg-[#F3F3EF] border border-[#EAEAE4] rounded text-[#8A8A82]">
              K
            </span>
          </div>
        </div>

        <div className="flex gap-1.5 mt-3 flex-wrap">
          {SUGGESTION_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => onChange(chip)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#EAEAE4] rounded-full text-[12px] text-[#4B4B46] cursor-pointer transition-all duration-150 hover:bg-[#FDF9EB] hover:border-[#F0E2B0] hover:text-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
            >
              <Sparkles className="w-2.5 h-2.5 text-[#D4AF37]" strokeWidth={2} />
              {chip}
            </button>
          ))}
        </div>
      </div>
    );
  }
);
