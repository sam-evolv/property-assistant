'use client';

import ProgressRing from '../shared/ProgressRing';
import { Check, Clock, X } from 'lucide-react';

interface ComplianceUnit {
  unit_id: string;
  unit_number: string;
  documents: Array<{
    type: string;
    status: 'complete' | 'pending' | 'missing' | 'overdue';
  }>;
}

interface ComplianceViewProps {
  units: ComplianceUnit[];
  overallPct: number;
  documentTypes: string[];
}

const STATUS_ICONS = {
  complete: { icon: Check, color: '#059669', bg: '#059669' },
  pending: { icon: Clock, color: '#d97706', bg: '#d97706' },
  missing: { icon: X, color: '#dc2626', bg: '#dc2626' },
  overdue: { icon: X, color: '#dc2626', bg: '#dc2626' },
};

export default function ComplianceView({ units, overallPct, documentTypes }: ComplianceViewProps) {
  return (
    <div className="px-4">
      {/* Overall progress */}
      <div className="flex items-center justify-center gap-4 py-4">
        <ProgressRing progress={overallPct} size={72} strokeWidth={6}>
          <span className="text-[16px] font-bold text-[#111827]">{overallPct}%</span>
        </ProgressRing>
        <div>
          <p className="text-[14px] font-semibold text-[#111827]">Overall Compliance</p>
          <p className="text-[12px] text-[#6b7280]">
            {units.length} units tracked
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto scrollbar-hide">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-[#f3f4f6]">
              <th className="py-2 px-2 text-left font-semibold text-[#6b7280] sticky left-0 bg-white">
                Unit
              </th>
              {documentTypes.map((type) => (
                <th
                  key={type}
                  className="py-2 px-2 text-center font-semibold text-[#6b7280] whitespace-nowrap"
                >
                  {type}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr key={unit.unit_id} className="border-b border-[#f3f4f6]">
                <td className="py-2 px-2 font-medium text-[#111827] sticky left-0 bg-white">
                  {unit.unit_number}
                </td>
                {documentTypes.map((type) => {
                  const doc = unit.documents.find((d) => d.type === type);
                  const status = doc?.status || 'missing';
                  const config = STATUS_ICONS[status];
                  const Icon = config.icon;

                  return (
                    <td key={type} className="py-2 px-2 text-center">
                      <div className="flex items-center justify-center">
                        <Icon size={14} style={{ color: config.color }} />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
