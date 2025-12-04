import React from 'react';
import { PremiumButton } from './premium-button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      {icon && (
        <div className="mb-6 text-gold-500 fade-in">
          {icon}
        </div>
      )}
      
      <h3 className="text-xl font-semibold text-black mb-2 fade-in" style={{ animationDelay: '100ms' }}>
        {title}
      </h3>
      
      <p className="text-gray-600 max-w-md mb-8 fade-in" style={{ animationDelay: '200ms' }}>
        {description}
      </p>
      
      {action && (
        <div className="fade-in" style={{ animationDelay: '300ms' }}>
          <PremiumButton
            variant="primary"
            onClick={action.onClick}
            icon={action.icon}
            className="gold-shimmer"
          >
            {action.label}
          </PremiumButton>
        </div>
      )}
    </div>
  );
}
