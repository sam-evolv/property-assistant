'use client';

/**
 * Capacitor calendar bridge.
 *
 * Wraps `@ebarooni/capacitor-calendar`, the plugin Sam installs in the
 * native wrapper repo (NOT in the unified-portal package.json — same
 * convention as `capacitor-native.ts` and `usePushNotifications.ts`).
 *
 * Web fallback is a no-op: callers receive `{ status: 'unavailable' }`
 * so the chat receipt card can render the "Not added to calendar" hint
 * without breaking the booking flow.
 */

import { isCapacitorNative } from './capacitor-native';

export interface CalendarEventInput {
  title: string;
  startMs: number;
  endMs: number;
  location?: string;
  notes?: string;
}

export type CalendarWriteResult =
  | { status: 'created'; eventId: string }
  | { status: 'denied' }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

let pluginCache: any | undefined;

async function loadCalendarPlugin(): Promise<any | null> {
  if (pluginCache !== undefined) return pluginCache;
  try {
    const specifier = '@ebarooni/capacitor-calendar';
    // @ts-ignore — optional native dep, dynamic to avoid webpack static resolution
    const mod = await import(/* webpackIgnore: true */ specifier);
    pluginCache = mod?.CapacitorCalendar ?? null;
    return pluginCache;
  } catch {
    pluginCache = null;
    return null;
  }
}

export async function ensureCalendarPermission(): Promise<'granted' | 'denied' | 'unavailable'> {
  const native = await isCapacitorNative();
  if (!native) return 'unavailable';

  const plugin = await loadCalendarPlugin();
  if (!plugin) return 'unavailable';

  try {
    if (typeof plugin.checkPermission === 'function') {
      const check = await plugin.checkPermission({ alias: 'writeCalendar' }).catch(() => null);
      if (check?.result === 'granted') return 'granted';
    }
    if (typeof plugin.requestWriteOnlyCalendarAccess === 'function') {
      const res = await plugin.requestWriteOnlyCalendarAccess();
      if (res?.result === 'granted') return 'granted';
      return 'denied';
    }
    if (typeof plugin.requestPermission === 'function') {
      const res = await plugin.requestPermission({ alias: 'writeCalendar' });
      if (res?.result === 'granted') return 'granted';
    }
    return 'denied';
  } catch {
    return 'denied';
  }
}

export async function addEventToDeviceCalendar(input: CalendarEventInput): Promise<CalendarWriteResult> {
  const permission = await ensureCalendarPermission();
  if (permission === 'unavailable') return { status: 'unavailable' };
  if (permission === 'denied') return { status: 'denied' };

  const plugin = await loadCalendarPlugin();
  if (!plugin) return { status: 'unavailable' };

  try {
    const res = await plugin.createEventWithPrompt({
      title: input.title,
      startDate: input.startMs,
      endDate: input.endMs,
      location: input.location,
      description: input.notes,
    });
    const eventId =
      (typeof res?.result === 'string' && res.result) ||
      (typeof res?.eventId === 'string' && res.eventId) ||
      '';
    if (!eventId) return { status: 'error', message: 'Calendar plugin returned no event id' };
    return { status: 'created', eventId };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Calendar write failed',
    };
  }
}
