'use client';

import {
  Award,
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileText,
  Image as ImageIcon,
  MapPin,
  ShieldCheck,
  User,
} from 'lucide-react';
import { Submission } from './mock-data';

const AVATAR_STYLE: Record<Submission['installerColor'], string> = {
  a: 'bg-gradient-to-br from-[#D4AF37] to-[#B8934C] text-[#0B0C0F]',
  b: 'bg-gradient-to-br from-[#3B82F6] to-[#2563EB] text-white',
  c: 'bg-gradient-to-br from-[#10B981] to-[#059669] text-white',
  d: 'bg-gradient-to-br from-[#A855F7] to-[#7C3AED] text-white',
  e: 'bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white',
};

const FILE_CHIP_ICON = {
  'file-text': FileText,
  image: ImageIcon,
  'clipboard-list': ClipboardList,
  award: Award,
  'shield-check': ShieldCheck,
} as const;

interface SubmissionCardProps {
  submission: Submission;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function SubmissionCard({ submission, selected, onSelect }: SubmissionCardProps) {
  const accentClass =
    submission.status === 'new'
      ? 'before:bg-[#D4AF37]'
      : submission.status === 'pending'
        ? 'before:bg-[#F59E0B]'
        : 'before:bg-transparent';

  const selectedClass = selected
    ? 'border-[#D4AF37] bg-[#FDF9EB] shadow-[0_0_0_3px_rgba(212,175,55,0.1)]'
    : 'border-[#EAEAE4] bg-white hover:border-[#D9D9D1] hover:shadow-md';

  return (
    <button
      type="button"
      onClick={() => onSelect(submission.id)}
      className={`relative w-full text-left border rounded-xl px-4 py-3.5 cursor-pointer transition-all duration-150 overflow-hidden before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${accentClass} ${selectedClass}`}
    >
      <div className="flex justify-between items-start mb-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 ${AVATAR_STYLE[submission.installerColor]}`}
          >
            {submission.installerInitials}
          </div>
          <div>
            <div className="text-[13px] font-semibold text-[#111111] flex items-center gap-1.5">
              {submission.installerName}
              {submission.verified ? (
                <span className="text-[#D4AF37] inline-flex" title="Verified partner">
                  <CheckCircle2 className="w-3 h-3" strokeWidth={2} />
                </span>
              ) : null}
            </div>
            <div className="text-[11.5px] text-[#8A8A82]">
              {submission.installerContact}
            </div>
          </div>
        </div>
        <div className="text-[11px] text-[#8A8A82] flex items-center gap-1.5">
          {submission.status === 'new' ? (
            <span className="bg-[#D4AF37] text-[#0B0C0F] text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-[0.05em]">
              New
            </span>
          ) : null}
          {submission.submittedRelative}
        </div>
      </div>

      <div className="text-[14px] font-semibold text-[#111111] mb-1.5 tracking-[-0.01em]">
        {submission.jobTitle}
      </div>

      <div className="flex gap-2.5 items-center text-[11.5px] text-[#8A8A82] mb-2.5 flex-wrap">
        <span className="font-mono text-[10.5px] px-1.5 py-0.5 bg-[#F3F3EF] rounded text-[#4B4B46]">
          {submission.jobRef}
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPin className="w-2.5 h-2.5" strokeWidth={1.75} />
          {submission.location}
        </span>
        <span className="inline-flex items-center gap-1">
          <User className="w-2.5 h-2.5" strokeWidth={1.75} />
          {submission.client}
        </span>
        {submission.status === 'new' ? (
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-2.5 h-2.5" strokeWidth={1.75} />
            Completed today
          </span>
        ) : null}
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {submission.fileChips.map((chip) => {
          const Icon = FILE_CHIP_ICON[chip.icon];
          return (
            <span
              key={chip.label}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F3F3EF] rounded text-[11px] text-[#4B4B46]"
            >
              <Icon className="w-2.5 h-2.5 text-[#D4AF37]" strokeWidth={1.75} />
              {chip.label}
            </span>
          );
        })}
      </div>
    </button>
  );
}
