'use client';

import { DocumentCard } from './DocumentCard';
import { ChevronLeft, ChevronRight, FileX } from 'lucide-react';
import type { ArchiveDocument } from '@/lib/archive-constants';

interface DocumentGridProps {
  documents: ArchiveDocument[];
  isLoading?: boolean;
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onDocumentDeleted?: () => void;
}

export function DocumentGrid({ 
  documents, 
  isLoading, 
  page, 
  totalPages,
  totalCount,
  onPageChange,
  onDocumentDeleted
}: DocumentGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="p-5 rounded-xl border border-gray-800 bg-gray-900 animate-pulse"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg bg-gray-800" />
              <div className="flex-1">
                <div className="h-5 w-full bg-gray-800 rounded mb-2" />
                <div className="h-4 w-2/3 bg-gray-800 rounded" />
              </div>
            </div>
            <div className="flex gap-2 mb-4">
              <div className="h-5 w-16 bg-gray-800 rounded" />
              <div className="h-5 w-12 bg-gray-800 rounded" />
            </div>
            <div className="h-4 w-24 bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <div className="w-20 h-20 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-4">
          <FileX className="w-10 h-10 text-gray-600" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">No documents found</h3>
        <p className="text-gray-400 max-w-md mx-auto">
          There are no documents in this category yet. Upload documents and assign them to this discipline.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          Showing {documents.length} of {totalCount} documents
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((doc) => (
          <DocumentCard key={doc.id} document={doc} onDelete={onDocumentDeleted} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`
                    w-10 h-10 rounded-lg font-medium transition-colors
                    ${pageNum === page 
                      ? 'bg-gold-500 text-white' 
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                    }
                  `}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
