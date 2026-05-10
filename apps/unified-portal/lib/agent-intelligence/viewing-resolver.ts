import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Natural-language scheduling helpers for the create_viewing tool.
 *
 * The voice transcript says things like "Tuesday 6pm", "tomorrow at 11",
 * "next Monday", or "the 17th at 3". The resolver accepts a free-form string,
 * the agent's IANA tz (defaults to Europe/Dublin since this is an Irish
 * product), and the current Date, and returns either a concrete Date in UTC
 * or an error reason.
 *
 * Rule per the spec: bare weekday means the NEXT occurrence of that weekday
 * from today — if today is that weekday, default to next week unless the
 * time is still in the future today, in which case use today.
 */

export const DEFAULT_TZ = 'Europe/Dublin';

type ParsedDate =
  | { ok: true; iso: string; date: Date }
  | { ok: false; reason: string };

const WEEKDAYS = [
  ['sunday', 'sun'],
  ['monday', 'mon'],
  ['tuesday', 'tue', 'tues'],
  ['wednesday', 'wed', 'weds'],
  ['thursday', 'thu', 'thur', 'thurs'],
  ['friday', 'fri'],
  ['saturday', 'sat'],
];

function dayIndexFromToken(token: string): number | null {
  const lower = token.toLowerCase();
  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (WEEKDAYS[i].includes(lower)) return i;
  }
  return null;
}

function parseTimeToken(token: string): { hours: number; minutes: number } | null {
  const t = token.trim().toLowerCase().replace(/\s+/g, '');
  const match = t.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const meridian = match[3];
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  if (meridian === 'pm' && hours < 12) hours += 12;
  if (meridian === 'am' && hours === 12) hours = 0;
  if (!meridian && hours >= 1 && hours <= 7) {
    // bare "6", "7" without am/pm in a viewing context is almost always pm
    hours += 12;
  }
  return { hours, minutes };
}

function getZonedParts(date: Date, tz: string): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  const wkMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
    weekday: wkMap[parts.weekday] ?? 0,
  };
}

function buildZonedDate(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const probe = new Date(utcGuess);
  const parts = getZonedParts(probe, tz);
  const targetUtc = Date.UTC(year, month - 1, day, hour, minute);
  const projectedUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  const offset = targetUtc - projectedUtc;
  return new Date(utcGuess + offset);
}

export function parseScheduledAtNatural(input: string, opts: { tz?: string; now?: Date } = {}): ParsedDate {
  const tz = opts.tz || DEFAULT_TZ;
  const now = opts.now ?? new Date();
  const text = input.trim().toLowerCase();
  if (!text) return { ok: false, reason: 'empty_input' };

  const todayParts = getZonedParts(now, tz);

  let targetYear = todayParts.year;
  let targetMonth = todayParts.month;
  let targetDay = todayParts.day;
  let targetHour: number | null = null;
  let targetMinute = 0;

  const timeRegex = /(\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b)/i;
  const timeMatch = text.match(timeRegex);
  let bodyForDate = text;
  if (timeMatch) {
    const parsed = parseTimeToken(timeMatch[0]);
    if (parsed) {
      targetHour = parsed.hours;
      targetMinute = parsed.minutes;
      bodyForDate = (text.slice(0, timeMatch.index!) + ' ' + text.slice(timeMatch.index! + timeMatch[0].length))
        .replace(/\bat\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  const todayWord = /\btoday\b/.test(bodyForDate);
  const tomorrowWord = /\btomorrow\b/.test(bodyForDate);
  const nextWord = /\bnext\b/.test(bodyForDate);
  const weekdayMatch = bodyForDate.match(/\b(sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);

  if (todayWord) {
    // keep targetDate as today's date; require time
  } else if (tomorrowWord) {
    const t = buildZonedDate(targetYear, targetMonth, targetDay, 12, 0, tz);
    const next = new Date(t.getTime() + 24 * 60 * 60 * 1000);
    const np = getZonedParts(next, tz);
    targetYear = np.year;
    targetMonth = np.month;
    targetDay = np.day;
  } else if (weekdayMatch) {
    const wantedIdx = dayIndexFromToken(weekdayMatch[0]);
    if (wantedIdx === null) return { ok: false, reason: 'unparseable_date' };
    let delta = (wantedIdx - todayParts.weekday + 7) % 7;
    if (delta === 0) {
      // Today IS that weekday. Use today only if the time is still in the future.
      if (targetHour !== null) {
        const candidate = buildZonedDate(targetYear, targetMonth, targetDay, targetHour, targetMinute, tz);
        if (candidate.getTime() > now.getTime()) {
          // use today, no shift
        } else {
          delta = 7;
        }
      } else {
        delta = 7;
      }
    }
    if (nextWord && delta < 7) delta += 7;
    if (delta > 0) {
      const noon = buildZonedDate(targetYear, targetMonth, targetDay, 12, 0, tz);
      const shifted = new Date(noon.getTime() + delta * 24 * 60 * 60 * 1000);
      const sp = getZonedParts(shifted, tz);
      targetYear = sp.year;
      targetMonth = sp.month;
      targetDay = sp.day;
    }
  } else {
    const dmy = bodyForDate.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
    if (dmy) {
      targetDay = parseInt(dmy[1], 10);
      targetMonth = parseInt(dmy[2], 10);
      if (dmy[3]) {
        const y = parseInt(dmy[3], 10);
        targetYear = y < 100 ? 2000 + y : y;
      }
    } else {
      const monthName = bodyForDate.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2})\b/);
      if (monthName) {
        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const idx = months.indexOf(monthName[1].slice(0, 3));
        if (idx >= 0) {
          targetMonth = idx + 1;
          targetDay = parseInt(monthName[2], 10);
          const candidate = buildZonedDate(targetYear, targetMonth, targetDay, 12, 0, tz);
          if (candidate.getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
            targetYear += 1;
          }
        } else {
          return { ok: false, reason: 'unparseable_date' };
        }
      } else if (targetHour !== null) {
        // bare time only: treat as today if future, else tomorrow
        const todayCandidate = buildZonedDate(targetYear, targetMonth, targetDay, targetHour, targetMinute, tz);
        if (todayCandidate.getTime() <= now.getTime()) {
          const t = new Date(todayCandidate.getTime() + 24 * 60 * 60 * 1000);
          const tp = getZonedParts(t, tz);
          targetYear = tp.year;
          targetMonth = tp.month;
          targetDay = tp.day;
        }
      } else {
        return { ok: false, reason: 'unparseable_date' };
      }
    }
  }

  if (targetHour === null) {
    return { ok: false, reason: 'missing_time' };
  }

  const final = buildZonedDate(targetYear, targetMonth, targetDay, targetHour, targetMinute, tz);
  if (Number.isNaN(final.getTime())) return { ok: false, reason: 'unparseable_date' };

  return { ok: true, iso: final.toISOString(), date: final };
}

export interface ApplicantCandidate {
  id: string;
  name: string;
  latest_enquiry_property: string | null;
}

export interface ApplicantResolution {
  status: 'one' | 'none' | 'ambiguous';
  applicant?: { id: string; name: string; email: string | null };
  candidates?: ApplicantCandidate[];
}

export async function resolveApplicantByName(
  supabase: SupabaseClient,
  agentProfileId: string,
  name: string,
): Promise<ApplicantResolution> {
  const trimmed = name.trim();
  if (!trimmed) return { status: 'none' };

  const { data: applicants } = await supabase
    .from('agent_applicants')
    .select('id, full_name, email')
    .eq('agent_id', agentProfileId)
    .ilike('full_name', `%${trimmed}%`)
    .limit(20);

  if (!applicants || applicants.length === 0) return { status: 'none' };
  if (applicants.length === 1) {
    const a = applicants[0];
    return {
      status: 'one',
      applicant: { id: a.id, name: a.full_name, email: a.email ?? null },
    };
  }

  const ids = applicants.map((a: any) => a.id);
  const emails = applicants.map((a: any) => a.email).filter(Boolean);
  let enqRows: Array<{ enquirer_email: string | null; enquirer_name: string | null; development_id: string | null; received_at: string | null }> = [];
  if (emails.length || trimmed) {
    const { data: enqs } = await supabase
      .from('enquiries')
      .select('enquirer_email, enquirer_name, development_id, received_at')
      .eq('agent_id', agentProfileId)
      .or([
        emails.length ? `enquirer_email.in.(${emails.map((e: string) => `"${e}"`).join(',')})` : '',
        `enquirer_name.ilike.%${trimmed}%`,
      ].filter(Boolean).join(','))
      .order('received_at', { ascending: false })
      .limit(50);
    enqRows = enqs ?? [];
  }
  const devIds = Array.from(new Set(enqRows.map((e) => e.development_id).filter(Boolean))) as string[];
  const { data: devs } = devIds.length
    ? await supabase.from('developments').select('id, name').in('id', devIds)
    : { data: [] as Array<{ id: string; name: string }> };
  const devName = (id: string | null): string | null => {
    if (!id) return null;
    const d = (devs as Array<{ id: string; name: string }> | null)?.find((x) => x.id === id);
    return d?.name ?? null;
  };

  const candidates: ApplicantCandidate[] = applicants.map((a: any) => {
    const matchEnq = enqRows.find((e) => (e.enquirer_email && e.enquirer_email === a.email) || (e.enquirer_name && a.full_name && e.enquirer_name.toLowerCase() === a.full_name.toLowerCase()));
    return {
      id: a.id,
      name: a.full_name,
      latest_enquiry_property: matchEnq ? devName(matchEnq.development_id) : null,
    };
  });

  return { status: 'ambiguous', candidates };
}

export interface PropertyCandidate {
  development_id: string;
  name: string;
}

export interface PropertyResolution {
  status: 'one' | 'none' | 'ambiguous';
  property?: PropertyCandidate;
  candidates?: PropertyCandidate[];
}

export async function resolvePropertyForApplicant(
  supabase: SupabaseClient,
  args: {
    agentProfileId: string;
    applicantId: string;
    applicantEmail: string | null;
    applicantName: string;
    propertyHint?: string;
  },
): Promise<PropertyResolution> {
  const orParts: string[] = [];
  if (args.applicantEmail) orParts.push(`enquirer_email.eq.${args.applicantEmail}`);
  if (args.applicantName) orParts.push(`enquirer_name.ilike.%${args.applicantName}%`);

  let enquiries: Array<{ development_id: string | null; status: string }> = [];
  if (orParts.length) {
    const { data } = await supabase
      .from('enquiries')
      .select('development_id, status')
      .eq('agent_id', args.agentProfileId)
      .or(orParts.join(','))
      .not('development_id', 'is', null)
      .not('status', 'in', '("closed","archived","completed","won","lost")')
      .order('received_at', { ascending: false });
    enquiries = data ?? [];
  }

  const devIds = Array.from(new Set(enquiries.map((e) => e.development_id).filter(Boolean))) as string[];
  if (devIds.length === 0) return { status: 'none' };

  const { data: devs } = await supabase
    .from('developments')
    .select('id, name')
    .in('id', devIds);
  const candidates: PropertyCandidate[] = (devs ?? []).map((d: any) => ({ development_id: d.id, name: d.name }));

  if (candidates.length === 1) return { status: 'one', property: candidates[0] };

  if (args.propertyHint) {
    const hint = args.propertyHint.trim().toLowerCase();
    const matches = candidates.filter((c) => c.name.toLowerCase().includes(hint));
    if (matches.length === 1) return { status: 'one', property: matches[0] };
  }

  return { status: 'ambiguous', candidates };
}

export function formatViewingTime(iso: string, tz: string = DEFAULT_TZ): string {
  const date = new Date(iso);
  const fmt = new Intl.DateTimeFormat('en-IE', {
    timeZone: tz,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return fmt.format(date);
}
