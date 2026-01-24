'use client';

import { SheetHeader, SheetItem } from '../BottomSheet';
import type { Document } from '../types';

// Icons
const FileIcon = ({ color }: { color: string }) => (
  <svg className={`w-6 h-6 ${color}`} fill="currentColor" viewBox="0 0 24 24">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4z" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-5 h-5 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

interface DocsSheetProps {
  documents: Document[];
}

const DOC_TYPE_STYLES: Record<string, { bg: string; color: string }> = {
  floor_plan: { bg: 'from-red-100 to-red-50', color: 'text-red-500' },
  contract: { bg: 'from-blue-100 to-blue-50', color: 'text-blue-500' },
  kitchen: { bg: 'from-emerald-100 to-emerald-50', color: 'text-emerald-500' },
  other: { bg: 'from-stone-100 to-stone-50', color: 'text-stone-500' },
};

export function DocsSheet({ documents }: DocsSheetProps) {
  const handleDocumentClick = (doc: Document) => {
    window.open(doc.url, '_blank');
  };

  return (
    <>
      <SheetHeader title="Documents" />
      <div className="px-6 py-5 space-y-3">
        {documents.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-brand-muted">No documents available yet</p>
          </div>
        ) : (
          documents.map((doc) => {
            const style = DOC_TYPE_STYLES[doc.type] || DOC_TYPE_STYLES.other;
            return (
              <SheetItem key={doc.id} onClick={() => handleDocumentClick(doc)}>
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${style.bg} flex items-center justify-center`}
                >
                  <FileIcon color={style.color} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-brand-dark">{doc.name}</p>
                  <p className="text-xs text-brand-muted mt-0.5">PDF · {doc.size}</p>
                </div>
                <ChevronRightIcon />
              </SheetItem>
            );
          })
        )}
      </div>
    </>
  );
}
