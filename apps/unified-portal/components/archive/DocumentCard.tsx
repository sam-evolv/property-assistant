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
  MoreVertical,
  FolderInput
} from 'lucide-react';
import type { ArchiveDocument } from '@/lib/archive-constants';

interface DocumentCardProps {
  document: ArchiveDocument;
  onDelete?: (fileName: string) => void;
  onUpdate?: () => void;
  onMoveToFolder?: (document: ArchiveDocument) => void;
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

export function DocumentCard({ document, onDelete, onUpdate, onMoveToFolder }: DocumentCardProps) {
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
      className="group relative rounded-lg border border-gray-200 bg-white hover:border-gray-300 hover:shadow-md transition-all duration-150 overflow-hidden cursor-pointer"
    >
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
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
            title="More options"
          >
            <MoreVertical className="w-3.5 h-3.5 text-gray-700" />
          </button>
          {showMenu && (
            <div 
              className="absolute right-0 top-8 w-44 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-30"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => handleToggleFlag(e, 'isImportant')}
                disabled={isUpdating}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 transition-colors"
              >
                <Star className={`w-4 h-4 ${document.is_important ? 'text-gold-400 fill-gold-400' : 'text-gray-400'}`} />
                <span className="text-gray-700">{document.is_important ? 'Unmark Important' : 'Mark Important'}</span>
              </button>
              <button
                onClick={(e) => handleToggleFlag(e, 'mustRead')}
                disabled={isUpdating}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 transition-colors"
              >
                <AlertTriangle className={`w-4 h-4 ${extendedDoc.must_read ? 'text-red-400' : 'text-gray-400'}`} />
                <span className="text-gray-700">{extendedDoc.must_read ? 'Unmark Must Read' : 'Mark Must Read'}</span>
              </button>
              {onMoveToFolder && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMenu(false); onMoveToFolder(document); }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 transition-colors"
                >
                  <FolderInput className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">Move to Folder</span>
                </button>
              )}
              <div className="border-t border-gray-200 my-1" />
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

      {showDeleteConfirm && (
        <div 
          className="absolute inset-0 z-20 bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <Trash2 className="w-8 h-8 text-red-400 mb-3" />
          <p className="text-white text-sm font-medium text-center mb-1">Delete this document?</p>
          <p className="text-gray-400 text-xs text-center mb-4">This will remove it from the archive and AI assistant</p>
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

      {/* Styled preview panel */}
      {(() => {
        const disc = document.discipline || 'other';
        const gradients: Record<string, string> = {
          architectural: 'from-blue-50 to-indigo-100',
          structural:    'from-orange-50 to-amber-100',
          mechanical:    'from-cyan-50 to-teal-100',
          electrical:    'from-yellow-50 to-amber-100',
          plumbing:      'from-sky-50 to-blue-100',
          civil:         'from-stone-50 to-gray-100',
          landscape:     'from-green-50 to-emerald-100',
          handover:      'from-purple-50 to-violet-100',
          other:         'from-gray-50 to-slate-100',
        };
        const iconColors: Record<string, string> = {
          architectural: 'text-indigo-400',
          structural:    'text-amber-500',
          mechanical:    'text-teal-400',
          electrical:    'text-yellow-500',
          plumbing:      'text-blue-400',
          civil:         'text-stone-400',
          landscape:     'text-emerald-400',
          handover:      'text-violet-400',
          other:         'text-gray-400',
        };
        const abbr = (document.file_name || document.title || '')
          .replace(/\.[^.]+$/, '')
          .split(/[-_\s]/)
          .filter(Boolean)
          .slice(0, 3)
          .map((w: string) => w[0]?.toUpperCase() || '')
          .join('');
        const gradient = gradients[disc] || gradients.other;
        const iconColor = iconColors[disc] || iconColors.other;
        return (
          <div className={`w-full h-40 bg-gradient-to-br ${gradient} flex flex-col items-center justify-center relative group/preview overflow-hidden border-b border-gray-100`}>
            <FileIcon className={`w-10 h-10 ${iconColor} mb-2`} />
            <span className={`text-xs font-bold tracking-widest ${iconColor} opacity-70`}>{abbr}</span>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 z-10">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/20 backdrop-blur-sm text-white text-xs font-medium">
                <ExternalLink className="w-3.5 h-3.5" />
                Open
              </div>
            </div>
            {((document as any).version > 1 || (document as any).version_label) && (
              <div className="absolute top-1.5 right-1.5 z-20 px-1.5 py-0.5 rounded bg-blue-600 text-white text-[9px] font-bold leading-none">
                {(document as any).version_label || `v${(document as any).version}`}
              </div>
            )}
          </div>
        );
      })()}

      {/* Compact Procore-style metadata */}
      <div className="px-2.5 pt-2 pb-2.5">
        {/* Doc number — bold, prominent */}
        <p className="text-[11px] font-bold text-gray-900 leading-tight truncate">
          {document.file_name?.replace(/\.[^.]+$/, '') || document.title}
        </p>
        {/* Revision + house type on one line */}
        {(document.revision_code || document.house_type_code) && (
          <p className="text-[10px] text-gray-500 mt-0.5 truncate">
            {[
              document.revision_code ? `Rev. ${document.revision_code}` : null,
              document.house_type_code ? `House Type ${document.house_type_code}` : null,
            ].filter(Boolean).join(' · ')}
          </p>
        )}
        {/* Description — if title differs from filename */}
        {document.title && document.title !== document.file_name && (
          <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2 leading-snug">
            {document.title.replace(/^[A-Z0-9\-]+\s*[-–]?\s*/i, '')}
          </p>
        )}
      </div>
    </div>
  );
}
