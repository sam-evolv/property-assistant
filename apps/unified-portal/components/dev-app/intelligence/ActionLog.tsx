'use client';

import { useEffect, useState } from 'react';
import { Mail, GitBranch, MapPin, ClipboardList, FileText, Radio } from 'lucide-react';

interface ActionItem {
  id: string;
  action_type: string;
  description: string;
  created_at: string;
  development_name?: string;
}

const ACTION_ICONS: Record<string, any> = {
  email_sent: { icon: Mail, color: '#2563eb' },
  email_drafted: { icon: Mail, color: '#6b7280' },
  pipeline_updated: { icon: GitBranch, color: '#7c3aed' },
  site_visit_logged: { icon: MapPin, color: '#059669' },
  task_created: { icon: ClipboardList, color: '#d97706' },
  snag_created: { icon: ClipboardList, color: '#dc2626' },
  document_requested: { icon: FileText, color: '#2563eb' },
  broadcast_sent: { icon: Radio, color: '#D4AF37' },
  note_added: { icon: FileText, color: '#6b7280' },
};

function groupByDate(items: ActionItem[]): Record<string, ActionItem[]> {
  const groups: Record<string, ActionItem[]> = {};
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  items.forEach((item) => {
    const date = new Date(item.created_at).toDateString();
    let label = date;
    if (date === today) label = 'Today';
    else if (date === yesterday) label = 'Yesterday';
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  });

  return groups;
}

export default function ActionLog() {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dev-app/intelligence/actions')
      .then((r) => r.json())
      .then((data) => setActions(data.actions || []))
      .catch(() => setActions([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="px-4 py-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-[#f3f4f6] animate-pulse" />
        ))}
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <p className="text-[15px] font-semibold text-[#111827]">No actions yet</p>
        <p className="text-[13px] text-[#6b7280] mt-1">
          Actions taken by Intelligence will appear here
        </p>
      </div>
    );
  }

  const grouped = groupByDate(actions);

  return (
    <div className="px-4 py-3">
      {Object.entries(grouped).map(([date, items]) => (
        <div key={date} className="mb-4">
          <h3 className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">
            {date}
          </h3>
          <div className="space-y-1.5">
            {items.map((action) => {
              const config = ACTION_ICONS[action.action_type] || {
                icon: FileText,
                color: '#6b7280',
              };
              const Icon = config.icon;
              const time = new Date(action.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <div
                  key={action.id}
                  className="flex items-start gap-2.5 p-3 rounded-xl border border-[#f3f4f6]"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${config.color}10` }}
                  >
                    <Icon size={14} style={{ color: config.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[#111827] leading-snug">
                      {action.description}
                    </p>
                    <p className="text-[10px] text-[#9ca3af] mt-0.5">{time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
