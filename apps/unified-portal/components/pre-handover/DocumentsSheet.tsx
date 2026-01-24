'use client';

import type { Document } from '@/lib/pre-handover/types';
import { FileText, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  documents: Document[];
}

const iconColors: Record<string, { bg: string; text: string }> = {
  red: { bg: 'bg-red-100', text: 'text-red-500' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-500' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-500' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-500' },
  violet: { bg: 'bg-violet-100', text: 'text-violet-500' },
};

export function DocumentsSheet({ documents }: Props) {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-5">Your Documents</h2>

      <div className="space-y-3">
        {documents.map((doc) => {
          const colors = iconColors[doc.iconColor] || iconColors.blue;

          return (
            <a
              key={doc.id}
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 active:scale-[0.98] transition-transform"
            >
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', colors.bg)}>
                <FileText className={cn('w-5 h-5', colors.text)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{doc.name}</p>
                <p className="text-xs text-gray-500">
                  {doc.type} · {doc.size}
                </p>
              </div>
              <Download className="w-5 h-5 text-gray-400 shrink-0" />
            </a>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 text-center mt-5">Documents matched to your house type</p>
    </div>
  );
}
