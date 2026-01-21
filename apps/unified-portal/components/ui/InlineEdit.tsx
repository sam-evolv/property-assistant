'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Check, X, Edit3, Loader2 } from 'lucide-react';

interface InlineEditProps {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  multiline?: boolean;
  maxLength?: number;
  minLength?: number;
  validateFn?: (value: string) => string | null; // Returns error message or null
  formatDisplayValue?: (value: string) => string;
  showEditIcon?: boolean;
  autoFocus?: boolean;
}

export function InlineEdit({
  value,
  onSave,
  placeholder = 'Click to edit',
  className,
  inputClassName,
  disabled = false,
  multiline = false,
  maxLength,
  minLength,
  validateFn,
  formatDisplayValue,
  showEditIcon = true,
  autoFocus = false,
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(autoFocus);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync internal state when external value changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        if (isEditing) {
          handleCancel();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing]);

  const validate = useCallback(
    (val: string): string | null => {
      if (minLength && val.length < minLength) {
        return `Minimum ${minLength} characters required`;
      }
      if (maxLength && val.length > maxLength) {
        return `Maximum ${maxLength} characters allowed`;
      }
      if (validateFn) {
        return validateFn(val);
      }
      return null;
    },
    [minLength, maxLength, validateFn]
  );

  const handleStartEdit = () => {
    if (disabled) return;
    setIsEditing(true);
    setEditValue(value);
    setError(null);
  };

  const handleSave = async () => {
    const trimmedValue = editValue.trim();
    const validationError = validate(trimmedValue);

    if (validationError) {
      setError(validationError);
      return;
    }

    if (trimmedValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(trimmedValue);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(value);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const displayValue = formatDisplayValue ? formatDisplayValue(value) : value;

  if (isEditing) {
    const InputComponent = multiline ? 'textarea' : 'input';

    return (
      <div ref={containerRef} className={cn('relative', className)}>
        <div className="flex items-start gap-2">
          <InputComponent
            ref={inputRef as React.RefObject<HTMLInputElement & HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            maxLength={maxLength}
            className={cn(
              'flex-1 px-2 py-1 text-sm border rounded-md',
              'focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500',
              error ? 'border-red-300' : 'border-gray-200',
              isSaving && 'opacity-50',
              inputClassName
            )}
            rows={multiline ? 3 : undefined}
          />
          <div className="flex items-center gap-1">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                'text-green-600 hover:bg-green-50',
                isSaving && 'opacity-50 cursor-not-allowed'
              )}
              title="Save"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                'text-gray-400 hover:bg-gray-100 hover:text-gray-600',
                isSaving && 'opacity-50 cursor-not-allowed'
              )}
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        {maxLength && (
          <p className="text-xs text-gray-400 mt-1 text-right">
            {editValue.length}/{maxLength}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'group inline-flex items-center gap-1.5 cursor-pointer',
        'px-2 py-1 -mx-2 -my-1 rounded-md',
        !disabled && 'hover:bg-gray-100',
        disabled && 'cursor-default',
        className
      )}
      onClick={handleStartEdit}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleStartEdit();
        }
      }}
    >
      <span
        className={cn(
          'text-sm',
          value ? 'text-gray-900' : 'text-gray-400 italic'
        )}
      >
        {displayValue || placeholder}
      </span>
      {showEditIcon && !disabled && (
        <Edit3 className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );
}

// Inline edit for numbers with formatting
interface InlineNumberEditProps extends Omit<InlineEditProps, 'value' | 'onSave'> {
  value: number;
  onSave: (value: number) => Promise<void> | void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
}

export function InlineNumberEdit({
  value,
  onSave,
  min,
  max,
  step = 1,
  prefix,
  suffix,
  ...props
}: InlineNumberEditProps) {
  const handleSave = async (strValue: string) => {
    const numValue = parseFloat(strValue);
    if (isNaN(numValue)) {
      throw new Error('Please enter a valid number');
    }
    if (min !== undefined && numValue < min) {
      throw new Error(`Minimum value is ${min}`);
    }
    if (max !== undefined && numValue > max) {
      throw new Error(`Maximum value is ${max}`);
    }
    await onSave(numValue);
  };

  const formatDisplayValue = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    const formatted = num.toLocaleString('en-IE');
    return `${prefix || ''}${formatted}${suffix || ''}`;
  };

  return (
    <InlineEdit
      value={value.toString()}
      onSave={handleSave}
      formatDisplayValue={formatDisplayValue}
      {...props}
    />
  );
}

export default InlineEdit;
