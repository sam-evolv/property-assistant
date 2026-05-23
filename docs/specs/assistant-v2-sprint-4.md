# OpenHouse Assistant V2 - Sprint 4 Schedule and Calendar

**Path in repo:** `docs/specs/assistant-v2-sprint-4.md`
**Status:** Ready for implementation
**Scope:** A schedule for site managers and snaggers. Single events table, calendar view, simple "Add event" flow, daily digest email. Two implementation sessions (schema+server, then UI).
**Prerequisite:** Sprints 1, 2, 3, 3.1, 3.5a, 3.5a.1, 3.5a.2, 3.5a.3 merged. Production HEAD `aeb78267` or later.

---

## 1. Why this scope

Sites have a calendar problem. Right now there's no shared view of what's happening at a development this week, including handovers, snag visits, contractor visits, homeowner appointments. People run their own calendars, things slip, snaggers turn up to units that aren't ready, contractors aren't told a handover is happening.

This sprint adds the missing surface. One events table. Read-only calendar by default with a simple add-event flow. The daily digest piggybacks on the existing email infrastructure (Sprint 3.5a wired Resend) so the team's morning inbox shows "here's what's on today."

Out of scope deliberately: external calendar sync (Google/Outlook), recurring events, attendee invitations with RSVP. All can come later. V1 is "see what's planned" and "add something to the plan."

---

## 2. Who uses this

- **Site managers and developer admins:** see the full schedule for their tenant. Add, edit, cancel events. Receive the daily digest email.
- **Snaggers (site_team_snag):** see only events that include them as an attendee. No add/edit. Can mark themselves as confirmed/declined on events that include them.
- **External snaggers (snagger_external):** same as site_team_snag but only see events tied to units they have access to (single-unit access remains scoped).
- **Homeowners:** no visibility. The schedule is a developer-side tool. Future sprint can expose homeowner-specific events (handover dates, scheduled snag visits) on their portal.

Role enforcement happens server-side via the existing `resolveSnagAuth` helper.

---

## 3. Feature flag

```
FEATURE_SCHEDULE=false
NEXT_PUBLIC_FEATURE_SCHEDULE=false
```

Default off in production. Enable for Bridge Property Group during testing.

When off: the Schedule sidebar item does not render, all `/api/schedule/*` routes return 404, the daily digest cron does not fire.

---

## 4. Database schema

One new table, one migration set (split DDL into three apply_migration calls per the established pattern).

### 4.1 Migration 1 of 3 - schedule_events table

```sql
create table if not exists schedule_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  development_id uuid,
  unit_id uuid,
  event_type text not null check (event_type in (
    'handover',
    'snag_visit',
    'contractor_visit',
    'homeowner_appointment',
    'inspection',
    'custom'
  )),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text,
  status text not null default 'scheduled' check (status in (
    'scheduled',
    'in_progress',
    'completed',
    'cancelled'
  )),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists schedule_events_tenant_starts_idx
  on schedule_events (tenant_id, starts_at);

create index if not exists schedule_events_unit_starts_idx
  on schedule_events (unit_id, starts_at)
  where unit_id is not null;

create index if not exists schedule_events_dev_starts_idx
  on schedule_events (development_id, starts_at)
  where development_id is not null;
```

### 4.2 Migration 2 of 3 - schedule_event_attendees table

```sql
create table if not exists schedule_event_attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references schedule_events(id) on delete cascade,
  user_id uuid,
  external_email text,
  external_name text,
  role text check (role in (
    'organiser',
    'site_team',
    'snagger',
    'contractor',
    'homeowner',
    'other'
  )),
  rsvp_status text not null default 'invited' check (rsvp_status in (
    'invited',
    'confirmed',
    'declined',
    'tentative'
  )),
  created_at timestamptz not null default now()
);

create index if not exists schedule_event_attendees_event_idx
  on schedule_event_attendees (event_id);

create index if not exists schedule_event_attendees_user_idx
  on schedule_event_attendees (user_id)
  where user_id is not null;
```

An attendee is either a known user (user_id set, the typical case for internal site team and snaggers) or an external contact (external_email + external_name, for contractors, homeowners, etc). Exactly one of user_id / external_email must be non-null. Enforce in application code; no CHECK constraint needed because mixed entries can occur as edge cases.

### 4.3 Migration 3 of 3 - RLS

```sql
alter table schedule_events enable row level security;
alter table schedule_event_attendees enable row level security;

create policy "service_role_bypass" on schedule_events
  for all using (true) with check (true);

create policy "service_role_bypass" on schedule_event_attendees
  for all using (true) with check (true);
```

Same pattern as every other table in this codebase. Tenant gating happens in application code via resolveSnagAuth.

---

## 5. Server routes

Six new routes under `apps/unified-portal/app/api/schedule/`. All gated on `FEATURE_SCHEDULE` (return 404 when off).

### 5.1 GET /api/schedule/events

List events for the caller's tenant, with optional filters.

Query params:
- `from` (ISO date, required): start of window
- `to` (ISO date, required): end of window (max 90 days span)
- `development_id` (optional): filter to one development
- `unit_id` (optional): filter to one unit
- `event_type` (optional, repeatable): filter to event types
- `attendee_user_id` (optional): events that include this user as attendee

Behaviour:
1. Verify caller via `resolveSnagAuth`. snagger_external is allowed but their results are further filtered server-side to events tied to units they have access to (or events with them as attendee).
2. site_team_snag (internal) sees events with them as attendee only.
3. Admin and site_team see all tenant events in the window.
4. Return events ordered by `starts_at asc`. Each event includes:
   - Standard event fields
   - `attendees: [{user_id?, external_name?, role, rsvp_status}]`
   - `unit_label`, `development_label` (joined for display)

### 5.2 GET /api/schedule/events/[id]

Detail view of one event.

Behaviour:
1. Verify caller can access the event's tenant.
2. Return the event with full attendee list.
3. For snagger_external: 403 unless they are an attendee or the event is on a unit they have access to.

### 5.3 POST /api/schedule/events

Create an event.

Behaviour:
1. Verify caller is admin or site_team. Reject other roles with 403.
2. Accept:

```
{
  event_type: required,
  title: required (max 200),
  description: optional (max 2000),
  starts_at: required ISO timestamp,
  ends_at: optional ISO timestamp (>= starts_at),
  all_day: boolean (default false),
  location: optional (max 200),
  development_id: optional UUID,
  unit_id: optional UUID,
  attendees: [{user_id?, external_email?, external_name?, role}]
}
```

3. Validate development_id / unit_id belong to caller's tenant.
4. Insert event with `tenant_id` from caller, `created_by` from caller.
5. Insert attendee rows.
6. Return the created event with attendees.

### 5.4 PATCH /api/schedule/events/[id]

Update an event. Admin or site_team only. Same field set as POST except all fields optional. Cannot change `tenant_id` or `created_by`.

If attendees array provided, REPLACE the attendee list (delete + re-insert in a transaction).

### 5.5 POST /api/schedule/events/[id]/cancel

Set status to 'cancelled'. Admin or site_team only.

### 5.6 POST /api/schedule/events/[id]/rsvp

Update the caller's own attendee RSVP. Any role with an attendee record on the event can call.

Accept: `{ rsvp_status: 'confirmed' | 'declined' | 'tentative' }`.

### 5.7 Daily digest email (internal cron route)

Route: `POST /api/cron/schedule-digest`

Triggered by Vercel Cron at 07:00 Europe/Dublin daily. Auth via `INTERNAL_ENRICHMENT_KEY` (reuse, no new env var).

Behaviour:
1. For each tenant with `FEATURE_SCHEDULE` enabled and an `aftercare_email` set in `tenant_settings`:
2. Query events where `starts_at` is between today 00:00 and today 23:59 local time.
3. If zero events, skip silently.
4. If one or more events, send a digest email:
   - Subject: "Today's schedule - N events at [tenant name]"
   - Body: list events grouped by event_type, each with title, time, location, unit/development, attendees (names only)
5. Use the existing `getResendClient()` from `lib/resend.ts`.

Add the cron schedule to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/schedule-digest",
      "schedule": "0 7 * * *"
    }
  ]
}
```

Note: Vercel Cron runs in UTC. 07:00 Europe/Dublin is 07:00 UTC for half the year (Irish Standard Time) and 06:00 UTC the other half. For V1, run at fixed UTC 07:00 and accept the 1-hour drift through winter. A proper TZ-aware scheduler can come later.

---

## 6. UI

Two surfaces: a Schedule page, and a Schedule sidebar item.

### 6.1 Schedule sidebar item

Add to `apps/unified-portal/app/developer/layout-sidebar.tsx` in the Management section, between Homeowners and Smart Archive:

Schedule  (lucide Calendar icon)

Gated on `FEATURE_SCHEDULE`. No badge in V1 (badges would distract from the homeowner notification badge that already exists there).

### 6.2 /developer/schedule page

A two-view calendar.

**Top toolbar:**
- View toggle: Week | Month (pill toggle, brand-active styling matching the existing Issues view toggle)
- Date navigation: "Previous" Today "Next" showing the current range (e.g. "Mon 25 to Sun 31 May 2026")
- Filters dropdown: Development (multi-select), Event type (multi-select)
- "Add event" button on the far right (primary, brand-coloured, with Plus icon)

**Week view (default):**
- Seven columns, one per day
- Each day shows events as stacked cards in chronological order
- Event card: 1px brand-tinted left border with colour by event_type, title, time, optional unit/development, optional attendee count
- Event types use colour codes:
  - handover: brand gold (#D4AF37)
  - snag_visit: blue (#3b82f6)
  - contractor_visit: orange (#f97316)
  - homeowner_appointment: emerald (#10b981)
  - inspection: purple (#8b5cf6)
  - custom: neutral (#6b7280)
- Empty days show a thin "No events" placeholder
- Today's column gets a subtle gold-50 background tint

**Month view:**
- Grid of weeks, standard month calendar layout
- Each cell shows up to 3 events as compact pills (colour-coded by type, title truncated)
- Cells with more than 3 events show "+N more" link
- Click a date cell to open a day-detail drawer showing all events for that day
- Today is highlighted with a gold ring

**Event card click:** opens a right-side drawer with full event details, attendee list with RSVP states, and (for admin/site_team) Edit and Cancel buttons.

**Add event modal:**
- Title (required)
- Event type (required, dropdown)
- Date and start time (required)
- End date and end time (optional)
- All-day toggle
- Location (optional)
- Development (optional dropdown, loaded for the tenant)
- Unit (optional, filtered by selected development)
- Description (optional textarea)
- Attendees:
  - User picker (searches site_team_members in the tenant)
  - "Add external" button to enter external_email + external_name
  - Each attendee has a role dropdown
- Save button (creates the event, closes modal, refetches the calendar)
- Cancel button

**Event detail drawer:**
- Header: event title, status pill, type chip
- Time range, location
- Linked unit and development (clickable, navigate to those pages)
- Description
- Attendees list with RSVP status badges (confirmed = green, declined = red, tentative = amber, invited = neutral)
- If caller is an attendee: RSVP buttons (Confirm, Decline, Tentative)
- If caller is admin/site_team: Edit, Cancel buttons

### 6.3 Use the existing design system

- Cards: `bg-white`, `border border-neutral-200`, `rounded-lg`, same pattern as the rest of the developer dashboard
- Buttons: existing Button component with primary/outline/ghost variants
- Modal: existing Dialog component (whatever the codebase uses for the Reply/Escalate/Warranty modals from Sprint 3.5a)
- Drawer: existing right-side drawer pattern from the Issues dashboard

No new design tokens. No custom CSS beyond what's needed for the colour-coded event type left borders.

### 6.4 Copy

- Page heading: "Schedule"
- Subheading: "[N] events scheduled across all developments this [week/month]"
- Add event button: "Add event" (primary)
- Empty state (no events in view): "No events scheduled" with subtext "Add an event using the button above or check a different week."
- Event card hover state shows the start time
- Cancel confirmation: "Cancel this event? Attendees will not be notified automatically."
- Save success toast: "Event saved."
- Cancel success toast: "Event cancelled."
- Delete confirmation copy never uses the word "delete" (events are cancelled, not deleted, for audit).

---

## 7. Acceptance criteria

The sprint is done when the following pass on Vercel preview:

1. Sprints 1 through 3.5a.3 flows unchanged. No regression on Issues dashboard, Homeowners pages, or Snagging flows.
2. With `FEATURE_SCHEDULE=true`, the Schedule sidebar item appears for admin and site_team users.
3. With the flag off, the Schedule sidebar item is hidden and all `/api/schedule/*` routes return 404.
4. Admin users can create an event via the Add event modal. The event appears in the Week view at the correct day and time slot, colour-coded by event_type.
5. Admin users can edit and cancel an event via the detail drawer.
6. Cancelled events show with a strikethrough or muted treatment and are excluded from the daily digest.
7. Snaggers (site_team_snag) see only events with them as an attendee. Other tenant events do not appear in their view.
8. snagger_external sees only events on units they can access or events with them as attendee.
9. The Month view shows events grouped by day with the +N more affordance when a day has more than 3.
10. RSVP buttons appear in the drawer for attendees and update their rsvp_status correctly.
11. The daily digest cron route, when manually triggered via curl with the internal key, sends a digest email to the tenant's aftercare_email listing today's events grouped by type.
12. If the tenant has zero events today, no email is sent.
13. The vercel.json cron entry is present and the schedule path matches.
14. No em dashes anywhere.
15. Vercel build green before each PR is squash-merged.

---

## 8. Out of scope

- External calendar sync (Google Calendar, Outlook, iCal feed)
- Recurring events (daily standup, weekly site walks)
- Email invitations to attendees on event creation
- SMS or push notifications
- Attendee availability conflict detection
- Drag-to-reschedule
- Multi-tenant events
- Homeowner-facing schedule view
- Resource booking (rooms, equipment, vehicles)
- iCal/ICS export
- Bulk import from CSV
- Timezone handling beyond UTC + Irish local time display

All can come in later sprints if and when they're needed.

---

## 9. Implementation plan

Two Claude Code sessions.

**Session 1: schema and server routes**
Branch: `assistant-v2/sprint-4-schema-and-server`

- Apply the three migrations via Supabase MCP, separate apply_migration calls per the established pattern.
- Implement the six API routes plus the cron route under `apps/unified-portal/app/api/schedule/`.
- Add `FEATURE_SCHEDULE` and `NEXT_PUBLIC_FEATURE_SCHEDULE` to env-example files and to `lib/feature-flags.ts`.
- Add the vercel.json cron entry.
- One PR.

**Session 2: UI**
Branch: `assistant-v2/sprint-4-ui`

- Schedule sidebar item.
- `/developer/schedule` page with Week and Month views, event detail drawer, Add event modal.
- Reuse existing Card / Button / Dialog / Drawer components.
- One PR.

Session prompts will be passed in chat when the spec is merged.

---

## 10. After Sprint 4

Sprint 1b: real reasoning prompt. Sprint 5: snagger visit workflow (uses schedule_events from this sprint to link snagger visits to actual events). Sprint 6: PDF ingestion.

The Sprint 5 link is meaningful: once snaggers have a visit schedule, "my visits today" becomes a real workflow surface. This sprint lays the data foundation for that.
