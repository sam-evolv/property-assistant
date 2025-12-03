import React from 'react';

interface PremiumInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export function PremiumInput({
  label,
  error,
  icon,
  fullWidth = false,
  className = '',
  ...props
}: PremiumInputProps) {
  return (
    <div className={`${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label className="block text-sm font-medium text-black mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-500">
            {icon}
          </div>
        )}
        <input
          className={`
            w-full px-4 py-3 ${icon ? 'pl-10' : ''}
            bg-white border-2 border-grey-200
            rounded-premium
            text-black placeholder-grey-400
            transition-all duration-premium
            focus:outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20
            disabled:bg-grey-100 disabled:cursor-not-allowed
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

interface PremiumTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

export function PremiumTextarea({
  label,
  error,
  fullWidth = false,
  className = '',
  ...props
}: PremiumTextareaProps) {
  return (
    <div className={`${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label className="block text-sm font-medium text-black mb-2">
          {label}
        </label>
      )}
      <textarea
        className={`
          w-full px-4 py-3
          bg-white border-2 border-grey-200
          rounded-premium
          text-black placeholder-grey-400
          transition-all duration-premium
          focus:outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20
          disabled:bg-grey-100 disabled:cursor-not-allowed
          resize-none
          ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
