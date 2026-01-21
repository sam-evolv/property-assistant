'use client';

import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Upload,
  File,
  FileText,
  Image,
  FileSpreadsheet,
  FileArchive,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
} from 'lucide-react';

export interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

interface DragDropUploadProps {
  onUpload: (files: File[]) => Promise<void>;
  accept?: string;
  maxSize?: number; // in bytes
  maxFiles?: number;
  multiple?: boolean;
  className?: string;
  title?: string;
  description?: string;
  showFileList?: boolean;
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return Image;
  if (type.includes('pdf') || type.includes('document')) return FileText;
  if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')) return FileSpreadsheet;
  if (type.includes('zip') || type.includes('archive')) return FileArchive;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function FileItem({
  file,
  onRemove,
}: {
  file: UploadFile;
  onRemove: () => void;
}) {
  const Icon = getFileIcon(file.type);

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-all',
        file.status === 'complete' && 'bg-green-50 border-green-200',
        file.status === 'error' && 'bg-red-50 border-red-200',
        file.status === 'uploading' && 'bg-blue-50 border-blue-200',
        file.status === 'pending' && 'bg-white border-gray-200'
      )}
    >
      <div
        className={cn(
          'p-2 rounded-lg',
          file.status === 'complete' && 'bg-green-100',
          file.status === 'error' && 'bg-red-100',
          file.status === 'uploading' && 'bg-blue-100',
          file.status === 'pending' && 'bg-gray-100'
        )}
      >
        <Icon
          className={cn(
            'w-5 h-5',
            file.status === 'complete' && 'text-green-600',
            file.status === 'error' && 'text-red-600',
            file.status === 'uploading' && 'text-blue-600',
            file.status === 'pending' && 'text-gray-500'
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">{formatFileSize(file.size)}</span>
          {file.status === 'uploading' && (
            <span className="text-blue-600">{file.progress}%</span>
          )}
          {file.status === 'error' && file.error && (
            <span className="text-red-600">{file.error}</span>
          )}
        </div>

        {/* Progress bar */}
        {file.status === 'uploading' && (
          <div className="mt-2 h-1 bg-blue-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${file.progress}%` }}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {file.status === 'complete' && (
          <CheckCircle className="w-5 h-5 text-green-500" />
        )}
        {file.status === 'error' && (
          <AlertCircle className="w-5 h-5 text-red-500" />
        )}
        {file.status === 'uploading' && (
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
        )}

        <button
          onClick={onRemove}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        >
          {file.status === 'pending' ? (
            <X className="w-4 h-4" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}

export function DragDropUpload({
  onUpload,
  accept,
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = 10,
  multiple = true,
  className,
  title = 'Upload files',
  description,
  showFileList = true,
}: DragDropUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (maxSize && file.size > maxSize) {
        return `File too large (max ${formatFileSize(maxSize)})`;
      }

      if (accept) {
        const acceptedTypes = accept.split(',').map((t) => t.trim());
        const isValidType = acceptedTypes.some((type) => {
          if (type.startsWith('.')) {
            return file.name.toLowerCase().endsWith(type.toLowerCase());
          }
          if (type.endsWith('/*')) {
            const category = type.replace('/*', '');
            return file.type.startsWith(category);
          }
          return file.type === type;
        });

        if (!isValidType) {
          return 'File type not supported';
        }
      }

      return null;
    },
    [accept, maxSize]
  );

  const processFiles = useCallback(
    async (newFiles: File[]) => {
      const filesToAdd: UploadFile[] = [];

      for (const file of newFiles) {
        if (files.length + filesToAdd.length >= maxFiles) {
          break;
        }

        const error = validateFile(file);
        filesToAdd.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          progress: 0,
          status: error ? 'error' : 'pending',
          error: error || undefined,
        });
      }

      setFiles((prev) => [...prev, ...filesToAdd]);

      // Start upload for valid files
      const validFiles = filesToAdd.filter((f) => f.status === 'pending');
      if (validFiles.length > 0) {
        // Simulate progress updates
        validFiles.forEach((uploadFile) => {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id ? { ...f, status: 'uploading' } : f
            )
          );

          // Simulate upload progress
          let progress = 0;
          const interval = setInterval(() => {
            progress += Math.random() * 30;
            if (progress >= 100) {
              progress = 100;
              clearInterval(interval);
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === uploadFile.id
                    ? { ...f, progress: 100, status: 'complete' }
                    : f
                )
              );
            } else {
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === uploadFile.id
                    ? { ...f, progress: Math.round(progress) }
                    : f
                )
              );
            }
          }, 200);
        });

        // Actually upload
        try {
          await onUpload(validFiles.map((f) => f.file));
        } catch (error) {
          validFiles.forEach((uploadFile) => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadFile.id
                  ? {
                      ...f,
                      status: 'error',
                      error: error instanceof Error ? error.message : 'Upload failed',
                    }
                  : f
              )
            );
          });
        }
      }
    },
    [files.length, maxFiles, validateFile, onUpload]
  );

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    processFiles(multiple ? droppedFiles : [droppedFiles[0]]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    processFiles(selectedFiles);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleClearAll = () => {
    setFiles([]);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
          isDragging
            ? 'border-gold-500 bg-gold-50'
            : 'border-gray-300 hover:border-gold-400 hover:bg-gray-50'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
        />

        <div
          className={cn(
            'mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors',
            isDragging ? 'bg-gold-100' : 'bg-gray-100'
          )}
        >
          <Upload
            className={cn(
              'w-6 h-6 transition-colors',
              isDragging ? 'text-gold-600' : 'text-gray-400'
            )}
          />
        </div>

        <p className="text-sm font-medium text-gray-900 mb-1">{title}</p>
        <p className="text-xs text-gray-500">
          {description ||
            `Drag & drop files here, or click to browse. Max ${formatFileSize(maxSize)}`}
        </p>

        {accept && (
          <p className="text-xs text-gray-400 mt-2">
            Accepted: {accept.replace(/,/g, ', ')}
          </p>
        )}
      </div>

      {/* File List */}
      {showFileList && files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {files.length} file{files.length > 1 ? 's' : ''}
            </span>
            {files.length > 1 && (
              <button
                onClick={handleClearAll}
                className="text-xs font-medium text-gray-500 hover:text-red-500 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="space-y-2">
            {files.map((file) => (
              <FileItem
                key={file.id}
                file={file}
                onRemove={() => handleRemoveFile(file.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DragDropUpload;
