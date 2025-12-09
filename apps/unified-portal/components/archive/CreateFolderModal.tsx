'use client';

import { useState } from 'react';
import { X, Folder, Loader2 } from 'lucide-react';
import type { ArchiveFolder } from './FolderCard';

interface EditFolderData {
  id: string;
  name: string;
  color?: string | null;
}

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFolderCreated: (folder: ArchiveFolder) => void;
  tenantId: string;
  developmentId: string;
  discipline: string;
  parentFolderId?: string | null;
  editFolder?: EditFolderData | null;
}

const FOLDER_COLORS = [
  { id: 'default', name: 'Gold', color: 'bg-gold-400' },
  { id: 'blue', name: 'Blue', color: 'bg-blue-400' },
  { id: 'green', name: 'Green', color: 'bg-green-400' },
  { id: 'purple', name: 'Purple', color: 'bg-purple-400' },
  { id: 'red', name: 'Red', color: 'bg-red-400' },
  { id: 'orange', name: 'Orange', color: 'bg-orange-400' },
];

export function CreateFolderModal({
  isOpen,
  onClose,
  onFolderCreated,
  tenantId,
  developmentId,
  discipline,
  parentFolderId,
  editFolder,
}: CreateFolderModalProps) {
  const [name, setName] = useState(editFolder?.name || '');
  const [selectedColor, setSelectedColor] = useState(editFolder?.color || 'default');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!editFolder;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Please enter a folder name');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const url = '/api/archive/folders';
      const method = isEditing ? 'PATCH' : 'POST';
      const body = isEditing
        ? { 
            id: editFolder.id, 
            tenantId,
            developmentId,
            discipline,
            name: name.trim(), 
            color: selectedColor 
          }
        : {
            tenantId,
            developmentId,
            discipline,
            name: name.trim(),
            parentFolderId: parentFolderId || null,
            color: selectedColor,
          };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save folder');
      }

      const data = await response.json();
      onFolderCreated(data.folder);
      setName('');
      setSelectedColor('default');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save folder');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setSelectedColor('default');
    setError(null);
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
              <Folder className="w-5 h-5 text-gold-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {isEditing ? 'Rename Folder' : 'Create New Folder'}
              </h2>
              <p className="text-sm text-gray-400">
                {isEditing ? 'Update the folder name and colour' : 'Organise your documents into folders'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label htmlFor="folderName" className="block text-sm font-medium text-gray-300 mb-2">
              Folder Name
            </label>
            <input
              id="folderName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Warranties, Manuals, Certificates"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gold-500 transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Folder Colour
            </label>
            <div className="flex flex-wrap gap-3">
              {FOLDER_COLORS.map((colorOption) => (
                <button
                  key={colorOption.id}
                  type="button"
                  onClick={() => setSelectedColor(colorOption.id)}
                  className={`w-10 h-10 rounded-xl ${colorOption.color} transition-all ${
                    selectedColor === colorOption.id
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110'
                      : 'hover:scale-105'
                  }`}
                  title={colorOption.name}
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-3 bg-gray-800 text-gray-300 font-medium rounded-xl hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-gold-500 to-gold-600 text-black font-semibold rounded-xl hover:from-gold-400 hover:to-gold-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isEditing ? 'Saving...' : 'Creating...'}
                </>
              ) : (
                isEditing ? 'Save Changes' : 'Create Folder'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
