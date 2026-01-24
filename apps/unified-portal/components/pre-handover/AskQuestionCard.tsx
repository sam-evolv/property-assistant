'use client';

import { MessageSquare, ChevronRight } from 'lucide-react';

interface Props {
  onClick: () => void;
}

export function AskQuestionCard({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white/85 backdrop-blur border border-white/90 rounded-xl p-4 active:scale-[0.98] transition-transform shadow-[0_2px_12px_rgba(12,12,12,0.04)]"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B8941F] flex items-center justify-center shadow-[0_4px_20px_rgba(212,175,55,0.08)]">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-gray-900">Ask a Question</p>
          <p className="text-xs text-gray-500">Get instant answers about your home</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>
    </button>
  );
}
