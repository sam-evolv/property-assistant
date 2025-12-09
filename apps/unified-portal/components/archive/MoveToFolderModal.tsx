'use client';

import { useState, useEffect } from 'react';
import { X, Folder, FolderOpen, Loader2, Check } from 'lucide-react';
import type { ArchiveFolder } from './FolderCard';

interface MoveToFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMove: (folderId: string | null) => void;
  documentName: string;
  currentFolderId: string | null;
  tenantId: string;
  developmentId: string;
  discipline: string;
}

export function MoveToFolderModal({
  isOpen,
  onClose,
  onMove,
  documentName,
  currentFolderId,
  tenantId,
  developmentId,
  discipline,
}: MoveToFolderModalProps) {
  const [folders, setFolders] = useState<ArchiveFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId);
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadFolders();
    }
  }, [isOpen, tenantId, developmentId, discipline]);

  const loadFolders = async () => {
    setIsLoading(true);
    try {
      const urlParams = new URLSearchParams();
      urlParams.set('tenantId', tenantId);
      urlParams.set('developmentId', developmentId);
      urlParams.set('discipline', discipline);
      
      const response = await fetch(`/api/archive/folders?${urlParams}`);
      if (response.ok) {
        const data = await response.json();
        setFolders(data.folders || []);
      }
    } catch (error) {
      console.error('[MoveToFolder] Failed to load folders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMove = async () => {
    setIsMoving(true);
    try {
      onMove(selectedFolderId);
      onClose();
    } finally {
      setIsMoving(false);
    }
  };

  const handleClose = () => {
    setSelectedFolderId(currentFolderId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
      
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold-500/10 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-gold-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Move to Folder</h2>
              <p className="text-sm text-gray-400 truncate max-w-[200px]">{documentName}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-gold-400 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              <button
                onClick={() => setSelectedFolderId(null)}
                className={`w-full p-3 rounded-lg border transition-all flex items-center gap-3 ${
                  selectedFolderId === null
                    ? 'bg-gold-500/10 border-gold-500/50 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center">
                  <FolderOpen className="w-4 h-4 text-gray-400" />
                </div>
                <span className="flex-1 text-left">Root (No Folder)</span>
                {selectedFolderId === null && (
                  <Check className="w-5 h-5 text-gold-400" />
                )}
              </button>
              
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setSelectedFolderId(folder.id)}
                  className={`w-full p-3 rounded-lg border transition-all flex items-center gap-3 ${
                    selectedFolderId === folder.id
                      ? 'bg-gold-500/10 border-gold-500/50 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center">
                    <Folder className="w-4 h-4 text-gold-400" />
                  </div>
                  <span className="flex-1 text-left truncate">{folder.name}</span>
                  {selectedFolderId === folder.id && (
                    <Check className="w-5 h-5 text-gold-400" />
                  )}
                </button>
              ))}
              
              {folders.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  No folders created yet. Create a folder first.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-6">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-3 bg-gray-800 text-gray-300 font-medium rounded-xl hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleMove}
              disabled={isMoving || selectedFolderId === currentFolderId}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-gold-500 to-gold-600 text-black font-semibold rounded-xl hover:from-gold-400 hover:to-gold-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isMoving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Moving...
                </>
              ) : (
                'Move'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
