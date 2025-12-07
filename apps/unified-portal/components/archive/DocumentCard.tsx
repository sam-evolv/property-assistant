'use client';

import { useState } from 'react';
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
  X,
  Download
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
  const [isLoadingView, setIsLoadingView] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  
  const FileIcon = getFileIcon(document.mime_type);
  const fileColor = getFileColor(document.mime_type);
  const extendedDoc = document as ArchiveDocument & { 
    must_read?: boolean; 
    ai_classified?: boolean;
  };

  const getFileUrl = (): string | null => {
    if (document.file_url) return document.file_url;
    if (document.storage_url) return document.storage_url;
    return null;
  };

  const handleOpenPdf = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const url = getFileUrl();
    if (url) {
      window.open(url, '_blank');
    } else {
      setViewError('File URL not available');
      setTimeout(() => setViewError(null), 3000);
    }
  };

  const handleQuickView = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const url = getFileUrl();
    if (url) {
      setIsViewing(true);
    } else {
      setViewError('File URL not available');
      setTimeout(() => setViewError(null), 3000);
    }
  };

  const handleDownload = async () => {
    const url = getFileUrl();
    if (url) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = blobUrl;
        a.download = document.file_name || 'document';
        window.document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        window.document.body.removeChild(a);
      } catch (error) {
        console.error('Download failed:', error);
        window.open(url, '_blank');
      }
    }
  };

  const closeViewer = () => {
    setIsViewing(false);
    setViewError(null);
  };

  const viewUrl = getFileUrl();
  
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

        <button 
          onClick={handleOpenPdf}
          className="block w-full p-4 text-left"
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
        </button>
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
                onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-500 text-black font-medium hover:bg-gold-400 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); window.open(viewUrl, '_blank'); }}
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
                  onClick={() => window.open(viewUrl, '_blank')}
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
