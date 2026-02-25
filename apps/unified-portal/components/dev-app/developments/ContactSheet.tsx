'use client';

import { X, Phone, Mail, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UnitContact {
  unit_id: string;
  unit_number: string;
  purchaser_name: string;
  phone?: string;
  email?: string;
  solicitor?: string;
  agent?: string;
  deposit?: number;
  price?: number;
  stage: string;
  days_at_stage: number;
  status: 'green' | 'amber' | 'red';
}

interface ContactSheetProps {
  unit: UnitContact | null;
  onClose: () => void;
}

const STATUS_LABELS = {
  green: { label: 'On track', color: '#059669' },
  amber: { label: 'Monitor', color: '#d97706' },
  red: { label: 'Needs attention', color: '#dc2626' },
};

export default function ContactSheet({ unit, onClose }: ContactSheetProps) {
  const router = useRouter();

  if (!unit) return null;

  const statusConfig = STATUS_LABELS[unit.status];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl sheet-enter"
        style={{
          paddingBottom:
            'calc(16px + var(--safe-bottom, env(safe-area-inset-bottom, 0px)))',
          maxHeight: '80vh',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-[#e5e7eb]" />
        </div>

        <div className="px-5 pb-4 overflow-y-auto">
          {/* Close button */}
          <div className="flex justify-end mb-1">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-[#f3f4f6] active:scale-95"
            >
              <X size={16} className="text-[#6b7280]" />
            </button>
          </div>

          {/* Unit info */}
          <h2 className="text-[18px] font-bold text-[#111827]">
            Unit {unit.unit_number} — {unit.purchaser_name}
          </h2>
          <div className="flex items-center gap-2 mt-1 mb-4">
            <span className="text-[13px] text-[#6b7280]">
              {unit.stage} · {unit.days_at_stage} days
            </span>
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                color: statusConfig.color,
                backgroundColor: `${statusConfig.color}10`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: statusConfig.color }}
              />
              {statusConfig.label}
            </span>
          </div>

          {/* Contact actions */}
          <div className="space-y-2 mb-4">
            {unit.phone && (
              <a
                href={`tel:${unit.phone}`}
                className="flex items-center gap-3 p-3 rounded-xl border border-[#f3f4f6] active:scale-[0.98] transition"
              >
                <div className="w-9 h-9 rounded-full bg-[rgba(5,150,105,0.1)] flex items-center justify-center">
                  <Phone size={16} className="text-[#059669]" />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-[#111827]">
                    {unit.phone}
                  </p>
                  <p className="text-[11px] text-[#9ca3af]">Call</p>
                </div>
              </a>
            )}
            {unit.email && (
              <a
                href={`mailto:${unit.email}`}
                className="flex items-center gap-3 p-3 rounded-xl border border-[#f3f4f6] active:scale-[0.98] transition"
              >
                <div className="w-9 h-9 rounded-full bg-[rgba(37,99,235,0.1)] flex items-center justify-center">
                  <Mail size={16} className="text-[#2563eb]" />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-[#111827]">
                    {unit.email}
                  </p>
                  <p className="text-[11px] text-[#9ca3af]">Email</p>
                </div>
              </a>
            )}
          </div>

          {/* Details */}
          <div className="space-y-2 mb-4">
            {unit.solicitor && (
              <div className="flex justify-between py-2 border-b border-[#f3f4f6]">
                <span className="text-[12px] text-[#6b7280]">Solicitor</span>
                <span className="text-[12px] font-medium text-[#111827]">
                  {unit.solicitor}
                </span>
              </div>
            )}
            {unit.agent && (
              <div className="flex justify-between py-2 border-b border-[#f3f4f6]">
                <span className="text-[12px] text-[#6b7280]">Agent</span>
                <span className="text-[12px] font-medium text-[#111827]">
                  {unit.agent}
                </span>
              </div>
            )}
            {unit.deposit != null && (
              <div className="flex justify-between py-2 border-b border-[#f3f4f6]">
                <span className="text-[12px] text-[#6b7280]">Deposit</span>
                <span className="text-[12px] font-medium text-[#111827]">
                  {'\u20AC'}{unit.deposit.toLocaleString()}
                </span>
              </div>
            )}
            {unit.price != null && (
              <div className="flex justify-between py-2 border-b border-[#f3f4f6]">
                <span className="text-[12px] text-[#6b7280]">Price</span>
                <span className="text-[12px] font-medium text-[#111827]">
                  {'\u20AC'}{unit.price.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Intelligence CTA */}
          <button
            onClick={() => {
              onClose();
              router.push(
                `/dev-app/intelligence?unit=${unit.unit_number}&unit_id=${unit.unit_id}`
              );
            }}
            className="w-full py-3 rounded-xl font-semibold text-[14px] text-white transition active:scale-[0.97]"
            style={{ backgroundColor: '#D4AF37' }}
          >
            <span className="flex items-center justify-center gap-2">
              <Sparkles size={16} />
              Ask Intelligence About Unit
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
