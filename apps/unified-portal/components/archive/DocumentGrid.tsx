'use client';

import { DocumentCard } from './DocumentCard';
import { DocumentListItem } from './DocumentListItem';
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
  onMoveToFolder?: (document: ArchiveDocument) => void;
  viewMode?: 'grid' | 'list';
}

export function DocumentGrid({ 
  documents, 
  isLoading, 
  page, 
  totalPages,
  totalCount,
  onPageChange,
  onDocumentDeleted,
  onMoveToFolder,
  viewMode = 'grid'
}: DocumentGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white animate-pulse overflow-hidden">
            <div className="w-full h-40 bg-gray-100" />
            <div className="px-2.5 pt-2 pb-2.5 space-y-1.5">
              <div className="h-3 w-full bg-gray-100 rounded" />
              <div className="h-2.5 w-2/3 bg-gray-100 rounded" />
              <div className="h-2.5 w-3/4 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <FileX className="w-10 h-10 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No documents found</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          There are no documents in this category yet. Upload documents and assign them to this discipline.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing {documents.length} of {totalCount} documents
        </p>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {documents.map((doc) => (
            <DocumentCard key={doc.id} document={doc} onDelete={onDocumentDeleted} onUpdate={onDocumentDeleted} onMoveToFolder={onMoveToFolder} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <DocumentListItem key={doc.id} document={doc} onDelete={onDocumentDeleted} onUpdate={onDocumentDeleted} onMoveToFolder={onMoveToFolder} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900'
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
            className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
