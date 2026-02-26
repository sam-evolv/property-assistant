'use client';

import { useState } from 'react';
import {
  GOLD, TEXT_1, TEXT_2, TEXT_3, SURFACE_1, SURFACE_2, BORDER, BORDER_LIGHT,
  RED, AMBER, GREEN, BLUE, EASE_PREMIUM
} from '@/lib/dev-app/design-system';
import MobileShell from '@/components/dev-app/layout/MobileShell';
import Header from '@/components/dev-app/layout/Header';
import Pills from '@/components/dev-app/shared/Pills';
import BreathingDot from '@/components/dev-app/shared/BreathingDot';

interface ActivityItem {
  time: string;
  text: string;
  detail: string;
  color: string;
  type: 'update' | 'urgent' | 'action';
}

interface ActivityGroup {
  label: string;
  items: ActivityItem[];
}

const ACTIVITY_DATA: ActivityGroup[] = [
  {
    label: 'Today',
    items: [
      { time: '2h ago', text: 'Unit 14 — loan documents uploaded by solicitor', detail: 'Willow Brook', color: GREEN, type: 'update' },
      { time: '3h ago', text: 'Mortgage approval warning — Unit 22 expiring in 2 days', detail: 'Willow Brook', color: RED, type: 'urgent' },
      { time: '4h ago', text: 'Purchaser selected kitchen finish — Unit 7', detail: 'Riverside Gardens', color: BLUE, type: 'update' },
      { time: '5h ago', text: 'New viewing request from M. Kelly', detail: 'Across developments', color: GOLD, type: 'action' },
    ],
  },
  {
    label: 'Yesterday',
    items: [
      { time: '9:30', text: 'Compliance report generated for Willow Brook', detail: 'Willow Brook', color: GREEN, type: 'update' },
      { time: '14:15', text: 'BCMS submission overdue — 4 units flagged', detail: 'Willow Brook', color: AMBER, type: 'urgent' },
      { time: '16:00', text: 'Handover pack approved — Unit 26', detail: 'Willow Brook', color: GREEN, type: 'update' },
    ],
  },
  {
    label: 'This Week',
    items: [
      { time: 'Mon', text: 'Pipeline report shared with stakeholders', detail: 'All developments', color: BLUE, type: 'action' },
      { time: 'Mon', text: '3 new purchaser enquiries received', detail: 'Riverside Gardens', color: GOLD, type: 'update' },
      { time: 'Sun', text: 'Weekly compliance check completed', detail: 'System', color: GREEN, type: 'update' },
    ],
  },
];

const FILTER_OPTIONS = ['All', 'Urgent', 'Updates', 'Actions'];

const FILTER_TYPE_MAP: Record<string, string | null> = {
  All: null,
  Urgent: 'urgent',
  Updates: 'update',
  Actions: 'action',
};

export default function ActivityPage() {
  const [filter, setFilter] = useState('All');

  const filterType = FILTER_TYPE_MAP[filter];

  const filteredGroups = ACTIVITY_DATA.map(group => ({
    label: group.label,
    items: filterType ? group.items.filter(item => item.type === filterType) : group.items,
  })).filter(group => group.items.length > 0);

  const hasResults = filteredGroups.length > 0;

  let globalIndex = 0;

  return (
    <MobileShell>
      <Header title="Activity" />

      <div style={{ marginTop: 8, padding: '0 20px' }}>
        <Pills items={FILTER_OPTIONS} active={filter} onSelect={setFilter} />
      </div>

      <div style={{ padding: 20 }}>
        {hasResults ? (
          filteredGroups.map((group, groupIdx) => (
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
                    key={`${group.label}-${itemIdx}`}
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
                        {item.text}
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span style={{ color: TEXT_3, fontSize: 12 }}>
                          {item.detail}
                        </span>
                        <span style={{ color: TEXT_3, fontSize: 11 }}>
                          {item.time}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        ) : (
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
        )}
      </div>
    </MobileShell>
  );
}
