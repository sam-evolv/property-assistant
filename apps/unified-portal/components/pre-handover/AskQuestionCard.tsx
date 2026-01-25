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
        border border-[#D4AF37]/20 rounded-2xl p-4 
        active:scale-[0.98] transition-all duration-[250ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]
        shadow-[0_2px_16px_rgba(212,175,55,0.08)] hover:shadow-[0_4px_24px_rgba(212,175,55,0.15)]
        hover:border-[#D4AF37]/30"
    >
      <div className="flex items-center gap-3.5">
        <div className="relative">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B8941F] 
            flex items-center justify-center shadow-[0_4px_16px_rgba(212,175,55,0.25)]
            group-hover:shadow-[0_4px_20px_rgba(212,175,55,0.35)] transition-all duration-[250ms]">
            <MessageSquare className="w-5 h-5 text-white group-hover:scale-110 transition-transform duration-[250ms]" />
          </div>
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-[#FACC15] to-[#D4AF37] 
            flex items-center justify-center shadow-sm">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-gray-900">Ask a Question</p>
          <p className="text-xs text-gray-500">Get instant answers about your home</p>
        </div>
        <ChevronRight className="w-5 h-5 text-[#D4AF37] group-hover:translate-x-1 transition-transform duration-[250ms]" />
      </div>
    </button>
  );
}
