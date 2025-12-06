'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  FileText, 
  FileImage, 
  FileSpreadsheet,
  File,
  Eye,
  Star,
  Sparkles,
  AlertTriangle,
  ExternalLink,
  Loader2,
  X
} from 'lucide-react';
import type { ArchiveDocument } from '@/lib/archive-constants';

interface DocumentCardProps {
  document: ArchiveDocument;
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File;
  if (mimeType.includes('pdf')) return FileText;
  if (mimeType.includes('image')) return FileImage;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return FileSpreadsheet;
  return File;
}

function getFileColor(mimeType: string | null) {
  if (!mimeType) return 'text-gray-400';
  if (mimeType.includes('pdf')) return 'text-red-400';
  if (mimeType.includes('image')) return 'text-blue-400';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'text-green-400';
  return 'text-gray-400';
}

export function DocumentCard({ document }: DocumentCardProps) {
  const [isViewing, setIsViewing] = useState(false);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [isLoadingView, setIsLoadingView] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  
  const FileIcon = getFileIcon(document.mime_type);
  const fileColor = getFileColor(document.mime_type);
  const extendedDoc = document as ArchiveDocument & { 
    must_read?: boolean; 
    ai_classified?: boolean;
  };

  const handleQuickView = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsLoadingView(true);
    setViewError(null);
    
    try {
      const res = await fetch(`/api/documents/${document.id}/view`);
      const data = await res.json();
      
      if (data.url) {
        setViewUrl(data.url);
        setIsViewing(true);
      } else if (data.error) {
        setViewError(data.error);
      }
    } catch (error) {
      console.error('Failed to get document URL:', error);
      setViewError('Failed to load document');
    } finally {
      setIsLoadingView(false);
    }
  };

  const handleOpenExternal = () => {
    if (viewUrl) {
      window.open(viewUrl, '_blank');
    }
  };

  const closeViewer = () => {
    setIsViewing(false);
    setViewUrl(null);
    setViewError(null);
  };
  
  return (
    <>
      <div className="group relative rounded-xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950 hover:border-gold-500/30 transition-all duration-200 overflow-hidden">
        <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
          {document.is_important && (
            <div className="w-6 h-6 rounded-full bg-gold-500 flex items-center justify-center" title="Important">
              <Star className="w-3.5 h-3.5 text-black fill-black" />
            </div>
          )}
          {extendedDoc.must_read && (
            <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center" title="Must Read">
              <AlertTriangle className="w-3.5 h-3.5 text-white" />
            </div>
          )}
          {extendedDoc.ai_classified && (
            <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center" title="AI Classified">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
          )}
        </div>

        <button
          onClick={handleQuickView}
          disabled={isLoadingView}
          className="w-full h-32 bg-gray-800/50 flex items-center justify-center relative group/preview cursor-pointer hover:bg-gray-800/70 transition-colors"
        >
          {isLoadingView ? (
            <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
          ) : (
            <>
              <FileIcon className={`w-16 h-16 ${fileColor} opacity-60`} />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/preview:opacity-100 transition-opacity bg-black/40">
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 backdrop-blur-sm text-white">
                  <Eye className="w-5 h-5" />
                  <span className="font-medium">Quick View</span>
                </div>
              </div>
            </>
          )}
        </button>

        <Link 
          href={`/developer/archive/document/${document.id}`}
          className="block p-4"
        >
          <h3 className="font-medium text-white truncate group-hover:text-gold-400 transition-colors text-sm">
            {document.title}
          </h3>
          <p className="text-xs text-gray-500 truncate mt-1">
            {document.file_name}
          </p>

          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {document.discipline && document.discipline !== 'other' && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-gold-500/10 text-gold-400 border border-gold-500/20">
                {document.discipline}
              </span>
            )}
            {document.house_type_code && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {document.house_type_code}
              </span>
            )}
          </div>
        </Link>
      </div>

      {isViewing && viewUrl && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col"
          onClick={closeViewer}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <FileIcon className={`w-6 h-6 ${fileColor}`} />
              <div>
                <h3 className="text-white font-medium">{document.title}</h3>
                <p className="text-gray-400 text-sm">{document.file_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); handleOpenExternal(); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open in New Tab</span>
              </button>
              <button
                onClick={closeViewer}
                className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div 
            className="flex-1 p-4 overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {document.mime_type?.includes('pdf') ? (
              <iframe
                src={viewUrl}
                className="w-full h-full rounded-lg bg-white"
                title={document.title}
              />
            ) : document.mime_type?.includes('image') ? (
              <div className="flex items-center justify-center h-full">
                <img 
                  src={viewUrl} 
                  alt={document.title}
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <FileIcon className={`w-24 h-24 ${fileColor} mb-4`} />
                <p className="text-gray-400 mb-4">Preview not available for this file type</p>
                <button
                  onClick={handleOpenExternal}
                  className="px-6 py-3 rounded-lg bg-gold-500 text-black font-semibold hover:bg-gold-400 transition-colors"
                >
                  Download File
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {viewError && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg bg-red-900/90 text-white border border-red-700">
          <p className="text-sm">{viewError}</p>
          <button 
            onClick={() => setViewError(null)}
            className="absolute top-1 right-1 p-1 hover:bg-red-800 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
}
