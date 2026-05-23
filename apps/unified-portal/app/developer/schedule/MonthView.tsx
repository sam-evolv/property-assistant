'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import {
  addDays,
  dublinDateKey,
  eventTypeColour,
  formatDublinDate,
  formatDublinTime,
  ScheduleEvent,
} from './eventTypes';

interface MonthViewProps {
  start: Date;
  monthAnchor: Date;
  events: ScheduleEvent[];
  loading: boolean;
  onEventClick: (id: string) => void;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function monthOf(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Dublin',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d);
  return `${parts.find((p) => p.type === 'year')!.value}-${parts.find((p) => p.type === 'month')!.value}`;
}

function dayLabel(d: Date): string {
  return new Intl.DateTimeFormat('en-IE', {
    timeZone: 'Europe/Dublin',
    day: 'numeric',
  }).format(d);
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function MonthView({ start, monthAnchor, events, loading, onEventClick }: MonthViewProps) {
  const [dayDrawerKey, setDayDrawerKey] = useState<string | null>(null);

  const todayKey = dublinDateKey(new Date());
  const monthKey = monthOf(monthAnchor);

  const cells: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    cells.push(addDays(start, i));
  }

  const eventsByDay = new Map<string, ScheduleEvent[]>();
  for (const e of events) {
    const key = dublinDateKey(new Date(e.starts_at));
    const list = eventsByDay.get(key) ?? [];
    list.push(e);
    eventsByDay.set(key, list);
  }
  for (const list of eventsByDay.values()) {
    list.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }

  const dayDrawerEvents = dayDrawerKey ? eventsByDay.get(dayDrawerKey) ?? [] : [];
  const dayDrawerDate = dayDrawerKey
    ? new Date(
        Date.UTC(
          parseInt(dayDrawerKey.slice(0, 4), 10),
          parseInt(dayDrawerKey.slice(5, 7), 10) - 1,
          parseInt(dayDrawerKey.slice(8, 10), 10),
          12,
          0,
          0,
        ),
      )
    : null;

  return (
    <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
      <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="px-3 py-2 text-center text-xs uppercase tracking-wider text-neutral-500 font-semibold border-l first:border-l-0 border-neutral-200"
          >
            {name}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const key = dublinDateKey(d);
          const isToday = key === todayKey;
          const isCurrentMonth = monthOf(d) === monthKey;
          const dayEvents = eventsByDay.get(key) ?? [];
          const overflow = dayEvents.length > 3 ? dayEvents.length - 3 : 0;
          const visible = dayEvents.slice(0, 3);
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (dayEvents.length > 0) setDayDrawerKey(key);
              }}
              className={`relative min-h-[96px] text-left p-1.5 border-l first:border-l-0 border-t border-neutral-200 first:border-t-0 align-top ${
                isCurrentMonth ? 'bg-white' : 'bg-neutral-50/60'
              } ${isToday ? 'ring-2 ring-gold-500 ring-inset' : ''} ${
                dayEvents.length === 0 ? 'cursor-default' : 'hover:bg-neutral-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-semibold ${
                    isCurrentMonth ? (isToday ? 'text-gold-700' : 'text-neutral-700') : 'text-neutral-400'
                  }`}
                >
                  {dayLabel(d)}
                </span>
              </div>
              <div className="space-y-1">
                {visible.map((e) => {
                  const cancelled = e.status === 'cancelled';
                  const colour = eventTypeColour(e.event_type);
                  return (
                    <div
                      key={e.id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEventClick(e.id);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault();
                          ev.stopPropagation();
                          onEventClick(e.id);
                        }
                      }}
                      title={e.title}
                      className={`block text-[11px] px-1.5 py-0.5 rounded text-white font-medium truncate cursor-pointer ${
                        cancelled ? 'opacity-50 line-through' : ''
                      }`}
                      style={{ backgroundColor: colour }}
                    >
                      {truncate(e.title, 18)}
                    </div>
                  );
                })}
                {overflow > 0 ? (
                  <div className="text-[11px] text-neutral-500 font-medium pl-1">+{overflow} more</div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
      {loading ? (
        <div className="px-4 py-2 text-xs text-neutral-400 border-t border-neutral-200">Loading...</div>
      ) : null}

      {dayDrawerKey && dayDrawerDate ? (
        <DayDetailDrawer
          dateLabel={formatDublinDate(dayDrawerDate.toISOString())}
          events={dayDrawerEvents}
          onClose={() => setDayDrawerKey(null)}
          onEventClick={onEventClick}
        />
      ) : null}
    </div>
  );
}

interface DayDetailDrawerProps {
  dateLabel: string;
  events: ScheduleEvent[];
  onClose: () => void;
  onEventClick: (id: string) => void;
}

function DayDetailDrawer({ dateLabel, events, onClose, onEventClick }: DayDetailDrawerProps) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Day detail">
      <button type="button" aria-label="Close day detail" onClick={onClose} className="absolute inset-0 bg-neutral-900/40" />
      <div className="relative bg-white w-full sm:w-[420px] sm:max-w-[420px] h-full shadow-2xl flex flex-col overflow-hidden">
        <header className="flex items-center gap-1 px-4 py-3 border-b border-neutral-200 bg-white">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 -ml-2 flex items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-sm font-semibold text-neutral-900">{dateLabel}</h2>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {events.length === 0 ? (
            <p className="text-sm text-neutral-500">No events on this day.</p>
          ) : (
            events.map((e) => {
              const colour = eventTypeColour(e.event_type);
              const cancelled = e.status === 'cancelled';
              const time = e.all_day
                ? 'All day'
                : e.ends_at
                ? `${formatDublinTime(e.starts_at)} - ${formatDublinTime(e.ends_at)}`
                : formatDublinTime(e.starts_at);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    onEventClick(e.id);
                    onClose();
                  }}
                  className={`w-full text-left bg-white border border-neutral-200 rounded-md p-3 hover:shadow-sm transition-shadow ${
                    cancelled ? 'opacity-60' : ''
                  }`}
                  style={{ borderLeft: `3px solid ${colour}` }}
                >
                  <div className={`text-sm font-medium text-neutral-900 ${cancelled ? 'line-through' : ''}`}>
                    {e.title}
                  </div>
                  <div className="text-xs text-neutral-500">{time}</div>
                  {e.unit_label || e.development_label ? (
                    <div className="text-xs text-neutral-400 truncate">
                      {[e.unit_label, e.development_label].filter(Boolean).join(' | ')}
                    </div>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
