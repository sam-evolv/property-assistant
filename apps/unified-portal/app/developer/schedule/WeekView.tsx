'use client';

import {
  addDays,
  dublinDateKey,
  eventTypeColour,
  formatDublinTime,
  ScheduleEvent,
} from './eventTypes';

interface WeekViewProps {
  start: Date;
  events: ScheduleEvent[];
  loading: boolean;
  onEventClick: (id: string) => void;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dayLabel(d: Date): string {
  return new Intl.DateTimeFormat('en-IE', {
    timeZone: 'Europe/Dublin',
    day: 'numeric',
  }).format(d);
}

function dublinEventDateKey(iso: string): string {
  return dublinDateKey(new Date(iso));
}

export function WeekView({ start, events, loading, onEventClick }: WeekViewProps) {
  const days: Date[] = [];
  for (let i = 0; i < 7; i += 1) {
    days.push(addDays(start, i));
  }

  const todayKey = dublinDateKey(new Date());
  const eventsByDay = new Map<string, ScheduleEvent[]>();
  for (const e of events) {
    const key = dublinEventDateKey(e.starts_at);
    const list = eventsByDay.get(key) ?? [];
    list.push(e);
    eventsByDay.set(key, list);
  }

  return (
    <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
      <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50">
        {days.map((d, i) => {
          const key = dublinDateKey(d);
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              className={`px-3 py-2 text-center border-l first:border-l-0 border-neutral-200 ${
                isToday ? 'bg-gold-50' : ''
              }`}
            >
              <div className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">
                {DAY_NAMES[i]}
              </div>
              <div
                className={`mt-0.5 text-base font-semibold ${
                  isToday ? 'text-gold-700' : 'text-neutral-800'
                }`}
              >
                {dayLabel(d)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-7 min-h-[480px]">
        {days.map((d) => {
          const key = dublinDateKey(d);
          const isToday = key === todayKey;
          const dayEvents = eventsByDay.get(key) ?? [];
          dayEvents.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
          return (
            <div
              key={key}
              className={`px-2 py-2 border-l first:border-l-0 border-neutral-200 space-y-2 ${
                isToday ? 'bg-gold-50/40' : ''
              }`}
            >
              {loading ? (
                <div className="text-xs text-neutral-400">Loading...</div>
              ) : dayEvents.length === 0 ? (
                <div className="text-xs text-neutral-400">No events</div>
              ) : (
                dayEvents.map((e) => <EventCard key={e.id} event={e} onClick={() => onEventClick(e.id)} />)
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventCard({ event, onClick }: { event: ScheduleEvent; onClick: () => void }) {
  const cancelled = event.status === 'cancelled';
  const venue = event.unit_label || event.development_label || '';
  const attendeeCount = event.attendees.length;
  const timeText = event.all_day
    ? 'All day'
    : event.ends_at
    ? `${formatDublinTime(event.starts_at)} - ${formatDublinTime(event.ends_at)}`
    : formatDublinTime(event.starts_at);

  return (
    <button
      type="button"
      onClick={onClick}
      title={event.title}
      className={`w-full text-left bg-white border border-neutral-200 rounded-md p-3 hover:shadow-sm transition-shadow flex flex-col gap-1 ${
        cancelled ? 'opacity-60' : ''
      }`}
      style={{ borderLeft: `3px solid ${eventTypeColour(event.event_type)}` }}
    >
      <div
        className={`text-sm font-medium text-neutral-900 truncate ${
          cancelled ? 'line-through' : ''
        }`}
      >
        {event.title}
      </div>
      <div className="text-xs text-neutral-500">{timeText}</div>
      {venue ? (
        <div className="text-xs text-neutral-400 truncate">{venue}</div>
      ) : null}
      {attendeeCount > 0 ? (
        <span className="inline-flex items-center self-start mt-0.5 px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600 text-[10px] font-medium">
          {attendeeCount} attendee{attendeeCount === 1 ? '' : 's'}
        </span>
      ) : null}
    </button>
  );
}
