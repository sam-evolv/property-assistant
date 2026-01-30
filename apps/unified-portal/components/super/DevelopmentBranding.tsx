'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, Image as ImageIcon, X, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DevelopmentBrandingProps {
  sidebarLogo?: string;
  assistantLogo?: string;
  toolbarLogo?: string;
  onSidebarLogoChange: (url: string) => void;
  onAssistantLogoChange: (url: string) => void;
  onToolbarLogoChange: (url: string) => void;
  onUpload: (file: File, type: 'sidebar' | 'assistant' | 'toolbar') => Promise<string>;
}

interface UploadZoneProps {
  label: string;
  description: string;
  value?: string;
  onChange: (url: string) => void;
  onUpload: (file: File) => Promise<string>;
  aspectHint?: string;
}

function UploadZone({ label, description, value, onChange, onUpload, aspectHint }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await handleFile(file);
  }, []);

  const handleFile = async (file: File) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Please use PNG, JPEG, SVG, or WebP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('File too large. Maximum size is 2MB.');
      return;
    }

    setError(null);
    setIsUploading(true);
    setUploadSuccess(false);

    try {
      const url = await onUpload(file);
      onChange(url);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 2000);
    } catch (err) {
      setError('Failed to upload. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleRemove = () => {
    onChange('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium text-neutral-700">{label}</label>
          <p className="text-xs text-neutral-500">{description}</p>
        </div>
        {aspectHint && (
          <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-1 rounded">{aspectHint}</span>
        )}
      </div>
      
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-all',
          isDragging && 'border-brand-500 bg-brand-50',
          !isDragging && !value && 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50',
          value && 'border-emerald-300 bg-emerald-50/50',
          error && 'border-red-300 bg-red-50/50'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          onChange={handleInputChange}
          className="hidden"
        />
        
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            <span className="text-sm text-neutral-600">Uploading...</span>
          </div>
        ) : uploadSuccess ? (
          <div className="flex flex-col items-center gap-2">
            <Check className="w-8 h-8 text-emerald-500" />
            <span className="text-sm text-emerald-600">Uploaded!</span>
          </div>
        ) : value ? (
          <div className="relative w-full h-full p-2 flex items-center justify-center">
            <img
              src={value}
              alt={label}
              className="max-h-24 max-w-full object-contain rounded"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              className="absolute top-2 right-2 p-1 bg-white rounded-full shadow hover:bg-neutral-100 transition-colors"
            >
              <X className="w-4 h-4 text-neutral-600" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-neutral-400" />
            <span className="text-sm text-neutral-600">Drag & drop or click to upload</span>
            <span className="text-xs text-neutral-400">PNG, JPEG, SVG, WebP (max 2MB)</span>
          </div>
        )}
      </div>
      
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

export function DevelopmentBranding({
  sidebarLogo,
  assistantLogo,
  toolbarLogo,
  onSidebarLogoChange,
  onAssistantLogoChange,
  onToolbarLogoChange,
  onUpload,
}: DevelopmentBrandingProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 pb-2 border-b border-neutral-200">
        <ImageIcon className="w-5 h-5 text-brand-600" />
        <h3 className="text-base font-semibold text-neutral-900">Development Branding</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <UploadZone
          label="Sidebar Logo"
          description="Top-left of developer dashboard"
          value={sidebarLogo}
          onChange={onSidebarLogoChange}
          onUpload={(file) => onUpload(file, 'sidebar')}
          aspectHint="200x60px"
        />
        
        <UploadZone
          label="Assistant Logo"
          description="Center of property assistant chat"
          value={assistantLogo}
          onChange={onAssistantLogoChange}
          onUpload={(file) => onUpload(file, 'assistant')}
          aspectHint="120x120px"
        />
        
        <UploadZone
          label="Toolbar Logo"
          description="Top toolbar of property assistant"
          value={toolbarLogo}
          onChange={onToolbarLogoChange}
          onUpload={(file) => onUpload(file, 'toolbar')}
          aspectHint="160x40px"
        />
      </div>
    </div>
  );
}
