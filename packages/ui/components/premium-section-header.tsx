import React from 'react';

interface PremiumSectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PremiumSectionHeader({
  title,
  subtitle,
  action,
  className = '',
}: PremiumSectionHeaderProps) {
  return (
    <div className={`border-b-2 border-gold-500 pb-4 mb-6 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-heading-lg text-black font-semibold tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-2 text-body text-grey-600">
              {subtitle}
            </p>
          )}
        </div>
        {action && (
          <div className="flex-shrink-0">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
