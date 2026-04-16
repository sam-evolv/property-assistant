'use client';

import {
  Award,
  Check,
  CheckCircle2,
  ClipboardList,
  FileText,
  Folder,
  MessageSquare,
  Shield,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { Submission, SYSTEM_LABELS } from './mock-data';

const AVATAR_STYLE: Record<Submission['installerColor'], string> = {
  a: 'bg-gradient-to-br from-[#D4AF37] to-[#B8934C] text-[#0B0C0F]',
  b: 'bg-gradient-to-br from-[#3B82F6] to-[#2563EB] text-white',
  c: 'bg-gradient-to-br from-[#10B981] to-[#059669] text-white',
  d: 'bg-gradient-to-br from-[#A855F7] to-[#7C3AED] text-white',
  e: 'bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white',
};

const FILE_ICON = {
  'file-text': FileText,
  award: Award,
  shield: Shield,
  'clipboard-list': ClipboardList,
} as const;

interface SubmissionDetailProps {
  submission: Submission;
  onReject: () => void;
  onRequestChanges: () => void;
  onApprove: () => void;
}

export function SubmissionDetail({
  submission,
  onReject,
  onRequestChanges,
  onApprove,
}: SubmissionDetailProps) {
  return (
    <aside className="bg-white overflow-y-auto flex flex-col h-full">
      <div className="p-6 border-b border-[#EAEAE4]">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8A8A82] uppercase tracking-[0.08em] mb-3">
          <Folder className="w-3 h-3" strokeWidth={1.75} />
          <span>Submission</span>
          <span>·</span>
          <span className="font-mono bg-[#FDF9EB] px-1.5 py-0.5 rounded text-[#D4AF37] tracking-normal">
            {submission.jobRef}
          </span>
        </div>
        <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[#111111] mb-3.5">
          {submission.jobTitle}
        </h2>

        <div className="flex items-center gap-2.5 p-3 bg-[#F3F3EF] rounded-lg">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold flex-shrink-0 ${AVATAR_STYLE[submission.installerColor]}`}
          >
            {submission.installerInitials}
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-[#111111] flex items-center gap-1.5">
              {submission.installerName}
              {submission.verified ? (
                <span className="text-[#D4AF37] inline-flex">
                  <CheckCircle2 className="w-3 h-3" strokeWidth={2} />
                </span>
              ) : null}
            </div>
            <div className="text-[11.5px] text-[#8A8A82]">
              {submission.installerContact.split(',')[0]}, {submission.jobsFiledCount} jobs filed
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[9.5px] text-[#8A8A82] uppercase tracking-[0.08em] font-semibold">
              Trust Score
            </div>
            <div className="text-[13px] font-bold text-[#10B981] flex items-center justify-end gap-1">
              {submission.trustScore}%
              <ShieldCheck className="w-3 h-3" strokeWidth={2} />
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-b border-[#EAEAE4]">
        <div className="text-[10.5px] font-semibold text-[#8A8A82] uppercase tracking-[0.1em] mb-3">
          Job Details
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client" value={submission.clientFullName} />
          <Field label="Job Reference" value={submission.jobRef} mono />
          <Field label="Location" value={submission.location} />
          <Field label="Completion Date" value={submission.completedLabel} />
          <Field label="System" value={submission.systemDetails} />
          {submission.extraLabel && submission.extraDetails ? (
            <Field label={submission.extraLabel} value={submission.extraDetails} />
          ) : null}
        </div>
      </div>

      <div className="px-6 py-4 border-b border-[#EAEAE4]">
        <div className="text-[10.5px] font-semibold text-[#8A8A82] uppercase tracking-[0.1em] mb-3">
          Installer Notes
        </div>
        <div className="text-[13px] text-[#4B4B46] leading-[1.55] p-3 bg-[#FDF9EB] border-l-2 border-[#D4AF37] rounded">
          {submission.notes}
        </div>
      </div>

      <div className="px-6 py-4 border-b border-[#EAEAE4]">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10.5px] font-semibold text-[#8A8A82] uppercase tracking-[0.1em]">
            Attached Files
          </div>
          <div className="text-[11px] text-[#8A8A82] font-medium">
            {submission.files.length} files · {submission.photoCount} photos
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {submission.files.map((file) => {
            const Icon = FILE_ICON[file.icon];
            return (
              <div
                key={file.id}
                className="flex items-center gap-2.5 px-3 py-2.5 bg-[#F3F3EF] border border-[#EAEAE4] rounded-lg cursor-pointer transition-all duration-150 hover:border-[#D9D9D1] hover:bg-[#F7F7F4]"
              >
                <div className="w-7 h-7 rounded-md bg-[#FDF9EB] text-[#D4AF37] flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3 h-3" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium text-[#111111] truncate">
                    {file.name}
                  </div>
                  <div className="text-[10.5px] text-[#8A8A82] mt-px">
                    {file.metaLabel}
                  </div>
                </div>
                <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#D4AF37] px-1.5 py-0.5 bg-[#FDF9EB] rounded flex-shrink-0">
                  <Sparkles className="w-2.5 h-2.5" strokeWidth={2} />
                  Auto
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-6 py-4 border-b border-[#EAEAE4]">
        <div className="p-3.5 bg-[#FDF9EB] border border-[#F0E2B0] rounded-lg flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-md bg-[#D4AF37] text-[#0B0C0F] flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
          </div>
          <div className="text-[12px] leading-[1.5] text-[#4B4B46]">
            <strong className="block text-[#111111] font-semibold mb-0.5 text-[12.5px]">
              AI pre-classified this submission
            </strong>
            On approval, files will file to{' '}
            <Tag>{SYSTEM_LABELS[submission.system]}</Tag>
            <Tag>{submission.client}</Tag>
            <Tag>{submission.jobRef}</Tag>
            and a 30-day follow-up reminder will be added to your calendar.
          </div>
        </div>
      </div>

      <div className="flex-1" />

      <div className="p-4 bg-white border-t border-[#EAEAE4] flex gap-2 sticky bottom-0">
        <button
          type="button"
          onClick={onReject}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-transparent text-[#EF4444] border border-red-500/30 rounded-lg text-[13px] font-medium transition-all duration-150 hover:bg-[#FEF2F2] hover:border-[#EF4444] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2} />
          Reject
        </button>
        <button
          type="button"
          onClick={onRequestChanges}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-transparent text-[#4B4B46] border border-[#EAEAE4] rounded-lg text-[13px] font-medium transition-all duration-150 hover:bg-[#F3F3EF] hover:text-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
        >
          <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.75} />
          Request changes
        </button>
        <button
          type="button"
          onClick={onApprove}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-[#D4AF37] text-[#0B0C0F] rounded-lg text-[13px] font-semibold transition-all duration-150 hover:bg-[#E8C964] hover:shadow-[0_4px_14px_rgba(212,175,55,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
        >
          <Check className="w-3.5 h-3.5" strokeWidth={2} />
          Approve &amp; File
        </button>
      </div>
    </aside>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-[#8A8A82] mb-0.5">{label}</div>
      <div
        className={`text-[13px] text-[#111111] font-medium ${mono ? 'font-mono text-[12px]' : ''}`}
      >
        {value}
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex px-1.5 py-px bg-white text-[#D4AF37] rounded text-[10.5px] font-semibold mx-0.5 border border-[#F0E2B0]">
      {children}
    </span>
  );
}
