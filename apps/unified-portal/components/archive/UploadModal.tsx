'use client';

import { useState, useRef, useCallback } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { DISCIPLINES, type DisciplineType } from '@/lib/archive';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
  tenantId: string;
  developmentId: string;
  houseTypes?: Array<{ id: string; house_type_code: string; name: string | null }>;
}

interface FileUploadState {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  discipline?: string;
}

export function UploadModal({
  isOpen,
  onClose,
  onUploadComplete,
  tenantId,
  developmentId,
  houseTypes = [],
}: UploadModalProps) {
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [discipline, setDiscipline] = useState<DisciplineType | ''>('');
  const [houseTypeId, setHouseTypeId] = useState<string>('');
  const [isImportant, setIsImportant] = useState(false);
  const [mustRead, setMustRead] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const newFiles: FileUploadState[] = Array.from(selectedFiles).map(file => ({
      file,
      status: 'pending' as const,
    }));

    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles) return;

    const newFiles: FileUploadState[] = Array.from(droppedFiles).map(file => ({
      file,
      status: 'pending' as const,
    }));

    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadComplete(false);

    const formData = new FormData();
    formData.append('tenantId', tenantId);
    formData.append('developmentId', developmentId);
    formData.append('metadata', JSON.stringify({
      discipline: discipline || null,
      houseTypeId: houseTypeId || null,
      isImportant,
      mustRead,
    }));

    files.forEach(({ file }) => {
      formData.append('files', file);
    });

    setFiles(prev => prev.map(f => ({ ...f, status: 'uploading' as const })));

    try {
      const response = await fetch('/developer/api/archive/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      setFiles(prev => prev.map((f, i) => ({
        ...f,
        status: 'success' as const,
        discipline: result.uploaded[i]?.discipline,
      })));

      setUploadComplete(true);
      
      setTimeout(() => {
        onUploadComplete();
        handleClose();
      }, 1500);
    } catch (error) {
      console.error('[Upload] Error:', error);
      setFiles(prev => prev.map(f => ({
        ...f,
        status: 'error' as const,
        error: error instanceof Error ? error.message : 'Upload failed',
      })));
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setFiles([]);
      setDiscipline('');
      setHouseTypeId('');
      setIsImportant(false);
      setMustRead(false);
      setUploadComplete(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  const disciplineOptions = Object.entries(DISCIPLINES).map(([key, value]) => ({
    value: key as DisciplineType,
    label: value.label,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      <div className="relative w-full max-w-2xl bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-xl font-semibold text-white">Upload Documents</h2>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-gold-500/50 hover:bg-gray-800/30 transition-all"
          >
            <Upload className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-300 font-medium">
              Drag & drop files here or click to browse
            </p>
            <p className="text-gray-500 text-sm mt-1">
              PDF, DOCX, Images (max 50MB each)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.tiff"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-400">Selected Files ({files.length})</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {files.map((fileState, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg"
                  >
                    <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{fileState.file.name}</p>
                      <p className="text-xs text-gray-500">
                        {(fileState.file.size / 1024).toFixed(1)} KB
                        {fileState.discipline && (
                          <span className="ml-2 text-gold-400">• {fileState.discipline}</span>
                        )}
                      </p>
                    </div>
                    {fileState.status === 'pending' && (
                      <button
                        onClick={() => removeFile(index)}
                        className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {fileState.status === 'uploading' && (
                      <Loader2 className="w-5 h-5 text-gold-400 animate-spin" />
                    )}
                    {fileState.status === 'success' && (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    )}
                    {fileState.status === 'error' && (
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Discipline (optional)
              </label>
              <select
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value as DisciplineType | '')}
                disabled={isUploading}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-gold-500 disabled:opacity-50"
              >
                <option value="">Auto-detect</option>
                {disciplineOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Leave blank to let AI classify
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                House Type (optional)
              </label>
              <select
                value={houseTypeId}
                onChange={(e) => setHouseTypeId(e.target.value)}
                disabled={isUploading}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-gold-500 disabled:opacity-50"
              >
                <option value="">Auto-detect from filename</option>
                {houseTypes.map(ht => (
                  <option key={ht.id} value={ht.id}>
                    {ht.house_type_code} {ht.name ? `- ${ht.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={isImportant}
                  onChange={(e) => setIsImportant(e.target.checked)}
                  disabled={isUploading}
                  className="sr-only peer"
                />
                <div className="w-5 h-5 border-2 border-gray-600 rounded peer-checked:bg-gold-500 peer-checked:border-gold-500 transition-colors" />
                <CheckCircle className="absolute inset-0 w-5 h-5 text-black opacity-0 peer-checked:opacity-100" />
              </div>
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                Mark as Important
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={mustRead}
                  onChange={(e) => setMustRead(e.target.checked)}
                  disabled={isUploading}
                  className="sr-only peer"
                />
                <div className="w-5 h-5 border-2 border-gray-600 rounded peer-checked:bg-red-500 peer-checked:border-red-500 transition-colors" />
                <CheckCircle className="absolute inset-0 w-5 h-5 text-white opacity-0 peer-checked:opacity-100" />
              </div>
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                Must-Read Document
              </span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800 bg-gray-900/50">
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || isUploading || uploadComplete}
            className="px-6 py-2.5 text-sm font-semibold bg-gradient-to-r from-gold-500 to-gold-600 text-black rounded-lg hover:from-gold-400 hover:to-gold-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : uploadComplete ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Complete!
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload {files.length > 0 ? `(${files.length})` : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
