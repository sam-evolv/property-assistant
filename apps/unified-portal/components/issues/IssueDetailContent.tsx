'use client';

/**
 * Shared detail view used by both the drawer (IssueDetailDrawer) and
 * the standalone page (/developer/issues/[id]). Spec section 6.5/6.6.
 *
 * Renders:
 *   - title + unit/development/room subtitle
 *   - source badge, status dot, severity label row
 *   - photo grid (3 across, opens lightbox)
 *   - resident message / snag notes
 *   - AI assessment (collapsed by default when model_provider is
 *     'placeholder')
 *   - notes section with new-note input and existing list
 *   - timeline of issue_events
 *
 * The component owns local state for which photo is in the lightbox,
 * whether the AI assessment is expanded, and the optimistic notes
 * append. Parent owns the issue payload and supplies a refresh hook
 * (re-fetches /api/issues/[id] when the flag changes elsewhere).
 */

import { useMemo, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import {
  IssueAnalysis,
  IssueDetailResponse,
  IssueNote,
  severityLabel,
  sourceLabel,
  statusDotClass,
  statusLabel,
} from './types';
import { IssueLightbox } from './IssueLightbox';
import { IssueNotesSection } from './IssueNotesSection';
import { IssueTimeline } from './IssueTimeline';

interface IssueDetailContentProps {
  data: IssueDetailResponse;
  onNoteAdded?: (note: IssueNote) => void;
}

export function IssueDetailContent({ data, onNoteAdded }: IssueDetailContentProps) {
  const { report, media, analysis, events } = data;
  const [notes, setNotes] = useState<IssueNote[]>(data.notes);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const placeholderAnalysis = isPlaceholderAnalysis(analysis);
  const [assessmentOpen, setAssessmentOpen] = useState<boolean>(!placeholderAnalysis && !!analysis);

  const subtitleParts = [
    report.unit_display_name,
    report.development_name,
    report.room,
  ].filter(Boolean) as string[];
  const subtitle = subtitleParts.join(' . ');

  const handleNoteAdded = (note: IssueNote) => {
    setNotes((curr) => [note, ...curr]);
    onNoteAdded?.(note);
  };

  const residentMessage = report.description?.trim() ?? '';

  const flaggedBadge = useMemo(() => {
    if (!report.developer_flagged) return null;
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-caption">
        Flagged
      </span>
    );
  }, [report.developer_flagged]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-heading-md text-neutral-900 break-words">{report.title}</h2>
        {subtitle ? (
          <p className="text-body-sm text-neutral-500">{subtitle}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 text-caption">
            {sourceLabel(report.source)}
          </span>
          <span className="inline-flex items-center gap-1.5 text-caption text-neutral-700">
            <span
              aria-hidden
              className={`w-2 h-2 rounded-full ${statusDotClass(report.status)}`}
            />
            {statusLabel(report.status)}
          </span>
          <span className="text-caption text-neutral-700">
            Severity: {severityLabel(report.severity_label)}
          </span>
          {flaggedBadge}
        </div>
      </header>

      {media.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-body-sm font-semibold text-neutral-900 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-neutral-500" />
            Photos
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {media.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setLightboxSrc(m.signed_url || m.thumbnail_url)}
                className="block aspect-square bg-neutral-100 border border-neutral-200 rounded-md overflow-hidden hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <img
                  src={m.thumbnail_url || m.signed_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {residentMessage ? (
        <section className="space-y-2">
          <h3 className="text-body-sm font-semibold text-neutral-900">
            {report.source === 'homeowner_assistant' ? 'Resident message' : 'Snag notes'}
          </h3>
          <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-body-sm text-neutral-800 whitespace-pre-wrap break-words">
            {residentMessage}
          </div>
        </section>
      ) : null}

      {analysis ? (
        <AssessmentSection
          analysis={analysis}
          isPlaceholder={placeholderAnalysis}
          open={assessmentOpen}
          onToggle={() => setAssessmentOpen((v) => !v)}
        />
      ) : null}

      <IssueNotesSection issueId={report.id} notes={notes} onAdded={handleNoteAdded} />

      <IssueTimeline events={events} />

      <IssueLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}

interface AssessmentSectionProps {
  analysis: IssueAnalysis;
  isPlaceholder: boolean;
  open: boolean;
  onToggle: () => void;
}

function AssessmentSection({ analysis, isPlaceholder, open, onToggle }: AssessmentSectionProps) {
  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <h3 className="text-body-sm font-semibold text-neutral-900">
          AI assessment
          {isPlaceholder ? (
            <span className="ml-2 text-caption font-normal text-neutral-500">
              (placeholder)
            </span>
          ) : null}
        </h3>
        <span className="text-caption text-neutral-500">
          {open ? 'Hide' : 'Show'}
        </span>
      </button>

      {open ? (
        <div className="rounded-lg border border-neutral-200 bg-white px-3 py-3 space-y-2">
          {analysis.summary ? (
            <p className="text-body-sm text-neutral-800 whitespace-pre-wrap">
              {analysis.summary}
            </p>
          ) : null}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-caption">
            {analysis.severity_label ? (
              <Field
                label="Severity"
                value={`${analysis.severity_label}${
                  analysis.severity_score !== null && analysis.severity_score !== undefined
                    ? ` (${analysis.severity_score})`
                    : ''
                }`}
              />
            ) : null}
            {analysis.safety_risk ? (
              <Field label="Safety risk" value={analysis.safety_risk} />
            ) : null}
            {analysis.likely_trade ? (
              <Field label="Likely trade" value={analysis.likely_trade} />
            ) : null}
            {analysis.likely_system ? (
              <Field label="System" value={analysis.likely_system} />
            ) : null}
            {analysis.suggested_priority ? (
              <Field label="Priority" value={analysis.suggested_priority} />
            ) : null}
            {analysis.model_provider ? (
              <Field
                label="Model"
                value={`${analysis.model_provider}${
                  analysis.model_name ? ` . ${analysis.model_name}` : ''
                }`}
              />
            ) : null}
          </dl>

          {analysis.reasoning || analysis.ai_reasoning ? (
            <div>
              <div className="text-caption font-semibold text-neutral-700 mb-0.5">
                Reasoning
              </div>
              <p className="text-body-sm text-neutral-700 whitespace-pre-wrap">
                {(analysis.reasoning as string) || (analysis.ai_reasoning as string)}
              </p>
            </div>
          ) : null}

          {analysis.recommended_action ? (
            <div>
              <div className="text-caption font-semibold text-neutral-700 mb-0.5">
                Recommended action
              </div>
              <p className="text-body-sm text-neutral-700 whitespace-pre-wrap">
                {analysis.recommended_action}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

interface FieldProps {
  label: string;
  value: string | null | undefined;
}

function Field({ label, value }: FieldProps) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-neutral-900">{value}</dd>
    </div>
  );
}

function isPlaceholderAnalysis(analysis: IssueAnalysis | null): boolean {
  if (!analysis) return false;
  const provider = analysis.model_provider;
  return provider === 'placeholder';
}
