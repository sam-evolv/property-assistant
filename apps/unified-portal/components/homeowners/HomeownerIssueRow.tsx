'use client';

/**
 * Sprint 3.5a single-row component inside the Reported Issues card.
 * Tap to expand inline. Renders the thumbnail, title, room, status
 * pill, and (when expanded) the AI assessment and the three action
 * buttons.
 *
 * The expanded view does not navigate or open a drawer; it stays
 * inline so the site team can triage one issue without losing scroll
 * position on the rest.
 */

import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  AlertTriangle,
  CheckCircle2,
  Hammer,
  Shield,
} from 'lucide-react';
import { IssueLightbox } from '@/components/issues/IssueLightbox';
import { ReplyResolveModal } from './ReplyResolveModal';
import { EscalateModal } from './EscalateModal';
import { WarrantyModal } from './WarrantyModal';
import {
  HomeownerIssue,
  formatDate,
  relativeTime,
  statusPillClass,
  statusPillLabel,
} from './types';

interface HomeownerIssueRowProps {
  issue: HomeownerIssue;
  homeownerName: string;
  onRefetch: () => void;
}

export function HomeownerIssueRow({ issue, homeownerName, onRefetch }: HomeownerIssueRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [activeModal, setActiveModal] = useState<'reply' | 'escalate' | 'warranty' | null>(null);

  const isHomeownerNew = issue.status === 'homeowner_new';
  const isResolved = issue.status === 'resolved';
  const showActions = isHomeownerNew && expanded;

  const thumb = issue.first_media?.thumbnail_url ?? issue.first_media?.signed_url ?? null;
  const fullImage = issue.first_media?.signed_url ?? null;

  const placeholderAnalysis =
    !issue.analysis ||
    !issue.analysis.developer_summary ||
    issue.analysis.model_provider === 'placeholder' ||
    /^placeholder/i.test(issue.analysis.developer_summary);

  return (
    <>
      <div
        className={`rounded-lg border transition-colors ${
          isHomeownerNew
            ? 'border-amber-200 bg-amber-50/40'
            : isResolved
              ? 'border-gray-200 bg-white'
              : 'border-blue-200 bg-white'
        }`}
        style={isHomeownerNew ? { borderLeft: '3px solid #d97706' } : undefined}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full text-left p-3 flex items-start gap-3 hover:bg-black/[0.02] rounded-lg transition-colors"
          aria-expanded={expanded}
        >
          <div className="flex-shrink-0">
            {thumb ? (
              <div
                className="w-12 h-12 rounded-md bg-gray-100 bg-cover bg-center border border-gray-200"
                style={{ backgroundImage: `url(${thumb})` }}
                role="img"
                aria-label="Issue photo"
              />
            ) : (
              <div className="w-12 h-12 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-gray-400" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`text-sm font-medium truncate ${isResolved ? 'text-gray-600' : 'text-gray-900'}`}>
                  {issue.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                  {issue.room && (
                    <>
                      <span className="truncate">{issue.room}</span>
                      <span aria-hidden>&middot;</span>
                    </>
                  )}
                  <span>{relativeTime(issue.created_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusPillClass(issue.status)}`}>
                  {statusPillLabel(issue.status, issue.resolution_type)}
                </span>
                {expanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </div>
            {isResolved && issue.resolved_at && (
              <p className="text-xs text-gray-400 mt-0.5">
                Resolved {formatDate(issue.resolved_at)}
              </p>
            )}
          </div>
        </button>

        {expanded && (
          <div className="px-3 pb-3 border-t border-gray-100">
            {fullImage && (
              <button
                type="button"
                onClick={() => setShowLightbox(true)}
                className="block mt-3 w-full rounded-md overflow-hidden border border-gray-200 bg-gray-50 hover:opacity-95 transition-opacity"
                aria-label="View full photo"
              >
                <img
                  src={fullImage}
                  alt={issue.title}
                  className="w-full max-h-72 object-contain bg-black/5"
                />
              </button>
            )}

            {issue.description && (
              <div className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">
                {issue.description}
              </div>
            )}

            <div className="mt-3 rounded-md border border-gray-200 bg-white">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  AI assessment
                </span>
                {placeholderAnalysis && (
                  <span className="text-[10px] text-gray-400">Assessment pending</span>
                )}
              </div>
              <div className="p-3 text-sm text-gray-700">
                {placeholderAnalysis ? (
                  <p className="text-gray-500">
                    Full analysis is not enabled yet. A member of the team can review this manually.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {issue.analysis?.developer_summary && (
                      <p>{issue.analysis.developer_summary}</p>
                    )}
                    {(issue.analysis?.severity_label ||
                      issue.analysis?.likely_trade ||
                      issue.analysis?.likely_system) && (
                      <div className="flex flex-wrap gap-3 pt-1 text-xs text-gray-500">
                        {issue.analysis?.severity_label && (
                          <span className="inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Severity: {issue.analysis.severity_label}
                          </span>
                        )}
                        {issue.analysis?.likely_trade && (
                          <span className="inline-flex items-center gap-1">
                            <Hammer className="w-3 h-3" />
                            {issue.analysis.likely_trade}
                          </span>
                        )}
                        {issue.analysis?.safety_risk && (
                          <span className="inline-flex items-center gap-1 text-red-600">
                            <Shield className="w-3 h-3" />
                            Safety risk
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {showActions && (
              <div className="mt-4 flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setActiveModal('warranty')}
                  className="px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 bg-white hover:bg-gray-50 rounded-lg transition"
                >
                  Mark for warranty
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('escalate')}
                  className="px-3 py-2 text-sm font-medium text-gold-700 border border-gold-300 bg-gold-50 hover:bg-gold-100 rounded-lg transition"
                >
                  Escalate to snag list
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('reply')}
                  className="px-3 py-2 text-sm font-medium text-white bg-gold-500 hover:bg-gold-600 rounded-lg transition inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Reply and resolve
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showLightbox && (
        <IssueLightbox src={fullImage} alt={issue.title} onClose={() => setShowLightbox(false)} />
      )}

      <ReplyResolveModal
        open={activeModal === 'reply'}
        onClose={() => setActiveModal(null)}
        issueId={issue.id}
        homeownerName={homeownerName}
        onResolved={onRefetch}
      />
      <EscalateModal
        open={activeModal === 'escalate'}
        onClose={() => setActiveModal(null)}
        issueId={issue.id}
        onResolved={onRefetch}
      />
      <WarrantyModal
        open={activeModal === 'warranty'}
        onClose={() => setActiveModal(null)}
        issueId={issue.id}
        onResolved={onRefetch}
      />
    </>
  );
}
