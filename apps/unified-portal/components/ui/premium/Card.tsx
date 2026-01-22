'use client';

import { forwardRef, memo } from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================
type CardVariant = 'default' | 'elevated' | 'outlined' | 'ghost' | 'highlighted';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  hoverable?: boolean;
  clickable?: boolean;
  as?: 'div' | 'article' | 'section';
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean;
}

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: 'left' | 'center' | 'right' | 'between';
}

// ============================================================================
// STYLES
// ============================================================================
const variantStyles: Record<CardVariant, string> = {
  default: cn(
    'bg-white border border-neutral-200',
    'shadow-card'
  ),
  elevated: cn(
    'bg-white border border-neutral-100',
    'shadow-lg'
  ),
  outlined: cn(
    'bg-transparent border border-neutral-200',
    'shadow-none'
  ),
  ghost: cn(
    'bg-transparent border-none',
    'shadow-none'
  ),
  highlighted: cn(
    'bg-gradient-to-br from-brand-50 to-white',
    'border border-brand-200',
    'shadow-card ring-1 ring-brand-100/50'
  ),
};

const paddingStyles: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

// ============================================================================
// CARD COMPONENT
// ============================================================================
export const Card = memo(
  forwardRef<HTMLDivElement, CardProps>(function Card(
    {
      variant = 'default',
      padding = 'md',
      hoverable = false,
      clickable = false,
      as: Component = 'div',
      className,
      children,
      ...props
    },
    ref
  ) {
    return (
      <Component
        ref={ref}
        className={cn(
          'rounded-xl transition-all duration-200',
          variantStyles[variant],
          paddingStyles[padding],
          hoverable && 'hover:shadow-cardHover hover:border-neutral-300',
          clickable && 'cursor-pointer active:scale-[0.99]',
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  })
);

// ============================================================================
// CARD HEADER
// ============================================================================
export const CardHeader = memo(
  forwardRef<HTMLDivElement, CardHeaderProps>(function CardHeader(
    { title, subtitle, action, className, children, ...props },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-start justify-between gap-4 mb-4',
          className
        )}
        {...props}
      >
        {(title || subtitle) ? (
          <div className="min-w-0">
            {title && (
              <h3 className="text-base font-semibold text-neutral-900 truncate">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-sm text-neutral-500 mt-0.5">{subtitle}</p>
            )}
          </div>
        ) : (
          children
        )}
        {action && <div className="shrink-0">{action}</div>}
      </div>
    );
  })
);

// ============================================================================
// CARD CONTENT
// ============================================================================
export const CardContent = memo(
  forwardRef<HTMLDivElement, CardContentProps>(function CardContent(
    { noPadding = false, className, children, ...props },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={cn(!noPadding && 'py-2', className)}
        {...props}
      >
        {children}
      </div>
    );
  })
);

// ============================================================================
// CARD FOOTER
// ============================================================================
export const CardFooter = memo(
  forwardRef<HTMLDivElement, CardFooterProps>(function CardFooter(
    { align = 'right', className, children, ...props },
    ref
  ) {
    const alignStyles = {
      left: 'justify-start',
      center: 'justify-center',
      right: 'justify-end',
      between: 'justify-between',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-3 pt-4 mt-4 border-t border-neutral-100',
          alignStyles[align],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  })
);

export default Card;
