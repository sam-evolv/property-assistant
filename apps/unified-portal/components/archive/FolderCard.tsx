'use client';

import { useState } from 'react';
import { 
  Folder,
  FolderOpen,
  MoreVertical,
  Trash2,
  Pencil,
  Loader2
} from 'lucide-react';

export interface ArchiveFolder {
  id: string;
  tenant_id: string;
  development_id: string;
  discipline: string;
  name: string;
  parent_folder_id: string | null;
  color: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface FolderCardProps {
  folder: ArchiveFolder;
  documentCount?: number;
  onClick?: () => void;
  onEdit?: (folder: ArchiveFolder) => void;
  onDelete?: (folderId: string) => void;
}

const FOLDER_COLORS: Record<string, string> = {
  default: 'text-gold-400',
  blue: 'text-blue-400',
  green: 'text-green-400',
  purple: 'text-purple-400',
  red: 'text-red-400',
  orange: 'text-orange-400',
};

export function FolderCard({ folder, documentCount = 0, onClick, onEdit, onDelete }: FolderCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const folderColor = folder.color ? FOLDER_COLORS[folder.color] || FOLDER_COLORS.default : FOLDER_COLORS.default;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      const response = await fetch('/api/archive/folders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: folder.id }),
      });

      if (response.ok) {
        onDelete?.(folder.id);
      } else {
        const data = await response.json();
        console.error('Failed to delete folder:', data.error);
        alert(data.error || 'Failed to delete folder');
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onEdit?.(folder);
  };

  const FolderIcon = isHovered ? FolderOpen : Folder;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative rounded-xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950 hover:border-gold-500/30 hover:shadow-lg hover:shadow-gold-500/10 transition-all duration-200 overflow-hidden cursor-pointer"
    >
      <div className="absolute top-2 right-2 z-10">
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="w-6 h-6 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
            title="More options"
          >
            <MoreVertical className="w-3.5 h-3.5 text-gray-300" />
          </button>
          {showMenu && (
            <div
              className="absolute right-0 top-8 w-44 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 z-30"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleEdit}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-800 flex items-center gap-2 transition-colors"
              >
                <Pencil className="w-4 h-4 text-gray-400" />
                <span className="text-gray-200">Rename Folder</span>
              </button>
              <div className="border-t border-gray-700 my-1" />
              <button
                onClick={handleDelete}
                className="w-full px-3 py-2 text-left text-sm hover:bg-red-500/20 flex items-center gap-2 text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Folder</span>
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
          <p className="text-white text-sm font-medium text-center mb-1">Delete this folder?</p>
          <p className="text-gray-400 text-xs text-center mb-4">Documents will be moved to the root level</p>
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

      <div className="w-full h-32 bg-gray-800/50 flex items-center justify-center relative">
        <FolderIcon className={`w-16 h-16 ${folderColor} transition-transform duration-200 ${isHovered ? 'scale-110' : ''}`} />
      </div>

      <div className="p-4">
        <h3 className="font-medium text-white truncate group-hover:text-gold-400 transition-colors text-sm">
          {folder.name}
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          {documentCount === 0 ? 'Empty folder' : `${documentCount} document${documentCount !== 1 ? 's' : ''}`}
        </p>
      </div>
    </div>
  );
}
