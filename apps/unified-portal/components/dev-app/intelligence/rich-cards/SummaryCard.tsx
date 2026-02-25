'use client';

interface SummaryData {
  title: string;
  items: Array<{
    unit_name: string;
    status: 'green' | 'amber' | 'red';
    detail: string;
  }>;
}

const STATUS_DOT = {
  green: '#059669',
  amber: '#d97706',
  red: '#dc2626',
};

export default function SummaryCard({ data }: { data: SummaryData }) {
  return (
    <div className="rounded-xl border border-[#f3f4f6] overflow-hidden bg-white">
      <div className="px-3.5 py-2.5 bg-[#f9fafb] border-b border-[#f3f4f6]">
        <p className="text-[12px] font-bold text-[#111827]">{data.title}</p>
      </div>
      <div className="divide-y divide-[#f3f4f6]">
        {data.items.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5 px-3.5 py-2.5">
            <span
              className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
              style={{ backgroundColor: STATUS_DOT[item.status] }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-[#111827]">
                {item.unit_name}
              </p>
              <p className="text-[11px] text-[#6b7280] mt-0.5">
                {item.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
