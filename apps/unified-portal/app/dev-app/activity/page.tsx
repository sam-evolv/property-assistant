'use client';

import { useState, useEffect } from 'react';
import {
  GOLD, TEXT_1, TEXT_2, TEXT_3, SURFACE_2, BORDER_LIGHT,
  RED, AMBER, GREEN, BLUE,
} from '@/lib/dev-app/design-system';
import MobileShell from '@/components/dev-app/layout/MobileShell';
import Header from '@/components/dev-app/layout/Header';
import Pills from '@/components/dev-app/shared/Pills';
import BreathingDot from '@/components/dev-app/shared/BreathingDot';

interface ActivityItem {
  id: string;
  type: string;
  category: string;
  title: string;
  detail?: string;
  development_name?: string;
  created_at: string;
}

interface ActivityGroup {
  label: string;
  items: (ActivityItem & { color: string; relTime: string })[];
}

const CATEGORY_COLORS: Record<string, string> = {
  action: GOLD,
  pipeline: BLUE,
  compliance: AMBER,
  snag: RED,
  system: GREEN,
};

const FILTER_OPTIONS = ['All', 'Urgent', 'Pipeline', 'Actions'];

function categoriseFilter(category: string, type: string): string {
  if (type.includes('expired') || type.includes('overdue') || type.includes('red') || category === 'snag') return 'Urgent';
  if (category === 'pipeline') return 'Pipeline';
  if (category === 'action') return 'Actions';
  return 'Pipeline';
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}

function groupByTime(items: (ActivityItem & { color: string; relTime: string })[]): ActivityGroup[] {
  const today: typeof items = [];
  const yesterday: typeof items = [];
  const thisWeek: typeof items = [];
  const older: typeof items = [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 6 * 86400000);

  items.forEach(item => {
    const d = new Date(item.created_at);
    if (d >= todayStart) today.push(item);
    else if (d >= yesterdayStart) yesterday.push(item);
    else if (d >= weekStart) thisWeek.push(item);
    else older.push(item);
  });

  const groups: ActivityGroup[] = [];
  if (today.length) groups.push({ label: 'Today', items: today });
  if (yesterday.length) groups.push({ label: 'Yesterday', items: yesterday });
  if (thisWeek.length) groups.push({ label: 'This Week', items: thisWeek });
  if (older.length) groups.push({ label: 'Earlier', items: older });
  return groups;
}

export default function ActivityPage() {
  const [filter, setFilter] = useState('All');
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dev-app/activity')
      .then(r => r.json())
      .then(data => setItems(data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  // Enrich with color and relative time
  const enriched = items.map(item => ({
    ...item,
    color: CATEGORY_COLORS[item.category] || BLUE,
    relTime: relativeTime(item.created_at),
  }));

  // Apply filter
  const filtered = filter === 'All'
    ? enriched
    : enriched.filter(item => categoriseFilter(item.category, item.type) === filter);

  const groups = groupByTime(filtered);
  const hasResults = groups.length > 0;

  let globalIndex = 0;

  return (
    <MobileShell>
      <Header title="Activity" />

      <div style={{ marginTop: 8, padding: '0 20px' }}>
        <Pills items={FILTER_OPTIONS} active={filter} onSelect={setFilter} />
      </div>

      <div style={{ padding: 20 }}>
        {loading ? (
          [1, 2, 3, 4].map(i => (
            <div
              key={i}
              style={{
                height: 56,
                borderRadius: 12,
                background: SURFACE_2,
                marginBottom: 8,
              }}
              className="da-anim-fade"
            />
          ))
        ) : !hasResults && items.length === 0 ? (
          /* Empty state — no activity at all */
          <div
            style={{
              textAlign: 'center',
              padding: '48px 20px',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏗️</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: TEXT_1, marginBottom: 6 }}>
              No activity yet
            </div>
            <div style={{ fontSize: 13.5, color: TEXT_3, lineHeight: 1.5 }}>
              Activity will appear here as your developments progress — pipeline changes,
              compliance updates, purchaser actions, and more.
            </div>
          </div>
        ) : !hasResults ? (
          /* Filter yields no results */
          <div
            style={{
              textAlign: 'center',
              padding: 40,
              color: TEXT_3,
              fontSize: 14,
            }}
          >
            No {filter.toLowerCase()} items
          </div>
        ) : (
          groups.map((group, groupIdx) => (
            <div key={group.label}>
              <div
                style={{
                  color: TEXT_3,
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: groupIdx === 0 ? 8 : 20,
                  marginBottom: 12,
                }}
              >
                {group.label}
              </div>

              {group.items.map((item, itemIdx) => {
                const staggerClass = `da-s${(globalIndex % 7) + 1}`;
                globalIndex++;

                return (
                  <div
                    key={item.id}
                    className={`da-anim-in ${staggerClass} da-press`}
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: '14px 0',
                      borderBottom: `1px solid ${BORDER_LIGHT}`,
                    }}
                  >
                    <div style={{ paddingTop: 3, flexShrink: 0 }}>
                      {item.color === RED ? (
                        <BreathingDot color={RED} size={10} />
                      ) : (
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: item.color,
                          }}
                        />
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          color: TEXT_1,
                          fontSize: 13.5,
                          fontWeight: 500,
                          lineHeight: 1.4,
                        }}
                      >
                        {item.title}
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span style={{ color: TEXT_3, fontSize: 12 }}>
                          {item.development_name || item.detail || ''}
                        </span>
                        <span style={{ color: TEXT_3, fontSize: 11 }}>
                          {item.relTime}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </MobileShell>
  );
}
