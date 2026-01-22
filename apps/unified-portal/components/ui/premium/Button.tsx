'use client';

import { forwardRef, memo } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button style variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Left icon */
  leftIcon?: LucideIcon;
  /** Right icon */
  rightIcon?: LucideIcon;
  /** Loading state */
  loading?: boolean;
  /** Loading text (optional) */
  loadingText?: string;
  /** Full width */
  fullWidth?: boolean;
  /** Icon only mode */
  iconOnly?: boolean;
  /** Children */
  children?: React.ReactNode;
}

// ============================================================================
// STYLES
// ============================================================================
const baseStyles = cn(
  'inline-flex items-center justify-center gap-2',
  'font-medium transition-all duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
  'disabled:pointer-events-none disabled:opacity-50',
  'active:scale-[0.98]',
  'select-none'
);

const variantStyles: Record<ButtonVariant, string> = {
  primary: cn(
    'bg-brand-500 text-white',
    'hover:bg-brand-600',
    'focus-visible:ring-brand-500',
    'shadow-sm hover:shadow-md',
    'border border-brand-600/20'
  ),
  secondary: cn(
    'bg-neutral-900 text-white',
    'hover:bg-neutral-800',
    'focus-visible:ring-neutral-900',
    'shadow-sm hover:shadow-md',
    'border border-neutral-950/20'
  ),
  outline: cn(
    'bg-white text-neutral-700',
    'border border-neutral-200',
    'hover:bg-neutral-50 hover:border-neutral-300',
    'focus-visible:ring-neutral-400',
    'shadow-sm'
  ),
  ghost: cn(
    'bg-transparent text-neutral-600',
    'hover:bg-neutral-100 hover:text-neutral-900',
    'focus-visible:ring-neutral-400'
  ),
  danger: cn(
    'bg-red-500 text-white',
    'hover:bg-red-600',
    'focus-visible:ring-red-500',
    'shadow-sm hover:shadow-md',
    'border border-red-600/20'
  ),
  success: cn(
    'bg-emerald-500 text-white',
    'hover:bg-emerald-600',
    'focus-visible:ring-emerald-500',
    'shadow-sm hover:shadow-md',
    'border border-emerald-600/20'
  ),
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs rounded-md',
  sm: 'h-8 px-3 text-sm rounded-md',
  md: 'h-9 px-4 text-sm rounded-lg',
  lg: 'h-10 px-5 text-base rounded-lg',
  xl: 'h-12 px-6 text-base rounded-xl',
};

const iconOnlySizes: Record<ButtonSize, string> = {
  xs: 'h-7 w-7 p-0',
  sm: 'h-8 w-8 p-0',
  md: 'h-9 w-9 p-0',
  lg: 'h-10 w-10 p-0',
  xl: 'h-12 w-12 p-0',
};

const iconSizes: Record<ButtonSize, string> = {
  xs: 'w-3 h-3',
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-4 h-4',
  xl: 'w-5 h-5',
};

// ============================================================================
// COMPONENT
// ============================================================================
export const Button = memo(
  forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    {
      variant = 'primary',
      size = 'md',
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      loading = false,
      loadingText,
      fullWidth = false,
      iconOnly = false,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) {
    const isDisabled = disabled || loading;
    const iconSize = iconSizes[size];

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          baseStyles,
          variantStyles[variant],
          iconOnly ? iconOnlySizes[size] : sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className={cn(iconSize, 'animate-spin')} />
            {loadingText && <span>{loadingText}</span>}
            {!loadingText && !iconOnly && children}
          </>
        ) : (
          <>
            {LeftIcon && <LeftIcon className={iconSize} />}
            {!iconOnly && children}
            {RightIcon && <RightIcon className={iconSize} />}
          </>
        )}
      </button>
    );
  })
);

// ============================================================================
// BUTTON GROUP
// ============================================================================
interface ButtonGroupProps {
  children: React.ReactNode;
  className?: string;
  attached?: boolean;
}

export function ButtonGroup({ children, className, attached = false }: ButtonGroupProps) {
  return (
    <div
      className={cn(
        'inline-flex',
        attached && '[&>button]:rounded-none [&>button:first-child]:rounded-l-lg [&>button:last-child]:rounded-r-lg [&>button:not(:last-child)]:border-r-0',
        !attached && 'gap-2',
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================================================
// ICON BUTTON
// ============================================================================
interface IconButtonProps extends Omit<ButtonProps, 'leftIcon' | 'rightIcon' | 'iconOnly' | 'children'> {
  icon: LucideIcon;
  'aria-label': string;
}

export const IconButton = memo(
  forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
    { icon: Icon, size = 'md', ...props },
    ref
  ) {
    return (
      <Button ref={ref} size={size} iconOnly {...props}>
        <Icon className={iconSizes[size]} />
      </Button>
    );
  })
);

export default Button;
