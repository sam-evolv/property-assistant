'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail,
  GitBranch,
  MapPin,
  ClipboardList,
  FileText,
  Radio,
  Shield,
  Wrench,
  AlertTriangle,
  Check,
  Clock,
} from 'lucide-react';
import { useStaggeredEntrance } from '@/hooks/useDevApp';

interface ActivityItem {
  id: string;
  type: string;
  category: 'action' | 'pipeline' | 'compliance' | 'snag' | 'system';
  title: string;
  detail?: string;
  development_name?: string;
  development_id?: string;
  created_at: string;
}

const CATEGORY_ICONS: Record<string, { icon: any; color: string }> = {
  // Intelligence actions
  email_sent: { icon: Mail, color: '#2563eb' },
  email_drafted: { icon: Mail, color: '#6b7280' },
  pipeline_updated: { icon: GitBranch, color: '#7c3aed' },
  site_visit_logged: { icon: MapPin, color: '#059669' },
  task_created: { icon: ClipboardList, color: '#d97706' },
  snag_created: { icon: Wrench, color: '#dc2626' },
  document_requested: { icon: FileText, color: '#2563eb' },
  broadcast_sent: { icon: Radio, color: '#D4AF37' },
  note_added: { icon: FileText, color: '#6b7280' },
  // Pipeline
  pipeline: { icon: GitBranch, color: '#7c3aed' },
  // Compliance
  compliance_complete: { icon: Check, color: '#059669' },
  compliance_pending: { icon: Clock, color: '#d97706' },
  compliance_overdue: { icon: AlertTriangle, color: '#dc2626' },
  compliance_missing: { icon: Shield, color: '#dc2626' },
  // Snags
  snag_open: { icon: Wrench, color: '#dc2626' },
  snag_in_progress: { icon: Wrench, color: '#d97706' },
  snag_resolved: { icon: Check, color: '#059669' },
};

const CATEGORY_LABELS: Record<string, string> = {
  action: 'Intelligence',
  pipeline: 'Pipeline',
  compliance: 'Compliance',
  snag: 'Snagging',
  system: 'System',
};

const CATEGORY_FILTER_COLORS: Record<string, string> = {
  all: '#D4AF37',
  action: '#2563eb',
  pipeline: '#7c3aed',
  compliance: '#059669',
  snag: '#dc2626',
};

function groupByDate(items: ActivityItem[]): Record<string, ActivityItem[]> {
  const groups: Record<string, ActivityItem[]> = {};
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  items.forEach((item) => {
    const date = new Date(item.created_at).toDateString();
    let label = new Date(item.created_at).toLocaleDateString('en-IE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    if (date === today) label = 'Today';
    else if (date === yesterday) label = 'Yesterday';
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  });

  return groups;
}

export default function ActivityFeed() {
  const router = useRouter();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetch('/api/dev-app/activity')
      .then((r) => r.json())
      .then((data) => setItems(data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    filter === 'all' ? items : items.filter((i) => i.category === filter);

  const visibleCount = useStaggeredEntrance(filtered.length);

  if (loading) {
    return (
      <div className="px-4 py-6 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-[#f3f4f6] animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#f3f4f6] flex items-center justify-center mb-3">
          <ClipboardList size={24} className="text-[#9ca3af]" />
        </div>
        <p className="text-[15px] font-semibold text-[#111827]">
          No activity yet
        </p>
        <p className="text-[13px] text-[#6b7280] mt-1">
          Pipeline changes, compliance updates, and actions will appear here
        </p>
      </div>
    );
  }

  // Get unique categories present
  const categories = ['all', ...new Set(items.map((i) => i.category))];

  const grouped = groupByDate(filtered);

  return (
    <div>
      {/* Category filter chips */}
      <div className="px-4 pt-2 pb-1">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-2">
          {categories.map((cat) => {
            const isActive = filter === cat;
            const color = CATEGORY_FILTER_COLORS[cat] || '#6b7280';
            const label = cat === 'all' ? 'All' : CATEGORY_LABELS[cat] || cat;
            const count =
              cat === 'all'
                ? items.length
                : items.filter((i) => i.category === cat).length;

            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all active:scale-[0.97]"
                style={{
                  backgroundColor: isActive ? `${color}15` : '#f3f4f6',
                  color: isActive ? color : '#6b7280',
                  border: `1px solid ${isActive ? `${color}30` : 'transparent'}`,
                }}
              >
                {label}
                <span
                  className="text-[9px] font-bold px-1 py-0.5 rounded-full min-w-[16px] text-center"
                  style={{
                    backgroundColor: isActive ? `${color}15` : '#e5e7eb',
                    color: isActive ? color : '#9ca3af',
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Activity timeline */}
      <div className="px-4 py-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <p className="text-[13px] text-[#6b7280]">
              No {CATEGORY_LABELS[filter]?.toLowerCase() || ''} activity
            </p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, dateItems]) => (
            <div key={date} className="mb-4">
              <h3 className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">
                {date}
              </h3>
              <div className="space-y-1.5">
                {dateItems.map((item, i) => {
                  const config = CATEGORY_ICONS[item.type] ||
                    CATEGORY_ICONS[item.category] || {
                      icon: FileText,
                      color: '#6b7280',
                    };
                  const Icon = config.icon;
                  const time = new Date(item.created_at).toLocaleTimeString(
                    [],
                    {
                      hour: '2-digit',
                      minute: '2-digit',
                    }
                  );

                  const globalIdx = filtered.indexOf(item);
                  const visible = globalIdx < visibleCount;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.development_id) {
                          router.push(
                            `/dev-app/developments/${item.development_id}`
                          );
                        }
                      }}
                      className="w-full flex items-start gap-2.5 p-3 rounded-xl border border-[#f3f4f6] bg-white text-left transition-all active:scale-[0.98]"
                      style={{
                        opacity: visible ? 1 : 0,
                        transform: visible ? 'translateY(0)' : 'translateY(8px)',
                        transition:
                          'opacity 0.3s cubic-bezier(0.16,1,0.3,1), transform 0.3s cubic-bezier(0.16,1,0.3,1)',
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${config.color}10` }}
                      >
                        <Icon size={14} style={{ color: config.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[#111827] leading-snug">
                          {item.title}
                        </p>
                        {item.detail && (
                          <p className="text-[11px] text-[#6b7280] mt-0.5">
                            {item.detail}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-[#9ca3af]">
                            {time}
                          </span>
                          {item.development_name && (
                            <>
                              <span className="text-[10px] text-[#d4d4d8]">
                                ·
                              </span>
                              <span className="text-[10px] text-[#9ca3af] font-medium">
                                {item.development_name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
