'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Link2,
  Loader2,
  Check,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

type ExportFormat = 'csv' | 'excel' | 'pdf' | 'link';

interface ExportOption {
  format: ExportFormat;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const exportOptions: ExportOption[] = [
  {
    format: 'csv',
    label: 'CSV',
    description: 'Comma-separated values',
    icon: FileSpreadsheet,
  },
  {
    format: 'excel',
    label: 'Excel',
    description: 'Microsoft Excel format',
    icon: FileSpreadsheet,
  },
  {
    format: 'pdf',
    label: 'PDF',
    description: 'Portable document format',
    icon: FileText,
  },
  {
    format: 'link',
    label: 'Copy Link',
    description: 'Share with a unique link',
    icon: Link2,
  },
];

interface ExportMenuProps {
  onExport: (format: ExportFormat) => Promise<void>;
  disabled?: boolean;
  className?: string;
  buttonLabel?: string;
  availableFormats?: ExportFormat[];
}

export function ExportMenu({
  onExport,
  disabled = false,
  className,
  buttonLabel = 'Export',
  availableFormats,
}: ExportMenuProps) {
  const [isExporting, setIsExporting] = useState<ExportFormat | null>(null);
  const [exportSuccess, setExportSuccess] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(format);
    setExportSuccess(null);
    try {
      await onExport(format);
      setExportSuccess(format);
      setTimeout(() => setExportSuccess(null), 2000);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(null);
    }
  };

  const options = availableFormats
    ? exportOptions.filter((opt) => availableFormats.includes(opt.format))
    : exportOptions;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          disabled={disabled || isExporting !== null}
          className={cn(
            'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
            'bg-gray-100 text-gray-700 hover:bg-gray-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className
          )}
        >
          <Download className="w-4 h-4" />
          {buttonLabel}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className={cn(
            'min-w-[220px] bg-white rounded-xl shadow-lg border border-gray-200 p-1',
            'animate-in fade-in zoom-in-95 duration-150',
            'z-50'
          )}
        >
          {options.map((option) => {
            const Icon = option.icon;
            const isLoading = isExporting === option.format;
            const isSuccess = exportSuccess === option.format;

            return (
              <DropdownMenu.Item
                key={option.format}
                onClick={() => handleExport(option.format)}
                disabled={isLoading}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer',
                  'hover:bg-gray-50 focus:bg-gray-50 focus:outline-none',
                  'transition-colors'
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                  ) : isSuccess ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Icon className="w-4 h-4 text-gray-500" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {option.label}
                  </p>
                  <p className="text-xs text-gray-500">{option.description}</p>
                </div>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export default ExportMenu;
