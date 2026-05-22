'use client';

/**
 * Sprint 3.5a Reported Issues card. The main attention surface on
 * /developer/homeowners/[id] when the feature flag is on. Lists
 * homeowner_new items first with an amber accent, then open and
 * reopened, then resolved at the bottom in a more compact treatment.
 *
 * Data source: GET /api/homeowners/[id]/issues where [id] is the
 * unit's UUID (matches the codebase convention for this route family).
 *
 * The site team triages from here:
 *   - Tap a row to expand inline and see the photo and AI assessment
 *   - Use one of the three action buttons (Reply and resolve, Escalate
 *     to snag list, Mark for warranty) to move the item to its next
 *     state
 *   - Resolved items stay visible for context but become read-only
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, FileWarning, Inbox } from 'lucide-react';
import { HomeownerIssueRow } from './HomeownerIssueRow';
import { HomeownerIssue, HomeownerIssuesResponse, compareIssues } from './types';

interface HomeownerIssuesCardProps {
  homeownerId: string;
  homeownerName: string;
}

export function HomeownerIssuesCard({ homeownerId, homeownerName }: HomeownerIssuesCardProps) {
  const [issues, setIssues] = useState<HomeownerIssue[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIssues = useCallback(async () => {
    try {
      const res = await fetch(`/api/homeowners/${homeownerId}/issues`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        setError('Could not load issues for this homeowner.');
        setIssues([]);
        return;
      }
      const data = (await res.json()) as HomeownerIssuesResponse;
      const sorted = [...(data.issues ?? [])].sort(compareIssues);
      setIssues(sorted);
      setError(null);
    } catch {
      setError('Could not load issues for this homeowner.');
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }, [homeownerId]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const awaitingReview =
    issues?.filter((i) => i.status === 'homeowner_new').length ?? 0;
  const activeIssues = issues?.filter((i) => i.status !== 'resolved') ?? [];
  const resolvedIssues = issues?.filter((i) => i.status === 'resolved') ?? [];

  return (
    <div className="bg-white rounded-xl border-[1.5px] border-gray-200 shadow-card overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FileWarning className="w-4 h-4 text-gold-500" />
            <h2 className="text-heading-sm text-gray-900">Reported Issues</h2>
          </div>
          {awaitingReview > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              {awaitingReview} awaiting review
            </span>
          )}
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-16 rounded-lg bg-gray-100 animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-6 text-sm text-red-600 flex flex-col items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        ) : (issues?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gold-50 flex items-center justify-center mb-4">
              <Inbox className="w-8 h-8 text-gold-500" />
            </div>
            <p className="text-sm font-medium text-gray-900">
              No issues raised by this homeowner yet.
            </p>
            <p className="text-xs text-gray-500 mt-1 max-w-xs">
              Issues raised through the assistant chat or escalated by site team will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeIssues.length > 0 && (
              <div className="space-y-2">
                {activeIssues.map((issue) => (
                  <HomeownerIssueRow
                    key={issue.id}
                    issue={issue}
                    homeownerName={homeownerName}
                    onRefetch={fetchIssues}
                  />
                ))}
              </div>
            )}

            {resolvedIssues.length > 0 && (
              <div className="space-y-2">
                {activeIssues.length > 0 && (
                  <div className="pt-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400 pb-1">
                      Resolved
                    </p>
                  </div>
                )}
                {resolvedIssues.map((issue) => (
                  <HomeownerIssueRow
                    key={issue.id}
                    issue={issue}
                    homeownerName={homeownerName}
                    onRefetch={fetchIssues}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
