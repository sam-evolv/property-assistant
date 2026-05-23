'use client';

/**
 * Top-level client for /developer/schedule.
 *
 * Owns the view state (week vs month), the anchor date, the loaded
 * events for the active window, and the open/close state for the
 * detail drawer and Add/Edit modal. Renders the toolbar plus either
 * WeekView or MonthView, with EventDrawer and EventModal mounted at
 * the root and controlled by id.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Filter, Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  addDays,
  dublinDateKey,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  formatMonthLabel,
  formatRangeLabel,
  ScheduleEvent,
  startOfDublinWeek,
} from './eventTypes';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';
import { EventDrawer } from './EventDrawer';
import { EventModal } from './EventModal';

type CalendarView = 'week' | 'month';

interface ScheduleClientProps {
  role: 'admin' | 'site_team' | 'snagger_external';
  userId: string;
  tenantId: string;
}

interface Filters {
  developmentIds: string[];
  eventTypes: string[];
}

const EMPTY_FILTERS: Filters = { developmentIds: [], eventTypes: [] };

function startOfDublinMonth(d: Date): Date {
  const key = dublinDateKey(d);
  const [y, m] = key.split('-').map((s) => parseInt(s, 10));
  return new Date(Date.UTC(y, m - 1, 1, 12, 0, 0));
}

function endOfDublinMonth(d: Date): Date {
  const key = dublinDateKey(d);
  const [y, m] = key.split('-').map((s) => parseInt(s, 10));
  return new Date(Date.UTC(y, m, 0, 12, 0, 0));
}

function gridStartForMonth(d: Date): Date {
  const monthStart = startOfDublinMonth(d);
  return startOfDublinWeek(monthStart);
}

function gridEndForMonth(d: Date): Date {
  const monthEnd = endOfDublinMonth(d);
  const weekStart = startOfDublinWeek(monthEnd);
  return addDays(weekStart, 6);
}

export function ScheduleClient({ role, userId, tenantId }: ScheduleClientProps) {
  const [view, setView] = useState<CalendarView>('week');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);

  const canWrite = role === 'admin' || role === 'site_team';

  const { windowStart, windowEnd } = useMemo(() => {
    if (view === 'week') {
      const start = startOfDublinWeek(anchor);
      return { windowStart: start, windowEnd: addDays(start, 6) };
    }
    return { windowStart: gridStartForMonth(anchor), windowEnd: gridEndForMonth(anchor) };
  }, [anchor, view]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('from', windowStart.toISOString());
      const toEnd = new Date(windowEnd.getTime());
      toEnd.setUTCHours(23, 59, 59, 999);
      params.set('to', toEnd.toISOString());
      for (const id of filters.developmentIds) params.append('development_id', id);
      for (const t of filters.eventTypes) params.append('event_type', t);
      const res = await fetch(`/api/schedule/events?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        setError("Couldn't load the schedule.");
        setEvents([]);
        return;
      }
      const json = (await res.json()) as { events: ScheduleEvent[] };
      setEvents(json.events ?? []);
    } catch {
      setError("Couldn't load the schedule.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [windowStart, windowEnd, filters]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const goPrevious = () => {
    if (view === 'week') {
      setAnchor(addDays(anchor, -7));
    } else {
      const key = dublinDateKey(anchor);
      const [y, m, d] = key.split('-').map((s) => parseInt(s, 10));
      setAnchor(new Date(Date.UTC(y, m - 2, d, 12, 0, 0)));
    }
  };
  const goNext = () => {
    if (view === 'week') {
      setAnchor(addDays(anchor, 7));
    } else {
      const key = dublinDateKey(anchor);
      const [y, m, d] = key.split('-').map((s) => parseInt(s, 10));
      setAnchor(new Date(Date.UTC(y, m, d, 12, 0, 0)));
    }
  };
  const goToday = () => setAnchor(new Date());

  const periodLabel =
    view === 'week'
      ? formatRangeLabel(windowStart, addDays(windowStart, 6))
      : formatMonthLabel(anchor);

  const subhead = useMemo(() => {
    if (events.length === 0) return '';
    const periodWord = view === 'week' ? 'this week' : 'this month';
    return `${events.length} event${events.length === 1 ? '' : 's'} scheduled across all developments ${periodWord}`;
  }, [events.length, view]);

  const developmentOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of events) {
      if (e.development_id && e.development_label) {
        map.set(e.development_id, e.development_label);
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [events]);

  const handleEventClick = (id: string) => setSelectedEventId(id);
  const handleAddClick = () => {
    setEditingEvent(null);
    setModalOpen(true);
  };
  const handleEditClick = (event: ScheduleEvent) => {
    setEditingEvent(event);
    setModalOpen(true);
    setSelectedEventId(null);
  };

  const handleModalSaved = () => {
    setModalOpen(false);
    setEditingEvent(null);
    toast.success('Event saved.');
    void fetchEvents();
  };

  const handleEventChanged = () => {
    void fetchEvents();
  };

  return (
    <div className="px-6 py-6 max-w-screen-2xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-neutral-900">Schedule</h1>
        {subhead ? (
          <p className="text-sm text-neutral-500 mt-1">{subhead}</p>
        ) : (
          <p className="text-sm text-neutral-400 mt-1">
            No events scheduled. {canWrite ? 'Add an event using the button above or check a different week.' : 'Check a different week.'}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div
          role="tablist"
          aria-label="Schedule view"
          className="inline-flex items-center gap-1 p-1 bg-neutral-100 rounded-full"
        >
          {(['week', 'month'] as CalendarView[]).map((opt) => {
            const isActive = opt === view;
            return (
              <button
                key={opt}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setView(opt)}
                className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-medium transition-colors min-h-[36px] ${
                  isActive
                    ? 'bg-gold-500 text-white shadow-sm'
                    : 'text-neutral-700 hover:text-neutral-900'
                }`}
              >
                {opt === 'week' ? 'Week' : 'Month'}
              </button>
            );
          })}
        </div>

        <div className="inline-flex items-center gap-1 ml-1">
          <button
            type="button"
            aria-label="Previous"
            onClick={goPrevious}
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="h-9 px-3 inline-flex items-center text-sm font-medium rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700"
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={goNext}
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="text-sm text-neutral-600 font-medium">{periodLabel}</div>

        <div className="ml-auto inline-flex items-center gap-2">
          <FiltersDropdown
            open={filtersOpen}
            onToggle={() => setFiltersOpen((v) => !v)}
            onClose={() => setFiltersOpen(false)}
            developments={developmentOptions}
            filters={filters}
            onChange={setFilters}
          />
          {canWrite ? (
            <button
              type="button"
              onClick={handleAddClick}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-gold-500 hover:bg-gold-600 text-white text-sm font-medium shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add event
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {view === 'week' ? (
        <WeekView
          start={windowStart}
          events={events}
          loading={loading}
          onEventClick={handleEventClick}
        />
      ) : (
        <MonthView
          start={windowStart}
          monthAnchor={anchor}
          events={events}
          loading={loading}
          onEventClick={handleEventClick}
        />
      )}

      <EventDrawer
        eventId={selectedEventId}
        currentUserId={userId}
        canWrite={canWrite}
        onClose={() => setSelectedEventId(null)}
        onChanged={handleEventChanged}
        onEdit={(event) => handleEditClick(event)}
      />

      {modalOpen ? (
        <EventModal
          editingEvent={editingEvent}
          tenantId={tenantId}
          onClose={() => {
            setModalOpen(false);
            setEditingEvent(null);
          }}
          onSaved={handleModalSaved}
        />
      ) : null}
    </div>
  );
}

interface FiltersDropdownProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  developments: Array<{ id: string; name: string }>;
  filters: Filters;
  onChange: (next: Filters) => void;
}

function FiltersDropdown({
  open,
  onToggle,
  onClose,
  developments,
  filters,
  onChange,
}: FiltersDropdownProps) {
  const active = filters.developmentIds.length + filters.eventTypes.length;

  const toggleDevelopment = (id: string) => {
    if (filters.developmentIds.includes(id)) {
      onChange({ ...filters, developmentIds: filters.developmentIds.filter((x) => x !== id) });
    } else {
      onChange({ ...filters, developmentIds: [...filters.developmentIds, id] });
    }
  };

  const toggleEventType = (type: string) => {
    if (filters.eventTypes.includes(type)) {
      onChange({ ...filters, eventTypes: filters.eventTypes.filter((x) => x !== type) });
    } else {
      onChange({ ...filters, eventTypes: [...filters.eventTypes, type] });
    }
  };

  const clearAll = () => onChange({ developmentIds: [], eventTypes: [] });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-sm font-medium ${
          active > 0
            ? 'border-gold-300 bg-gold-50 text-gold-700'
            : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700'
        }`}
      >
        <Filter className="w-4 h-4" />
        Filters
        {active > 0 ? (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-semibold bg-gold-500 text-white rounded-full">
            {active}
          </span>
        ) : null}
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={onClose}
            className="fixed inset-0 z-10 bg-transparent cursor-default"
          />
          <div className="absolute right-0 top-full mt-1 z-20 w-72 rounded-lg border border-neutral-200 bg-white shadow-lg p-3 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Event type</p>
                {active > 0 ? (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-xs font-medium text-gold-700 hover:text-gold-800"
                  >
                    Clear all
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_TYPES.map((t) => {
                  const isActive = filters.eventTypes.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleEventType(t)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                        isActive
                          ? 'border-gold-400 bg-gold-50 text-gold-800'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      {EVENT_TYPE_LABELS[t]}
                    </button>
                  );
                })}
              </div>
            </div>
            {developments.length > 0 ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                  Development
                </p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {developments.map((d) => {
                    const isActive = filters.developmentIds.includes(d.id);
                    return (
                      <label
                        key={d.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-neutral-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={() => toggleDevelopment(d.id)}
                          className="rounded text-gold-500 focus:ring-gold-400"
                        />
                        <span className="text-sm text-neutral-800 truncate">{d.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
