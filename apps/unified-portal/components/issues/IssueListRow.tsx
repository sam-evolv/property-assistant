'use client';

/**
 * Single row in the issue list. Spec section 6.4.
 *
 * Layout: severity bar (4px coloured) on the left, then title and
 * subtitle stack, then metadata (media count, status dot, source,
 * relative time, flag icon) on the right. Tap fires onOpen with the
 * issue id, which opens the detail drawer.
 */

import { Flag, Image as ImageIcon } from 'lucide-react';
import { SeverityIndicator } from './SeverityIndicator';
import {
  IssueListRow as IssueListRowType,
  sourceLabel,
  statusDotClass,
  statusLabel,
} from './types';

interface IssueListRowProps {
  row: IssueListRowType;
  onOpen: (id: string) => void;
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const diff = Date.now() - t;
  const min = Math.round(diff / (60 * 1000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.round(months / 12);
  return `${years}y ago`;
}

export function IssueListRow({ row, onOpen }: IssueListRowProps) {
  const subtitleParts = [row.unit_display_name, row.development_name, row.room].filter(Boolean) as string[];
  const subtitle = subtitleParts.join(' \u00B7 ');

  return (
    <button
      type="button"
      onClick={() => onOpen(row.id)}
      className="w-full flex items-stretch text-left bg-white border-b border-neutral-100 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
    >
      <SeverityIndicator severity={row.severity_label} />
      <div className="flex-1 min-w-0 px-4 py-3.5 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1.5 min-w-0">
            <span className="text-body font-medium text-neutral-900 line-clamp-2 break-words">
              {row.title}
            </span>
            {row.developer_flagged ? (
              <Flag
                aria-label="Flagged for attention"
                className="w-3.5 h-3.5 text-brand-500 flex-shrink-0"
              />
            ) : null}
          </div>
          <div className="text-body-sm text-neutral-500 mt-0.5 flex items-center gap-2 min-w-0">
            {row.source === 'homeowner_escalated' ? (
              <span className="inline-flex items-center gap-1 text-caption font-medium text-gold-950 flex-shrink-0">
                <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                From homeowner
              </span>
            ) : null}
            <span className="truncate">{subtitle || 'No location'}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {row.media_count > 0 ? (
            <span className="inline-flex items-center gap-1 text-caption text-neutral-600">
              <ImageIcon className="w-3.5 h-3.5" />
              {row.media_count}
            </span>
          ) : null}
          {row.newly_escalated ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-gold-950 text-[11px] font-medium flex-shrink-0">
              Newly escalated
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5 text-caption text-neutral-600">
            <span
              aria-hidden
              className={`w-2 h-2 rounded-full ${statusDotClass(row.status)}`}
            />
            <span className="hidden sm:inline">{statusLabel(row.status)}</span>
          </span>
          <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 text-caption">
            {sourceLabel(row.source)}
          </span>
          <span className="text-caption text-neutral-500 tabular-nums whitespace-nowrap">
            {relativeTime(row.created_at)}
          </span>
        </div>
      </div>
    </button>
  );
}
