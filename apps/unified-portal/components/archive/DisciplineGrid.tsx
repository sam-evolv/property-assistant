'use client';

import { Plus, Folder, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { DisciplineCard } from './DisciplineCard';
import type { DisciplineSummary } from '@/lib/archive-constants';

export interface CustomDisciplineFolder {
  id: string;
  name: string;
  tenant_id: string;
  development_id: string;
  discipline: string;
  color: string | null;
  icon: string | null;
  document_count?: number;
}

interface DisciplineGridProps {
  disciplines: DisciplineSummary[];
  customFolders?: CustomDisciplineFolder[];
  isLoading?: boolean;
  showNewFolderButton?: boolean;
  alwaysShowCategories?: boolean;
  onCreateFolder?: () => void;
  onEditFolder?: (folder: CustomDisciplineFolder) => void;
  onDeleteFolder?: (folderId: string) => void;
}

export function DisciplineGrid({ 
  disciplines, 
  customFolders = [],
  isLoading,
  showNewFolderButton = false,
  alwaysShowCategories = false,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
}: DisciplineGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="p-6 rounded-2xl border border-gray-200 bg-white animate-pulse"
          >
            <div className="w-14 h-14 rounded-xl bg-gray-100 mb-4" />
            <div className="h-5 w-32 bg-gray-100 rounded mb-2" />
            <div className="h-4 w-20 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (disciplines.length === 0 && customFolders.length === 0 && !showNewFolderButton && !alwaysShowCategories) {
    return (
      <div className="text-center py-16 px-6">
        <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No documents yet</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          Upload documents to this development to organise them in the Smart Archive.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {disciplines.map((discipline) => (
        <DisciplineCard key={discipline.discipline} discipline={discipline} />
      ))}
      
      {customFolders.map((folder) => (
        <CustomDisciplineFolderCard
          key={folder.id}
          folder={folder}
          onEdit={onEditFolder}
          onDelete={onDeleteFolder}
        />
      ))}
      
      {showNewFolderButton && (
        <button
          onClick={onCreateFolder}
          className="group p-6 rounded-2xl border-2 border-dashed border-gray-200 hover:border-gold-500/50 bg-transparent hover:bg-gray-50 transition-all duration-200 flex flex-col items-center justify-center gap-3 min-h-[160px]"
        >
          <div className="w-14 h-14 rounded-xl bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center transition-colors">
            <Plus className="w-7 h-7 text-gray-500 group-hover:text-gold-400 transition-colors" />
          </div>
          <span className="text-gray-500 group-hover:text-gray-700 font-medium transition-colors">
            New Category
          </span>
        </button>
      )}
    </div>
  );
}

function CustomDisciplineFolderCard({
  folder,
  onEdit,
  onDelete,
}: {
  folder: CustomDisciplineFolder;
  onEdit?: (folder: CustomDisciplineFolder) => void;
  onDelete?: (folderId: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const folderColor = folder.color || '#6b7280';
  
  const handleMenuClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu(false);
    onEdit?.(folder);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu(false);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete?.(folder.id);
    setShowDeleteConfirm(false);
  };

  return (
    <Link
      href={`/developer/archive/custom/${folder.id}`}
      className="group relative p-6 rounded-2xl border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 transition-all duration-200"
    >
      {(onEdit || onDelete) && (
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={handleMenuClick}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 opacity-0 group-hover:opacity-100 transition-all"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMenu(false);
                }}
              />
              <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[140px]">
                <button
                  onClick={handleEdit}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  Rename
                </button>
                <button
                  onClick={handleDeleteClick}
                  className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-100 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {showDeleteConfirm && (
        <div 
          className="absolute inset-0 bg-white/95 rounded-2xl flex flex-col items-center justify-center p-4 z-20"
          onClick={(e) => e.preventDefault()}
        >
          <p className="text-gray-900 text-sm text-center mb-3">Delete "{folder.name}"?</p>
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDeleteConfirm(false);
              }}
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-500"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
        style={{ backgroundColor: `${folderColor}20` }}
      >
        <Folder className="w-7 h-7" style={{ color: folderColor }} />
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-gold-300 transition-colors">
        {folder.name}
      </h3>
      <p className="text-gray-500 text-sm">
        {folder.document_count ?? 0} files
        {(folder.document_count ?? 0) === 0 && (
          <span className="text-gray-500 ml-2">No files yet</span>
        )}
      </p>
    </Link>
  );
}
