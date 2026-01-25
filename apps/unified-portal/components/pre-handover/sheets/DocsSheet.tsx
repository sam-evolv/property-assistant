'use client';

import { SheetHeader, SheetItem } from '../BottomSheet';
import type { Document } from '../types';
import { FileText, ChevronRight } from 'lucide-react';

interface DocsSheetProps {
  documents: Document[];
}

const DOC_TYPE_STYLES: Record<string, { bg: string; iconColor: string }> = {
  floor_plan: { bg: 'from-[#FEFCE8] to-[#FEF9C3]', iconColor: 'text-[#A67C3A]' },
  contract: { bg: 'from-[#FEF9C3] to-[#FEF08A]', iconColor: 'text-[#8B6428]' },
  kitchen: { bg: 'from-[#FDE047]/30 to-[#FACC15]/30', iconColor: 'text-[#B8941F]' },
  other: { bg: 'from-gray-100 to-gray-50', iconColor: 'text-gray-500' },
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
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#FEFCE8] to-[#FEF9C3] 
              flex items-center justify-center border border-[#D4AF37]/20">
              <FileText className="w-7 h-7 text-[#D4AF37]" />
            </div>
            <p className="text-sm text-gray-500">No documents available yet</p>
          </div>
        ) : (
          documents.map((doc) => {
            const style = DOC_TYPE_STYLES[doc.type] || DOC_TYPE_STYLES.other;
            return (
              <SheetItem key={doc.id} onClick={() => handleDocumentClick(doc)}>
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${style.bg} flex items-center justify-center
                    border border-[#D4AF37]/10 group-hover:shadow-[0_0_12px_rgba(212,175,55,0.15)] 
                    transition-all duration-[250ms]`}
                >
                  <FileText className={`w-6 h-6 ${style.iconColor}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{doc.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">PDF · {doc.size}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#D4AF37] 
                  group-hover:translate-x-0.5 transition-all duration-[250ms]" />
              </SheetItem>
            );
          })
        )}
      </div>
    </>
  );
}
