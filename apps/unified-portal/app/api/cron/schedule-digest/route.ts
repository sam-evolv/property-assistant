/**
 * POST /api/cron/schedule-digest
 *
 * Assistant V2 Sprint 4. Daily digest of today's scheduled events,
 * delivered to each tenant's aftercare_email. Triggered nominally by
 * Vercel Cron (vercel.json) at 07:00 UTC and also exercisable via curl
 * for testing.
 *
 * Spec: docs/specs/assistant-v2-sprint-4.md section 5.7.
 *
 * Auth. Reuses the INTERNAL_ENRICHMENT_KEY env var (same secret used
 * by /api/snag/enrich and /api/notifications/homeowner-issue) to avoid
 * introducing a second internal-only credential. The header check uses
 * crypto.timingSafeEqual. As a secondary acceptable proof, an
 * Authorization: Bearer with the Supabase service-role key is also
 * accepted, mirroring the other internal routes. Vercel Cron's own
 * Bearer CRON_SECRET is intentionally not accepted in V1; the cron
 * entry is there so the Vercel project tracks the schedule, but the
 * acceptance criterion is satisfied by manual curl invocation.
 *
 * Iteration. The spec's "tenants with FEATURE_SCHEDULE enabled" gate
 * is global today (env var, not per-tenant). For V1 we iterate every
 * tenant that has tenant_settings.aftercare_email set and let the
 * global flag gate the route at the entry point.
 *
 * Timezone. Today's window is computed in Europe/Dublin. Vercel Cron
 * runs in UTC; the 1-hour winter drift is accepted per the spec.
 *
 * Cancelled events are excluded from the digest.
 *
 * Gated on FEATURE_SCHEDULE.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { isScheduleEnabled } from '@/lib/feature-flags';
import { snagFeatureDisabledResponse } from '@/lib/assistant/snag-auth';
import { getResendClient } from '@/lib/resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const EVENT_TYPE_LABELS: Record<string, string> = {
  handover: 'Handovers',
  snag_visit: 'Snag visits',
  contractor_visit: 'Contractor visits',
  homeowner_appointment: 'Homeowner appointments',
  inspection: 'Inspections',
  custom: 'Other',
};

const EVENT_TYPE_ORDER = [
  'handover',
  'snag_visit',
  'contractor_visit',
  'homeowner_appointment',
  'inspection',
  'custom',
];

interface DigestEventRow {
  id: string;
  tenant_id: string;
  development_id: string | null;
  unit_id: string | null;
  event_type: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  status: string;
}

interface AttendeeRow {
  event_id: string;
  user_id: string | null;
  external_name: string | null;
  external_email: string | null;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function isInternalCaller(request: NextRequest): boolean {
  const internalKey = process.env.INTERNAL_ENRICHMENT_KEY;
  const headerKey = request.headers.get('x-internal-key');
  if (internalKey && headerKey && safeEqual(headerKey, internalKey)) {
    return true;
  }
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7);
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey && safeEqual(token, serviceKey)) {
      return true;
    }
  }
  return false;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function dublinTodayUtcBounds(): { fromUtc: string; toUtc: string; dateLabel: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Dublin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const d = parts.find((p) => p.type === 'day')!.value;

  const probe = new Date(`${y}-${m}-${d}T12:00:00Z`);
  const dublinView = new Date(probe.toLocaleString('en-US', { timeZone: 'Europe/Dublin' }));
  const utcView = new Date(probe.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMs = dublinView.getTime() - utcView.getTime();

  const fromUtcMs = new Date(`${y}-${m}-${d}T00:00:00Z`).getTime() - offsetMs;
  const toUtcMs = new Date(`${y}-${m}-${d}T23:59:59.999Z`).getTime() - offsetMs;
  return {
    fromUtc: new Date(fromUtcMs).toISOString(),
    toUtc: new Date(toUtcMs).toISOString(),
    dateLabel: `${y}-${m}-${d}`,
  };
}

function formatDublinTime(iso: string): string {
  return new Intl.DateTimeFormat('en-IE', {
    timeZone: 'Europe/Dublin',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function deriveUnitLabel(u: {
  unit_code: string | null;
  unit_number: string | null;
  address_line_1: string | null;
}): string {
  return u.unit_code ?? u.unit_number ?? u.address_line_1 ?? 'Unit';
}

export async function POST(request: NextRequest) {
  if (!isScheduleEnabled()) {
    return snagFeatureDisabledResponse();
  }

  if (!isInternalCaller(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  const { data: settingsRows, error: settingsErr } = await supabase
    .from('tenant_settings')
    .select('tenant_id, aftercare_email')
    .not('aftercare_email', 'is', null);
  if (settingsErr) {
    console.error('[schedule-digest] settings_lookup_failed reason=%s', settingsErr.message);
    return NextResponse.json({ error: 'Could not load tenant settings' }, { status: 500 });
  }

  const candidates = (settingsRows ?? [])
    .map((r) => ({
      tenant_id: r.tenant_id as string,
      aftercare_email: ((r.aftercare_email as string | null) ?? '').trim(),
    }))
    .filter((r) => r.aftercare_email.length > 0);

  if (candidates.length === 0) {
    console.info('[schedule-digest] no_tenants_with_aftercare_email');
    return NextResponse.json({ ok: true, processed: 0, sent: 0 });
  }

  const { fromUtc, toUtc, dateLabel } = dublinTodayUtcBounds();
  const tenantIds = candidates.map((c) => c.tenant_id);

  const { data: eventsData, error: eventsErr } = await supabase
    .from('schedule_events')
    .select(
      'id, tenant_id, development_id, unit_id, event_type, title, starts_at, ends_at, all_day, location, status',
    )
    .in('tenant_id', tenantIds)
    .gte('starts_at', fromUtc)
    .lte('starts_at', toUtc)
    .neq('status', 'cancelled')
    .order('starts_at', { ascending: true });
  if (eventsErr) {
    console.error('[schedule-digest] events_lookup_failed reason=%s', eventsErr.message);
    return NextResponse.json({ error: 'Could not load events' }, { status: 500 });
  }

  const eventsByTenant = new Map<string, DigestEventRow[]>();
  for (const e of (eventsData ?? []) as DigestEventRow[]) {
    const arr = eventsByTenant.get(e.tenant_id) ?? [];
    arr.push(e);
    eventsByTenant.set(e.tenant_id, arr);
  }

  const allEventIds = (eventsData ?? []).map((e) => (e as DigestEventRow).id);
  const allUnitIds = Array.from(
    new Set(
      (eventsData ?? [])
        .map((e) => (e as DigestEventRow).unit_id)
        .filter((v): v is string => !!v),
    ),
  );
  const allDevIds = Array.from(
    new Set(
      (eventsData ?? [])
        .map((e) => (e as DigestEventRow).development_id)
        .filter((v): v is string => !!v),
    ),
  );

  const attendeesByEvent = new Map<string, AttendeeRow[]>();
  if (allEventIds.length > 0) {
    const { data: attRows, error: attErr } = await supabase
      .from('schedule_event_attendees')
      .select('event_id, user_id, external_name, external_email')
      .in('event_id', allEventIds);
    if (attErr) {
      console.error('[schedule-digest] attendees_lookup_failed reason=%s', attErr.message);
    } else {
      for (const a of (attRows ?? []) as AttendeeRow[]) {
        const arr = attendeesByEvent.get(a.event_id) ?? [];
        arr.push(a);
        attendeesByEvent.set(a.event_id, arr);
      }
    }
  }

  const userIdSet = new Set<string>();
  for (const list of attendeesByEvent.values()) {
    for (const a of list) {
      if (a.user_id) userIdSet.add(a.user_id);
    }
  }
  const userNames = new Map<string, string>();
  if (userIdSet.size > 0) {
    const { data: memberRows, error: memberErr } = await supabase
      .from('site_team_members')
      .select('user_id, invited_email')
      .in('user_id', Array.from(userIdSet));
    if (memberErr) {
      console.error('[schedule-digest] member_lookup_failed reason=%s', memberErr.message);
    } else {
      for (const m of (memberRows ?? []) as Array<{ user_id: string; invited_email: string | null }>) {
        if (!userNames.has(m.user_id)) {
          userNames.set(m.user_id, m.invited_email ?? '');
        }
      }
    }
  }

  const units = new Map<string, string>();
  if (allUnitIds.length > 0) {
    const { data: unitRows, error: unitErr } = await supabase
      .from('units')
      .select('id, unit_code, unit_number, address_line_1')
      .in('id', allUnitIds);
    if (unitErr) {
      console.error('[schedule-digest] units_lookup_failed reason=%s', unitErr.message);
    } else {
      for (const u of (unitRows ?? []) as Array<{
        id: string;
        unit_code: string | null;
        unit_number: string | null;
        address_line_1: string | null;
      }>) {
        units.set(u.id, deriveUnitLabel(u));
      }
    }
  }

  const developments = new Map<string, string>();
  const tenantNames = new Map<string, string>();
  if (allDevIds.length > 0) {
    const { data: devRows, error: devErr } = await supabase
      .from('developments')
      .select('id, name')
      .in('id', allDevIds);
    if (devErr) {
      console.error('[schedule-digest] developments_lookup_failed reason=%s', devErr.message);
    } else {
      for (const d of (devRows ?? []) as Array<{ id: string; name: string | null }>) {
        developments.set(d.id, d.name ?? 'Development');
      }
    }
  }
  {
    const { data: tenantRows, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, name')
      .in('id', tenantIds);
    if (tenantErr) {
      console.error('[schedule-digest] tenants_lookup_failed reason=%s', tenantErr.message);
    } else {
      for (const t of (tenantRows ?? []) as Array<{ id: string; name: string | null }>) {
        tenantNames.set(t.id, t.name ?? 'your tenant');
      }
    }
  }

  let sent = 0;
  let processed = 0;
  let skippedEmpty = 0;
  const sendErrors: string[] = [];

  for (const candidate of candidates) {
    processed += 1;
    const tenantEvents = eventsByTenant.get(candidate.tenant_id) ?? [];
    if (tenantEvents.length === 0) {
      skippedEmpty += 1;
      continue;
    }

    const grouped = new Map<string, DigestEventRow[]>();
    for (const e of tenantEvents) {
      const arr = grouped.get(e.event_type) ?? [];
      arr.push(e);
      grouped.set(e.event_type, arr);
    }

    const tenantName = tenantNames.get(candidate.tenant_id) ?? 'your tenant';
    const subject = `Today's schedule - ${tenantEvents.length} events at ${tenantName}`;

    const textParts: string[] = [
      `Today's schedule for ${tenantName} (${dateLabel}, Europe/Dublin):`,
      '',
    ];
    const htmlSections: string[] = [];

    for (const key of EVENT_TYPE_ORDER) {
      const group = grouped.get(key);
      if (!group || group.length === 0) continue;
      const label = EVENT_TYPE_LABELS[key] ?? key;
      textParts.push(`${label}:`);
      const htmlItems: string[] = [];
      for (const e of group) {
        const timePart = e.all_day
          ? 'All day'
          : e.ends_at
          ? `${formatDublinTime(e.starts_at)} - ${formatDublinTime(e.ends_at)}`
          : formatDublinTime(e.starts_at);
        const venueBits: string[] = [];
        if (e.unit_id && units.get(e.unit_id)) venueBits.push(units.get(e.unit_id) as string);
        if (e.development_id && developments.get(e.development_id))
          venueBits.push(developments.get(e.development_id) as string);
        if (e.location) venueBits.push(e.location);
        const venue = venueBits.join(' | ');

        const attendeesList = (attendeesByEvent.get(e.id) ?? [])
          .map((a) => a.external_name ?? userNames.get(a.user_id ?? '') ?? a.external_email ?? null)
          .filter((v): v is string => !!v && v.length > 0);

        const line = `  - ${timePart} ${e.title}${venue ? ` (${venue})` : ''}${
          attendeesList.length > 0 ? ` - ${attendeesList.join(', ')}` : ''
        }`;
        textParts.push(line);
        htmlItems.push(
          `<li><strong>${escapeHtml(timePart)}</strong> ${escapeHtml(e.title)}${
            venue ? ` <span style="color:#666">(${escapeHtml(venue)})</span>` : ''
          }${
            attendeesList.length > 0
              ? `<br/><span style="color:#555;font-size:12px">${escapeHtml(attendeesList.join(', '))}</span>`
              : ''
          }</li>`,
        );
      }
      textParts.push('');
      htmlSections.push(
        `<h3 style="margin:16px 0 4px 0;color:#111;font-size:14px;">${escapeHtml(label)}</h3><ul style="padding-left:18px;margin:4px 0 8px 0;">${htmlItems.join('')}</ul>`,
      );
    }

    const text = textParts.join('\n');
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background:#111;padding:20px;">
          <h1 style="color:#fff;margin:0;font-size:18px;">Today's schedule</h1>
          <p style="color:#bbb;margin:6px 0 0 0;font-size:12px;">${escapeHtml(dateLabel)} - ${escapeHtml(tenantName)}</p>
        </div>
        <div style="padding:20px;background:#fff;color:#111;">
          ${htmlSections.join('')}
        </div>
        <div style="padding:12px 16px;background:#f5f5f5;text-align:center;color:#777;font-size:12px;">
          OpenHouse AI schedule digest
        </div>
      </div>
    `.trim();

    try {
      const { client, fromEmail } = await getResendClient();
      const result = await client.emails.send({
        from: fromEmail,
        to: candidate.aftercare_email,
        subject,
        html,
        text,
      } as Parameters<typeof client.emails.send>[0]);
      console.info(
        '[schedule-digest] dispatched tenant=%s to=%s events=%s id=%s',
        candidate.tenant_id,
        candidate.aftercare_email,
        tenantEvents.length,
        (result as { id?: string })?.id ?? null,
      );
      sent += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        '[schedule-digest] dispatch_failed tenant=%s reason=%s',
        candidate.tenant_id,
        msg,
      );
      sendErrors.push(`${candidate.tenant_id}: ${msg}`);
    }
  }

  return NextResponse.json({
    ok: sendErrors.length === 0,
    processed,
    sent,
    skipped_empty: skippedEmpty,
    errors: sendErrors,
    date_label: dateLabel,
  });
}
