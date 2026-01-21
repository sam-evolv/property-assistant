'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { FileQuestion, Inbox, Search, Users, Building, FileText } from 'lucide-react';

type EmptyStateVariant = 'default' | 'search' | 'inbox' | 'users' | 'units' | 'documents';

interface EmptyStateProps {
  icon?: React.ReactNode;
  lucideIcon?: LucideIcon;
  variant?: EmptyStateVariant;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

const variantIcons: Record<EmptyStateVariant, LucideIcon> = {
  default: FileQuestion,
  search: Search,
  inbox: Inbox,
  users: Users,
  units: Building,
  documents: FileText,
};

export function EmptyState({
  icon,
  lucideIcon,
  variant = 'default',
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  secondaryActionLabel,
  secondaryActionHref,
  onSecondaryAction,
  className,
}: EmptyStateProps) {
  const LucideIconComponent = lucideIcon || variantIcons[variant];
  const hasIcon = icon || lucideIcon || variant !== 'default';

  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center py-12 px-6',
      'bg-white rounded-xl border border-gray-200',
      className
    )}>
      {hasIcon && (
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          {icon ? (
            <div className="w-8 h-8 text-gray-400">{icon}</div>
          ) : (
            <LucideIconComponent className="w-8 h-8 text-gray-400" />
          )}
        </div>
      )}
      <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-sm">{description}</p>

      {(actionLabel && (actionHref || onAction)) && (
        <div className="flex items-center gap-3">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-gold-500 hover:bg-gold-600 transition-colors"
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              onClick={onAction}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-gold-500 hover:bg-gold-600 transition-colors"
            >
              {actionLabel}
            </button>
          )}

          {secondaryActionLabel && (secondaryActionHref || onSecondaryAction) && (
            secondaryActionHref ? (
              <Link
                href={secondaryActionHref}
                className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                {secondaryActionLabel}
              </Link>
            ) : (
              <button
                onClick={onSecondaryAction}
                className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                {secondaryActionLabel}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

// Pre-configured empty states
export function NoResultsState({
  searchQuery,
  onClear,
}: {
  searchQuery?: string;
  onClear?: () => void;
}) {
  return (
    <EmptyState
      variant="search"
      title="No results found"
      description={
        searchQuery
          ? `We couldn't find anything matching "${searchQuery}". Try adjusting your search.`
          : 'Try adjusting your filters or search terms.'
      }
      actionLabel={onClear ? 'Clear search' : undefined}
      onAction={onClear}
    />
  );
}

export function EmptyDevelopments() {
  return (
    <EmptyState
      icon={
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      }
      title="No Developments Yet"
      description="Get started by creating your first property development. You can add houses, documents, and configure chat assistance."
      actionLabel="Create Development"
      actionHref="/developments/new"
    />
  );
}

export function EmptyDocuments() {
  return (
    <EmptyState
      icon={
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      }
      title="No Documents Uploaded"
      description="Upload manuals, warranties, specifications, and other documents to train your AI assistant."
      actionLabel="Upload Documents"
    />
  );
}

export function EmptyHouses() {
  return (
    <EmptyState
      icon={
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      }
      title="No Houses Yet"
      description="Add houses to this development to enable QR code onboarding and homeowner chat access."
      actionLabel="Add House"
    />
  );
}
