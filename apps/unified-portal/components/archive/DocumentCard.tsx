'use client';

import { 
  FileText, 
  FileImage, 
  FileSpreadsheet,
  File,
  Download,
  Eye,
  Star,
  Clock,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import type { ArchiveDocument } from '@/lib/archive';

interface DocumentCardProps {
  document: ArchiveDocument;
  onView?: (doc: ArchiveDocument) => void;
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File;
  if (mimeType.includes('pdf')) return FileText;
  if (mimeType.includes('image')) return FileImage;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return FileSpreadsheet;
  return File;
}

function formatFileSize(sizeKb: number | null) {
  if (!sizeKb) return '';
  if (sizeKb < 1024) return `${sizeKb} KB`;
  return `${(sizeKb / 1024).toFixed(1)} MB`;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IE', { 
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export function DocumentCard({ document, onView }: DocumentCardProps) {
  const FileIcon = getFileIcon(document.mime_type);
  const fileUrl = document.storage_url || document.file_url;
  const extendedDoc = document as ArchiveDocument & { 
    must_read?: boolean; 
    ai_classified?: boolean;
  };
  
  return (
    <div className="group relative p-5 rounded-xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950 hover:border-gold-500/30 transition-all duration-200">
      <div className="absolute -top-2 -right-2 flex items-center gap-1">
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

      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
          <FileIcon className="w-6 h-6 text-gray-400" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-white truncate group-hover:text-gold-400 transition-colors">
            {document.title}
          </h3>
          <p className="text-sm text-gray-500 truncate mt-0.5">
            {document.file_name}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {document.discipline && (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gold-500/10 text-gold-400 border border-gold-500/20">
            {document.discipline}
          </span>
        )}
        {document.house_type_code && (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
            {document.house_type_code}
          </span>
        )}
        {document.revision_code && (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Rev {document.revision_code}
          </span>
        )}
        {document.doc_kind && (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-300">
            {document.doc_kind}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-800">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="w-3.5 h-3.5" />
          <span>{formatDate(document.created_at)}</span>
          {document.size_kb && (
            <>
              <span className="mx-1">•</span>
              <span>{formatFileSize(document.size_kb)}</span>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onView && (
            <button
              onClick={() => onView(document)}
              className="p-1.5 rounded-md hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              title="Preview"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
          {fileUrl && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
