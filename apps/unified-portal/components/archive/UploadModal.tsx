'use client';

import { useState, useRef, useCallback } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { DISCIPLINES, type DisciplineType } from '@/lib/archive-constants';

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
  status: 'pending' | 'uploading' | 'indexed' | 'failed';
  error?: string;
  discipline?: string;
  chunksIndexed?: number;
  totalChunks?: number;
  indexingErrors?: string[];
}

interface ApiFileResult {
  fileName: string;
  success: boolean;
  documentId?: string;
  chunksIndexed?: number;
  totalChunks?: number;
  error?: string;
  indexingErrors?: string[];
  phases: {
    storage: 'pending' | 'success' | 'failed';
    dbWrite: 'pending' | 'success' | 'failed';
    indexing: 'pending' | 'success' | 'failed' | 'partial';
    verification: 'pending' | 'success' | 'failed';
  };
}

interface ApiResponse {
  success: boolean;
  summary?: {
    total: number;
    succeeded: number;
    failed: number;
  };
  files?: ApiFileResult[];
  error?: string;
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
  const [uploadResult, setUploadResult] = useState<'success' | 'partial' | 'failed' | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [disciplineAutoSuggested, setDisciplineAutoSuggested] = useState(false);
  const [expiryDate, setExpiryDate] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const newFiles: FileUploadState[] = Array.from(selectedFiles).map(file => ({
      file,
      status: 'pending' as const,
    }));

    setFiles(prev => [...prev, ...newFiles]);
    setUploadResult(null);

    // Auto-classify discipline from filename if not already set
    if (!discipline && newFiles.length > 0) {
      setIsClassifying(true);
      try {
        const formData = new FormData();
        formData.append('fileName', newFiles[0].file.name);
        formData.append('tenantId', tenantId);
        const res = await fetch('/api/archive/classify-suggest', { method: 'POST', body: formData });
        if (res.ok) {
          const data = await res.json();
          if (data.discipline) {
            setDiscipline(data.discipline as DisciplineType);
            setDisciplineAutoSuggested(true);
          }
        }
      } catch {} finally {
        setIsClassifying(false);
      }
    }
  }, [discipline, tenantId]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles) return;

    const newFiles: FileUploadState[] = Array.from(droppedFiles).map(file => ({
      file,
      status: 'pending' as const,
    }));

    setFiles(prev => [...prev, ...newFiles]);
    setUploadResult(null);

    // Auto-classify discipline from filename if not already set
    if (!discipline && newFiles.length > 0) {
      setIsClassifying(true);
      try {
        const formData = new FormData();
        formData.append('fileName', newFiles[0].file.name);
        formData.append('tenantId', tenantId);
        const res = await fetch('/api/archive/classify-suggest', { method: 'POST', body: formData });
        if (res.ok) {
          const data = await res.json();
          if (data.discipline) {
            setDiscipline(data.discipline as DisciplineType);
            setDisciplineAutoSuggested(true);
          }
        }
      } catch {} finally {
        setIsClassifying(false);
      }
    }
  }, [discipline, tenantId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setUploadResult(null);
  }, []);

  const getFilesToUpload = useCallback(() => {
    return files.filter(f => f.status === 'pending' || f.status === 'failed');
  }, [files]);

  const handleUpload = async () => {
    const filesToUpload = getFilesToUpload();
    if (filesToUpload.length === 0) return;

    setIsUploading(true);
    setUploadResult(null);

    setFiles(prev => prev.map(f => 
      f.status === 'pending' || f.status === 'failed' 
        ? { ...f, status: 'uploading' as const, error: undefined, indexingErrors: undefined }
        : f
    ));

    const formData = new FormData();
    formData.append('tenantId', tenantId);
    formData.append('developmentId', developmentId);
    formData.append('metadata', JSON.stringify({
      discipline: discipline || null,
      houseTypeId: houseTypeId || null,
      isImportant,
      mustRead,
      expiry_date: expiryDate || null,
    }));

    filesToUpload.forEach(({ file }) => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const result: ApiResponse = await response.json();

      if (!response.ok && !result.files) {
        throw new Error(result.error || 'Upload failed');
      }

      if (result.files && result.files.length > 0) {
        setFiles(prev => {
          const uploadingFiles = prev.filter(f => f.status === 'uploading');
          const otherFiles = prev.filter(f => f.status !== 'uploading');
          
          const updatedUploadingFiles = uploadingFiles.map((fileState, idx) => {
            const apiResult = result.files?.[idx];
            
            if (apiResult) {
              return {
                ...fileState,
                status: apiResult.success ? 'indexed' as const : 'failed' as const,
                error: apiResult.error,
                chunksIndexed: apiResult.chunksIndexed,
                totalChunks: apiResult.totalChunks,
                indexingErrors: apiResult.indexingErrors,
              };
            }
            return { ...fileState, status: 'failed' as const, error: 'No response from server' };
          });

          const newFiles = [...otherFiles, ...updatedUploadingFiles];
          
          const allFilesIndexed = newFiles.every(f => f.status === 'indexed');
          const anyFailed = newFiles.some(f => f.status === 'failed');
          const anyIndexed = newFiles.some(f => f.status === 'indexed');

          if (allFilesIndexed && newFiles.length > 0) {
            setTimeout(() => {
              setUploadResult('success');
              setTimeout(() => onUploadComplete(), 1500);
            }, 0);
          } else if (anyFailed && anyIndexed) {
            setTimeout(() => setUploadResult('partial'), 0);
          } else if (anyFailed) {
            setTimeout(() => setUploadResult('failed'), 0);
          }

          return newFiles;
        });
      } else if (result.success) {
        setFiles(prev => {
          const updated = prev.map(f => 
            f.status === 'uploading' 
              ? { ...f, status: 'indexed' as const }
              : f
          );
          const allIndexed = updated.every(f => f.status === 'indexed');
          if (allIndexed) {
            setTimeout(() => {
              setUploadResult('success');
              setTimeout(() => onUploadComplete(), 1500);
            }, 0);
          }
          return updated;
        });
      }
    } catch (error) {
      console.error('[Upload] Error:', error);
      setFiles(prev => prev.map(f => 
        f.status === 'uploading'
          ? { ...f, status: 'failed' as const, error: error instanceof Error ? error.message : 'Upload failed' }
          : f
      ));
      setUploadResult('failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRetryFailed = () => {
    handleUpload();
  };

  const handleClose = () => {
    if (!isUploading) {
      setFiles([]);
      setDiscipline('');
      setHouseTypeId('');
      setIsImportant(false);
      setMustRead(false);
      setUploadResult(null);
      setDisciplineAutoSuggested(false);
      setExpiryDate('');
      onClose();
    }
  };

  if (!isOpen) return null;

  const disciplineOptions = Object.entries(DISCIPLINES).map(([key, value]) => ({
    value: key as DisciplineType,
    label: value.label,
  }));

  const failedFiles = files.filter(f => f.status === 'failed');
  const indexedFiles = files.filter(f => f.status === 'indexed');
  const pendingFiles = files.filter(f => f.status === 'pending');
  const hasFailures = failedFiles.length > 0;
  const allIndexed = indexedFiles.length === files.length && files.length > 0 && pendingFiles.length === 0 && !isUploading;

  const getStatusLabel = (status: FileUploadState['status']) => {
    switch (status) {
      case 'pending': return 'Ready';
      case 'uploading': return 'Processing...';
      case 'indexed': return 'Indexed';
      case 'failed': return 'Failed';
      default: return status;
    }
  };

  const getStatusColor = (status: FileUploadState['status']) => {
    switch (status) {
      case 'pending': return 'text-gray-500';
      case 'uploading': return 'text-gold-400';
      case 'indexed': return 'text-green-400';
      case 'failed': return 'text-red-400';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Upload Documents</h2>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {hasFailures && !isUploading && (
            <div className="bg-red-900/30 border border-red-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-300">
                    {failedFiles.length} file{failedFiles.length > 1 ? 's' : ''} failed to upload
                  </h3>
                  <p className="text-sm text-red-400/80 mt-1">
                    {indexedFiles.length > 0 
                      ? `${indexedFiles.length} file${indexedFiles.length > 1 ? 's were' : ' was'} successfully indexed.`
                      : 'No files were successfully indexed.'
                    }
                  </p>
                  <button
                    onClick={handleRetryFailed}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-800/50 hover:bg-red-800 text-red-200 rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry Failed Uploads
                  </button>
                </div>
              </div>
            </div>
          )}

          {allIndexed && (
            <div className="bg-green-900/30 border border-green-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <div>
                  <h3 className="text-sm font-semibold text-green-300">
                    All files uploaded and indexed successfully
                  </h3>
                  <p className="text-sm text-green-400/80 mt-0.5">
                    {files.length} document{files.length > 1 ? 's are' : ' is'} now searchable in the archive.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-gold-500/50 hover:bg-gray-50 transition-all"
          >
            <Upload className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-700 font-medium">
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
              <h3 className="text-sm font-medium text-gray-500">
                Files ({files.length})
                {indexedFiles.length > 0 && (
                  <span className="ml-2 text-green-400">
                    {indexedFiles.length} indexed
                  </span>
                )}
                {failedFiles.length > 0 && (
                  <span className="ml-2 text-red-400">
                    {failedFiles.length} failed
                  </span>
                )}
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {files.map((fileState, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      fileState.status === 'failed' 
                        ? 'bg-red-900/20 border border-red-800/50' 
                        : fileState.status === 'indexed'
                        ? 'bg-green-900/20 border border-green-800/50'
                        : 'bg-gray-50'
                    }`}
                  >
                    <FileText className={`w-5 h-5 flex-shrink-0 ${
                      fileState.status === 'failed' ? 'text-red-400' :
                      fileState.status === 'indexed' ? 'text-green-400' :
                      'text-gray-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{fileState.file.name}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500">
                          {(fileState.file.size / 1024).toFixed(1)} KB
                        </span>
                        <span className={getStatusColor(fileState.status)}>
                          {getStatusLabel(fileState.status)}
                        </span>
                        {fileState.chunksIndexed !== undefined && fileState.totalChunks !== undefined && (
                          <span className="text-gray-500">
                            ({fileState.chunksIndexed}/{fileState.totalChunks} chunks)
                          </span>
                        )}
                      </div>
                      {fileState.error && (
                        <p className="text-xs text-red-400 mt-1 truncate" title={fileState.error}>
                          {fileState.error}
                        </p>
                      )}
                      {fileState.indexingErrors && fileState.indexingErrors.length > 0 && (
                        <details className="mt-1">
                          <summary className="text-xs text-red-400 cursor-pointer hover:text-red-300">
                            {fileState.indexingErrors.length} indexing error{fileState.indexingErrors.length > 1 ? 's' : ''}
                          </summary>
                          <ul className="mt-1 space-y-0.5 text-xs text-red-400/80 pl-3">
                            {fileState.indexingErrors.slice(0, 3).map((err, i) => (
                              <li key={i} className="truncate" title={err}>{err}</li>
                            ))}
                            {fileState.indexingErrors.length > 3 && (
                              <li>...and {fileState.indexingErrors.length - 3} more</li>
                            )}
                          </ul>
                        </details>
                      )}
                    </div>
                    {fileState.status === 'pending' && (
                      <button
                        onClick={() => removeFile(index)}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-900"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {fileState.status === 'uploading' && (
                      <Loader2 className="w-5 h-5 text-gold-400 animate-spin" />
                    )}
                    {fileState.status === 'indexed' && (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    )}
                    {fileState.status === 'failed' && (
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-2 flex items-center">
                Discipline (optional)
                {disciplineAutoSuggested && (
                  <span className="ml-2 text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">AI suggested</span>
                )}
                {isClassifying && (
                  <Loader2 className="ml-2 w-3 h-3 animate-spin text-amber-500" />
                )}
              </label>
              <select
                value={discipline}
                onChange={(e) => {
                  setDiscipline(e.target.value as DisciplineType | '');
                  setDisciplineAutoSuggested(false);
                }}
                disabled={isUploading}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-gold-500 disabled:opacity-50"
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
              <label className="block text-sm font-medium text-gray-500 mb-2">
                House Type (optional)
              </label>
              <select
                value={houseTypeId}
                onChange={(e) => setHouseTypeId(e.target.value)}
                disabled={isUploading}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-gold-500 disabled:opacity-50"
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

          {(discipline === 'handover' || discipline === 'other') && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Expiry Date <span className="text-gray-400 font-normal">(optional — for certs, insurance, compliance docs)</span>
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                disabled={isUploading}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 disabled:opacity-50"
              />
            </div>
          )}

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
                <div className="w-5 h-5 border-2 border-gray-300 rounded peer-checked:bg-gold-500 peer-checked:border-gold-500 transition-colors" />
                <CheckCircle className="absolute inset-0 w-5 h-5 text-black opacity-0 peer-checked:opacity-100" />
              </div>
              <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
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
                <div className="w-5 h-5 border-2 border-gray-300 rounded peer-checked:bg-red-500 peer-checked:border-red-500 transition-colors" />
                <CheckCircle className="absolute inset-0 w-5 h-5 text-white opacity-0 peer-checked:opacity-100" />
              </div>
              <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                Must-Read Document
              </span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            {isUploading && 'Processing documents...'}
            {uploadResult === 'partial' && !isUploading && 'Some files need attention'}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              disabled={isUploading}
              className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-50"
            >
              {allIndexed ? 'Close' : 'Cancel'}
            </button>
            {!allIndexed && (
              <button
                onClick={handleUpload}
                disabled={getFilesToUpload().length === 0 || isUploading}
                className="px-6 py-2.5 text-sm font-semibold bg-gradient-to-r from-gold-500 to-gold-600 text-black rounded-lg hover:from-gold-400 hover:to-gold-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : hasFailures ? (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Retry ({failedFiles.length})
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload {files.filter(f => f.status === 'pending').length > 0 
                      ? `(${files.filter(f => f.status === 'pending').length})` 
                      : ''}
                  </>
                )}
              </button>
            )}
            {allIndexed && (
              <button
                onClick={handleClose}
                className="px-6 py-2.5 text-sm font-semibold bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-400 hover:to-green-500 transition-all flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
