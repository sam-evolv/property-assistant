'use client';

import { useState } from 'react';
import { 
  FileText, 
  FileImage, 
  FileSpreadsheet,
  File,
  Star,
  Sparkles,
  AlertTriangle,
  ExternalLink,
  Trash2,
  Loader2,
  MoreVertical
} from 'lucide-react';
import type { ArchiveDocument } from '@/lib/archive-constants';

interface DocumentListItemProps {
  document: ArchiveDocument;
  onDelete?: (fileName: string) => void;
  onUpdate?: () => void;
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

export function DocumentListItem({ document, onDelete, onUpdate }: DocumentListItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const FileIcon = getFileIcon(document.mime_type);
  const fileColor = getFileColor(document.mime_type);
  const extendedDoc = document as ArchiveDocument & { 
    must_read?: boolean; 
    ai_classified?: boolean;
  };

  const handleToggleFlag = async (e: React.MouseEvent, flag: 'isImportant' | 'mustRead') => {
    e.stopPropagation();
    setIsUpdating(true);
    try {
      const currentValue = flag === 'isImportant' ? document.is_important : extendedDoc.must_read;
      const response = await fetch('/api/archive/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: document.file_name || document.title,
          [flag]: !currentValue,
        }),
      });
      
      if (response.ok) {
        onUpdate?.();
      } else {
        console.error('Failed to update document');
      }
    } catch (error) {
      console.error('Error updating document:', error);
    } finally {
      setIsUpdating(false);
      setShowMenu(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      const response = await fetch('/api/archive/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: document.file_name || document.title }),
      });
      
      if (response.ok) {
        onDelete?.(document.file_name || document.title);
      } else {
        console.error('Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  const handleOpen = () => {
    if (document.file_url) {
      window.open(document.file_url, '_blank');
      return;
    }
    if (document.storage_url) {
      window.open(document.storage_url, '_blank');
      return;
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
    if (projectRef && document.file_name) {
      const url = `https://${projectRef}.supabase.co/storage/v1/object/public/development_docs/57dc3919-2725-4575-8046-9179075ac88e/${document.file_name}`;
      window.open(url, '_blank');
    }
  };
  
  return (
    <div 
      onClick={handleOpen}
      className="group relative flex items-center gap-4 p-4 rounded-xl border border-gray-800 bg-gradient-to-r from-gray-900 to-gray-950 hover:border-gold-500/30 hover:bg-gray-800/50 transition-all cursor-pointer"
    >
      {showDeleteConfirm && (
        <div 
          className="absolute inset-0 z-20 bg-black/90 rounded-xl flex items-center justify-center gap-4 px-4"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-white text-sm">Delete this document?</p>
          <div className="flex gap-2">
            <button
              onClick={cancelDelete}
              disabled={isDeleting}
              className="px-3 py-1.5 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              disabled={isDeleting}
              className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-400 transition-colors flex items-center gap-1.5"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </button>
          </div>
        </div>
      )}

      <div className={`w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0`}>
        <FileIcon className={`w-5 h-5 ${fileColor}`} />
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-white truncate group-hover:text-gold-400 transition-colors text-sm">
          {document.title}
        </h3>
        <p className="text-xs text-gray-500 truncate">
          {document.file_name}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
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

      <div className="flex items-center gap-1 flex-shrink-0">
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

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); handleOpen(); }}
          className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
          title="Open document"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
            title="More options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {showMenu && (
            <div 
              className="absolute right-0 top-10 w-44 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 z-30"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => handleToggleFlag(e, 'isImportant')}
                disabled={isUpdating}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-800 flex items-center gap-2 transition-colors"
              >
                <Star className={`w-4 h-4 ${document.is_important ? 'text-gold-400 fill-gold-400' : 'text-gray-400'}`} />
                <span className="text-gray-200">{document.is_important ? 'Unmark Important' : 'Mark Important'}</span>
              </button>
              <button
                onClick={(e) => handleToggleFlag(e, 'mustRead')}
                disabled={isUpdating}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-800 flex items-center gap-2 transition-colors"
              >
                <AlertTriangle className={`w-4 h-4 ${extendedDoc.must_read ? 'text-red-400' : 'text-gray-400'}`} />
                <span className="text-gray-200">{extendedDoc.must_read ? 'Unmark Must Read' : 'Mark Must Read'}</span>
              </button>
              <div className="border-t border-gray-700 my-1" />
              <button
                onClick={handleDelete}
                className="w-full px-3 py-2 text-left text-sm hover:bg-red-500/20 flex items-center gap-2 text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Document</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
