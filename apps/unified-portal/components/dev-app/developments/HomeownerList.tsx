'use client';

import { User, ExternalLink } from 'lucide-react';

interface Homeowner {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  unit_id: string;
  unit_number: string;
  last_active?: string;
}

interface HomeownerListProps {
  homeowners: Homeowner[];
  occupantLabel: string;
}

export default function HomeownerList({ homeowners, occupantLabel }: HomeownerListProps) {
  return (
    <div className="px-4 space-y-2 pb-4">
      <p className="text-[12px] text-[#6b7280] mb-1">
        {homeowners.length} {occupantLabel.toLowerCase()}{homeowners.length !== 1 ? 's' : ''}
      </p>
      {homeowners.length === 0 ? (
        <p className="text-center text-[13px] text-[#9ca3af] py-8">
          No {occupantLabel.toLowerCase()}s registered yet
        </p>
      ) : (
        homeowners.map((ho) => (
          <div
            key={ho.id}
            className="flex items-center gap-3 p-3.5 rounded-xl border border-[#f3f4f6]"
          >
            <div className="w-9 h-9 rounded-full bg-[#f3f4f6] flex items-center justify-center flex-shrink-0">
              <User size={16} className="text-[#9ca3af]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#111827]">
                {ho.full_name}
              </p>
              <p className="text-[11px] text-[#9ca3af]">
                Unit {ho.unit_number}
                {ho.last_active && ` · Last active ${ho.last_active}`}
              </p>
            </div>
            <ExternalLink size={14} className="text-[#9ca3af] flex-shrink-0" />
          </div>
        ))
      )}
    </div>
  );
}
