'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  X,
  ChevronDown,
  ChevronUp,
  Users,
  Mail,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

interface Recipient {
  id: string;
  name: string;
  email?: string;
  unitNumber?: string;
}

interface BulkActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  recipients: Recipient[];
  previewContent?: React.ReactNode;
  confirmLabel?: string;
  confirmVariant?: 'default' | 'danger';
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
}

export function BulkActionModal({
  open,
  onOpenChange,
  title,
  description,
  recipients,
  previewContent,
  confirmLabel = 'Confirm',
  confirmVariant = 'default',
  onConfirm,
  isLoading = false,
}: BulkActionModalProps) {
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const processing = isLoading || isProcessing;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200" />
        <Dialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
            'w-full max-w-lg bg-white rounded-xl shadow-xl',
            'animate-in fade-in zoom-in-95 duration-200',
            'focus:outline-none'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <div>
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="text-sm text-gray-500 mt-1">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            {/* Recipients */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-gray-400" />
                <h4 className="text-sm font-medium text-gray-700">
                  Recipients ({recipients.length})
                </h4>
              </div>
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 max-h-40 overflow-y-auto">
                <div className="space-y-2">
                  {recipients.slice(0, 10).map((recipient) => (
                    <div
                      key={recipient.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                          {recipient.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-gray-900">{recipient.name}</span>
                      </div>
                      {recipient.unitNumber && (
                        <span className="text-xs text-gray-500">
                          Unit {recipient.unitNumber}
                        </span>
                      )}
                    </div>
                  ))}
                  {recipients.length > 10 && (
                    <p className="text-xs text-gray-500 pt-2">
                      ... and {recipients.length - 10} more
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Email Preview (Collapsible) */}
            {previewContent && (
              <div className="mb-4">
                <button
                  onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
                  className="flex items-center gap-2 w-full text-sm font-medium text-gray-700 mb-2"
                >
                  <Mail className="w-4 h-4 text-gray-400" />
                  Preview Content
                  {isPreviewExpanded ? (
                    <ChevronUp className="w-4 h-4 ml-auto" />
                  ) : (
                    <ChevronDown className="w-4 h-4 ml-auto" />
                  )}
                </button>
                {isPreviewExpanded && (
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-sm text-gray-600">
                    {previewContent}
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
            <Dialog.Close asChild>
              <button
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={processing}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleConfirm}
              disabled={processing}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                confirmVariant === 'danger'
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-gold-500 text-white hover:bg-gold-600'
              )}
            >
              {processing && <Loader2 className="w-4 h-4 animate-spin" />}
              {confirmLabel} ({recipients.length})
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Simplified version for quick confirmations
interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: 'default' | 'danger';
  onConfirm: () => void;
}

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmVariant = 'default',
  onConfirm,
}: ConfirmModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200" />
        <Dialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
            'w-full max-w-md bg-white rounded-xl shadow-xl p-6',
            'animate-in fade-in zoom-in-95 duration-200',
            'focus:outline-none'
          )}
        >
          <Dialog.Title className="text-lg font-semibold text-gray-900 mb-2">
            {title}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-600 mb-6">
            {description}
          </Dialog.Description>
          <div className="flex items-center justify-end gap-3">
            <Dialog.Close asChild>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                confirmVariant === 'danger'
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-gold-500 text-white hover:bg-gold-600'
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default BulkActionModal;
