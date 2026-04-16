'use client';

import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { SUBMISSIONS, Submission } from './mock-data';
import { InboxShareLink } from './inbox-share-link';
import { InboxPills, InboxPillValue } from './inbox-pills';
import { SubmissionCard } from './submission-card';
import { SubmissionDetail } from './submission-detail';
import { ApproveConfirmModal } from './approve-confirm-modal';

interface InboxViewProps {
  onToast: (text: string) => void;
}

type SubmissionWithDerived = Submission & { filed?: boolean };

export function InboxView({ onToast }: InboxViewProps) {
  const [submissions, setSubmissions] = useState<SubmissionWithDerived[]>(SUBMISSIONS);
  const [activePill, setActivePill] = useState<InboxPillValue>('all');
  const [selectedId, setSelectedId] = useState<string>(SUBMISSIONS[0]?.id ?? '');
  const [approveOpen, setApproveOpen] = useState(false);

  const visible = useMemo(() => {
    if (activePill === 'filed') {
      return submissions.filter((s) => s.filed);
    }
    if (activePill === 'pending') {
      return submissions.filter(
        (s) => !s.filed && (s.status === 'new' || s.status === 'pending')
      );
    }
    if (activePill === 'approved') {
      return submissions.filter((s) => s.status === 'approved' && !s.filed);
    }
    if (activePill === 'rejected') {
      return submissions.filter((s) => s.status === 'rejected');
    }
    return submissions.filter((s) => !s.filed);
  }, [submissions, activePill]);

  const counts = useMemo(
    () => ({
      all: submissions.filter((s) => !s.filed).length,
      pending: submissions.filter(
        (s) => !s.filed && (s.status === 'new' || s.status === 'pending')
      ).length,
      approved: 142,
      filed: 1684 + submissions.filter((s) => s.filed).length,
      rejected: 3,
    }),
    [submissions]
  );

  const selected =
    visible.find((s) => s.id === selectedId) ??
    submissions.find((s) => s.id === selectedId) ??
    visible[0] ??
    null;

  const handleApproveConfirm = (addReminder: boolean) => {
    if (!selected) return;
    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === selected.id ? { ...s, filed: true, status: 'approved' } : s
      )
    );
    setApproveOpen(false);
    const reminderSuffix = addReminder ? ' · Reminder set' : '';
    onToast(
      `${selected.files.length || selected.fileChips[0]?.label || 'Files'} filed to archive · Submission moved to Filed${reminderSuffix}`
    );
  };

  return (
    <div
      className="grid overflow-hidden min-h-[800px]"
      style={{ gridTemplateColumns: '1fr 440px' }}
    >
      <div className="flex flex-col overflow-hidden border-r border-[#EAEAE4]">
        <div className="px-8 pt-5 pb-3.5 bg-[#FAFAF8] border-b border-[#EAEAE4]">
          <div className="flex justify-between items-center mb-3.5">
            <div>
              <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-[#111111] mb-0.5">
                Submissions Inbox
              </h2>
              <p className="text-[12.5px] text-[#8A8A82]">
                Third-party installer submissions from jobs completed on behalf of SE Systems
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#EAEAE4] rounded-lg text-[13px] font-medium text-[#111111] hover:bg-[#F7F7F4] hover:border-[#D9D9D1] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
            >
              <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} />
              Refresh
            </button>
          </div>

          <InboxShareLink
            url="portal.openhouseai.ie/upload/se-systems-cork"
            onCopyToast={onToast}
          />

          <InboxPills active={activePill} onChange={setActivePill} counts={counts} />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {visible.length === 0 ? (
            <div className="text-center py-20 text-[13px] text-[#8A8A82]">
              No submissions in this view.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {visible.map((s) => (
                <SubmissionCard
                  key={s.id}
                  submission={s}
                  selected={selected?.id === s.id}
                  onSelect={setSelectedId}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {selected ? (
        <SubmissionDetail
          submission={selected}
          onReject={() => onToast('Submission rejected (demo)')}
          onRequestChanges={() => onToast('Change request sent (demo)')}
          onApprove={() => setApproveOpen(true)}
        />
      ) : (
        <div className="bg-white flex items-center justify-center text-[13px] text-[#8A8A82]">
          Select a submission to view details
        </div>
      )}

      <ApproveConfirmModal
        open={approveOpen}
        submission={selected}
        onClose={() => setApproveOpen(false)}
        onConfirm={handleApproveConfirm}
      />
    </div>
  );
}
