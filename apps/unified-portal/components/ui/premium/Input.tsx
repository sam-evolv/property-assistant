'use client';

import { forwardRef, memo, useState, useId } from 'react';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================
type InputSize = 'sm' | 'md' | 'lg';
type InputVariant = 'default' | 'filled' | 'flushed';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Input label */
  label?: string;
  /** Helper text below input */
  helperText?: string;
  /** Error message (shows error state) */
  error?: string;
  /** Success message (shows success state) */
  success?: string;
  /** Left icon */
  leftIcon?: LucideIcon;
  /** Right icon */
  rightIcon?: LucideIcon;
  /** Input size */
  size?: InputSize;
  /** Input variant */
  variant?: InputVariant;
  /** Show character count */
  showCount?: boolean;
  /** Full width */
  fullWidth?: boolean;
  /** Required indicator */
  required?: boolean;
  /** Container className */
  containerClassName?: string;
}

// ============================================================================
// STYLES
// ============================================================================
const sizeStyles: Record<InputSize, { input: string; icon: string; label: string }> = {
  sm: {
    input: 'h-8 px-3 text-sm',
    icon: 'w-4 h-4',
    label: 'text-xs',
  },
  md: {
    input: 'h-10 px-3.5 text-sm',
    icon: 'w-4 h-4',
    label: 'text-sm',
  },
  lg: {
    input: 'h-12 px-4 text-base',
    icon: 'w-5 h-5',
    label: 'text-sm',
  },
};

const variantStyles: Record<InputVariant, string> = {
  default: cn(
    'bg-white border border-neutral-200 rounded-lg',
    'hover:border-neutral-300',
    'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'
  ),
  filled: cn(
    'bg-neutral-100 border border-transparent rounded-lg',
    'hover:bg-neutral-50',
    'focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'
  ),
  flushed: cn(
    'bg-transparent border-b-2 border-neutral-200 rounded-none px-0',
    'hover:border-neutral-300',
    'focus:border-brand-500'
  ),
};

// ============================================================================
// INPUT COMPONENT
// ============================================================================
export const Input = memo(
  forwardRef<HTMLInputElement, InputProps>(function Input(
    {
      label,
      helperText,
      error,
      success,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      size = 'md',
      variant = 'default',
      showCount = false,
      fullWidth = false,
      required = false,
      containerClassName,
      className,
      type = 'text',
      maxLength,
      value,
      disabled,
      id: providedId,
      ...props
    },
    ref
  ) {
    const generatedId = useId();
    const id = providedId || generatedId;
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const hasError = !!error;
    const hasSuccess = !!success && !hasError;

    const styles = sizeStyles[size];
    const currentLength = typeof value === 'string' ? value.length : 0;

    return (
      <div className={cn('space-y-1.5', fullWidth && 'w-full', containerClassName)}>
        {/* Label */}
        {label && (
          <label
            htmlFor={id}
            className={cn(
              'block font-medium text-neutral-700',
              styles.label,
              disabled && 'text-neutral-400'
            )}
          >
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}

        {/* Input container */}
        <div className="relative">
          {/* Left icon */}
          {LeftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <LeftIcon className={cn(styles.icon, 'text-neutral-400')} />
            </div>
          )}

          {/* Input */}
          <input
            ref={ref}
            id={id}
            type={isPassword && showPassword ? 'text' : type}
            maxLength={maxLength}
            value={value}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={
              error ? `${id}-error` : helperText ? `${id}-helper` : undefined
            }
            className={cn(
              'w-full transition-all duration-150 outline-none',
              'placeholder:text-neutral-400',
              'disabled:bg-neutral-50 disabled:text-neutral-400 disabled:cursor-not-allowed',
              styles.input,
              variantStyles[variant],
              LeftIcon && 'pl-10',
              (RightIcon || isPassword || hasError || hasSuccess) && 'pr-10',
              hasError && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
              hasSuccess && 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/20',
              className
            )}
            {...props}
          />

          {/* Right side icons */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {/* Status icons */}
            {hasError && !isPassword && (
              <AlertCircle className={cn(styles.icon, 'text-red-500')} />
            )}
            {hasSuccess && !isPassword && (
              <CheckCircle2 className={cn(styles.icon, 'text-emerald-500')} />
            )}

            {/* Custom right icon */}
            {RightIcon && !hasError && !hasSuccess && !isPassword && (
              <RightIcon className={cn(styles.icon, 'text-neutral-400')} />
            )}

            {/* Password toggle */}
            {isPassword && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 hover:bg-neutral-100 rounded transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className={cn(styles.icon, 'text-neutral-400')} />
                ) : (
                  <Eye className={cn(styles.icon, 'text-neutral-400')} />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Helper text / Error / Success / Character count */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            {error && (
              <p id={`${id}-error`} className="text-xs text-red-600">
                {error}
              </p>
            )}
            {success && !error && (
              <p className="text-xs text-emerald-600">{success}</p>
            )}
            {helperText && !error && !success && (
              <p id={`${id}-helper`} className="text-xs text-neutral-500">
                {helperText}
              </p>
            )}
          </div>

          {showCount && maxLength && (
            <span
              className={cn(
                'text-xs tabular-nums',
                currentLength >= maxLength ? 'text-red-500' : 'text-neutral-400'
              )}
            >
              {currentLength}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  })
);

export default Input;
