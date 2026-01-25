'use client';

import { MessageSquare, ChevronRight, Sparkles } from 'lucide-react';

interface Props {
  onClick: () => void;
}

export function AskQuestionCard({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="group w-full bg-gradient-to-r from-white/95 to-[#FEFCE8]/60 backdrop-blur-xl 
        border border-[#D4AF37]/20 rounded-xl p-3 
        active:scale-[0.98] transition-all duration-200
        shadow-[0_2px_12px_rgba(212,175,55,0.06)] hover:shadow-[0_4px_16px_rgba(212,175,55,0.12)]
        hover:border-[#D4AF37]/25"
    >
      <div className="flex items-center gap-2.5">
        <div className="relative">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#D4AF37] to-[#B8941F] 
            flex items-center justify-center shadow-[0_2px_8px_rgba(212,175,55,0.2)]
            group-hover:shadow-[0_4px_12px_rgba(212,175,55,0.28)] transition-all duration-200">
            <MessageSquare className="w-4 h-4 text-white group-hover:scale-110 transition-transform duration-200" />
          </div>
          <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-gradient-to-br from-[#FACC15] to-[#D4AF37] 
            flex items-center justify-center shadow-sm">
            <Sparkles className="w-2.5 h-2.5 text-white" />
          </div>
        </div>
        <div className="flex-1 text-left">
          <p className="text-xs font-semibold text-gray-900">Ask a Question</p>
          <p className="text-[10px] text-gray-500 leading-tight">Get instant answers about your home</p>
        </div>
        <ChevronRight className="w-4 h-4 text-[#D4AF37] group-hover:translate-x-0.5 transition-transform duration-200" />
      </div>
    </button>
  );
}
