import React from 'react';

interface PremiumPageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  backButton?: React.ReactNode;
  className?: string;
}

export function PremiumPageHeader({
  title,
  subtitle,
  action,
  backButton,
  className = '',
}: PremiumPageHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-8 ${className}`}>
      <div className="flex-1 min-w-0">
        {backButton && (
          <div className="mb-4 fade-in">
            {backButton}
          </div>
        )}
        
        <h1 className="text-3xl md:text-4xl font-bold text-black tracking-tight fade-in">
          {title}
        </h1>
        
        {subtitle && (
          <p className="mt-2 text-base text-gray-600 fade-in" style={{ animationDelay: '100ms' }}>
            {subtitle}
          </p>
        )}
      </div>
      
      {action && (
        <div className="ml-6 flex-shrink-0 fade-in" style={{ animationDelay: '200ms' }}>
          {action}
        </div>
      )}
    </div>
  );
}
