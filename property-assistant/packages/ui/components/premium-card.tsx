import React from 'react';

interface PremiumCardProps {
  variant?: 'default' | 'gold-accent' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  hover?: boolean;
}

export function PremiumCard({
  variant = 'default',
  padding = 'md',
  className = '',
  children,
  onClick,
  hover = false,
}: PremiumCardProps) {
  const baseStyles = 'bg-white rounded-card transition-all duration-premium';
  
  const variantStyles = {
    default: 'border border-grey-200',
    'gold-accent': 'border-l-4 border-l-gold-500 border-t border-r border-b border-grey-200',
    elevated: 'shadow-card',
  };
  
  const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };
  
  const interactiveStyles = onClick || hover
    ? 'cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5'
    : '';
  
  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${paddingStyles[padding]} ${interactiveStyles} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function PremiumCardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`border-b border-grey-200 pb-4 mb-4 ${className}`}>
      {children}
    </div>
  );
}

export function PremiumCardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={`text-heading-md text-black font-semibold ${className}`}>
      {children}
    </h3>
  );
}

export function PremiumCardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-body text-grey-700 ${className}`}>
      {children}
    </div>
  );
}
