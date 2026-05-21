# OpenHouse Assistant V2 - Sprint 3 Build Spec

**Path in repo:** `docs/specs/assistant-v2-sprint-3.md`
**Status:** Ready for implementation
**Scope:** Developer-facing dashboard for snag intelligence. Operational visibility across both homeowner-sourced and builder-sourced issue reports. Read-mostly: developers can flag and add notes; they do not change status. Status mutations remain on the snagger-side /snag/[id] view.
**Prerequisite:** Sprints 1 and 2 merged. issue_reports, assistant_media, assistant_media_analysis, issue_report_media, issue_events, site_team_members, and snagger_invitations already exist with data flowing from both surfaces.

---

## 1. Why this scope

Sprints 1 and 2 built the ingestion. Sprint 3 builds the visibility. A developer pays for operational picture: how many open issues, where they are, what's serious, what's been resolved. The data has been collecting since Sprint 1 went live; this sprint is what surfaces it.

The discipline is to ship the dashboard, not the calendar, not the fixer resolution workflow, not the PDF ingestion. Each of those is a follow-on sprint. The dashboard alone is the demo a developer needs to see before they pay.

Developers do not mutate status. They view, filter, flag, and add notes. The snagging team and site manager close issues from the snagger-side view. This is a deliberate role split.

Status changes that happen in the snagger-side /snag/[id] view will be visible immediately in the dashboard. The dashboard refreshes its data on view changes, not in real time. That is sufficient for V1.

---

## 2. Who uses this

Three roles see the dashboard, with different write capabilities:

Developer admin and developer staff: read everything in their tenant. Add notes. Flag issues for attention. Cannot change status.

Internal site team and site managers: same as developer for the dashboard view, but they will also use the snagger-side /snag/[id] view to mark issues resolved.

External snaggers: do not see the dashboard. They continue to use /snag and /snag/[id] only. The dashboard is for developer-side users.

Role check happens server-side. If a snagger_external accesses /developer/issues, return 404.

---

## 3. Feature flag

FEATURE_DEVELOPER_DASHBOARD=false

Default off in production. Enable for the Longview Estates tenant and Solas Renewables demo tenant during testing.

When off, /developer/issues and /api/issues/* return 404. The sidebar nav entry does not render.

This flag is separate from FEATURE_BUILDER_SNAG_APP. Both can be on independently. The dashboard reads from issue_reports regardless of how snags got there; it works whether builder snagging is enabled or not.

---

## 4. Database schema

Sprint 3 reuses everything from Sprints 1 and 2. Two small additions.

### 4.1 Migration 1 of 2, DDL

create table if not exists issue_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  issue_report_id uuid not null references issue_reports(id) on delete cascade,
  author_user_id uuid not null,
  author_role text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists issue_notes_report_idx on issue_notes (issue_report_id);
create index if not exists issue_notes_tenant_idx on issue_notes (tenant_id);

alter table issue_reports
  add column if not exists developer_flagged boolean not null default false,
  add column if not exists developer_flagged_at timestamptz,
  add column if not exists developer_flagged_by uuid;

create index if not exists issue_reports_flagged_idx on issue_reports (developer_flagged) where developer_flagged = true;

The partial index on developer_flagged is small and fast. Only flagged rows are stored.

### 4.2 Migration 2 of 2, RLS

alter table issue_notes enable row level security;

create policy "service_role_bypass"
  on issue_notes for all
  using (true)
  with check (true);

No new RLS on issue_reports. The existing service-role bypass policy continues to apply to the new columns.

---

## 5. Server routes

Five new routes under apps/unified-portal/app/api/issues/.

### 5.1 GET /api/issues/overview

Returns the four overview card counts for the dashboard.

Behaviour:
1. Verify caller via the existing snag-auth helper. Reject snagger_external role with 403.
2. Determine accessible developments from the caller's site_team_members row (admins and site_team see all developments in the tenant).
3. Return open, high_priority, new_this_week, resolved_this_month counts.

high_priority is severity_label in ('high', 'urgent'). new_this_week is created in the last 7 days. resolved_this_month is status = 'resolved' with resolved_at in the last 30 days.

These counts are computed per request. No caching in V1.

### 5.2 GET /api/issues/list

Paginated list of issues for the dashboard.

Query params:
- development_id (optional, single uuid)
- status (optional, comma-separated list, defaults to open,reopened)
- severity (optional, comma-separated: low,medium,high,urgent)
- source (optional, comma-separated: homeowner_assistant,site_team_snag,snagger_external)
- flagged (optional, boolean, returns only developer-flagged when true)
- sort (optional, default created_at_desc. Other options: severity_desc, created_at_asc)
- limit (default 50, max 200)
- offset (default 0)

Behaviour:
1. Verify caller. Reject snagger_external with 403.
2. Determine accessible developments.
3. Apply filters, return paginated results.
4. Each row includes: id, title, source, severity_label, severity_score, status, priority, room, unit display_name (joined), development name (joined), media_count, note_count, developer_flagged, created_at, resolved_at, logged_by_role.
5. Do not return media URLs in the list. Media is fetched on detail view.

### 5.3 GET /api/issues/[id]

Single issue detail.

Behaviour:
1. Verify caller can access the issue's development_id.
2. Return the issue row plus joined unit and development names, media with one-hour signed URLs, the linked assistant_media_analysis row (or null), event timeline from issue_events, and all notes from issue_notes with author display names.

### 5.4 POST /api/issues/[id]/flag

Toggle the developer flag on an issue.

Behaviour:
1. Verify caller has admin or site_team role. Reject snagger_external with 403.
2. Toggle developer_flagged. Set developer_flagged_at and developer_flagged_by when setting to true; clear them when setting to false.
3. Insert an issue_events row: event_type = 'flagged' or 'unflagged', actor_type = role, actor_id = user_id.
4. Return the new flag state.

### 5.5 POST /api/issues/[id]/notes

Add a note to an issue.

Accepts { body: string }.

Behaviour:
1. Verify caller. All roles including snagger_external can add notes (notes are not status mutations, they're context).
2. Validate body is non-empty, max 2000 chars.
3. Insert issue_notes row.
4. Insert issue_events row: event_type = 'note_added', actor_type = role, actor_id = user_id, metadata = { note_id }.
5. Return the new note row.

---

## 6. UI, dashboard at /developer/issues

New route in apps/unified-portal/app/developer/issues/. Renders within the existing developer sidebar layout.

### 6.1 Sidebar nav structure

Update apps/unified-portal/app/developer/layout-sidebar.tsx.

The existing Snagging Team link (added in Sprint 2 at /developer/snaggers) should be re-organised into a parent Snagging section in the sidebar with two children:

- Issues, pointing at /developer/issues
- Team, pointing at /developer/snaggers

Place the parent Snagging section in the existing sidebar order between OpenHouse Intelligence and Pre-Handover Portal. That grouping reads as the operational visibility cluster.

Both child links should be hidden when the parent feature flag is off (Issues requires FEATURE_DEVELOPER_DASHBOARD; Team requires FEATURE_BUILDER_SNAG_APP). If both are off, the parent section does not render at all.

### 6.2 Overview cards

At the top of the page, four cards in a single row on desktop, two-by-two grid on mobile.

Each card is white background, subtle border, the number large and prominent, the label small and grey above the number. Accents (amber, green) are subtle: a small dot or a thin coloured bar on the left edge. No emoji, no gradients.

The High priority card is the most operationally important. If the count is greater than zero, it gets a subtle amber treatment. Zero is neutral.

### 6.3 Filter bar

Below the cards, a single row of filter chips. Use chip-style filters, not dropdowns, for the common ones. A dropdown for development is acceptable.

Chips: status filter, source filter, severity filter, development filter, flagged toggle, search input.

Filter chips show the current selection. Tapping a chip opens a small sheet with options.

The Flagged chip is a toggle (active state = filled with brand colour, inactive = outline). When active, the list shows only developer-flagged issues.

The search input filters by title (server-side, basic ILIKE).

### 6.4 List view

Below the filters, the main list.

Each row contains:
- A coloured vertical bar on the left of the row for severity (about 4px wide).
- Title (one line, truncate, large weight, dark text).
- Subtitle line: unit name, development, room joined with bullet separators.
- Status dot on the right.
- Media count badge if media exists.
- Relative time.
- Source badge (Homeowner, Snagger, Site team).
- Flag icon if flagged.

Severity colour mapping:
- urgent: red-600
- high: red-500
- medium: amber-500
- low: neutral-300
- null (no AI assessment yet): neutral-200

Tap a row, opens the detail drawer.

Pagination is Load more at the bottom. Tapping the button appends the next 50.

### 6.5 Detail drawer

Right-side drawer, slides in from the right. Takes 560px width on desktop, full-screen sheet on mobile.

On desktop the list stays visible behind the drawer (area dimmed). On mobile the drawer covers the full screen.

Drawer structure:
- Close button, flag button, menu button at top
- Title large
- Unit, development, room subtitle
- Source badge, status dot, severity label row
- Photo grid (3 across, tap opens lightbox)
- Resident message or snag notes (whichever is present)
- AI assessment section (collapsed by default if model_provider = 'placeholder')
- Notes section with new-note input and list of existing notes (newest at top)
- Timeline section showing all events from issue_events

Events to render in the timeline:
- snag_logged: "Logged by [actor]"
- analysis_completed: "AI assessment completed"
- flagged: "Flagged by [developer name]"
- unflagged: "Flag removed"
- note_added: "Note added by [actor]"
- status_changed: "Status changed from X to Y by [actor]"

Lightbox: tap a photo, opens a full-screen overlay with the signed full-resolution image. Escape and backdrop close it. Same component pattern as Sprint 1's chat lightbox.

The Flag button at the top right toggles developer_flagged. Visual state: outline icon when not flagged, filled icon when flagged. Tap inserts the flag event and refreshes the drawer.

The Copy link option in the menu copies a link to /developer/issues/[id] (the standalone page view, see 6.6).

### 6.6 Standalone detail page

/developer/issues/[id] renders the same detail content as the drawer, but as a full page with the sidebar visible.

Reasons it exists:
- URL-shareable (copy link from drawer)
- Refresh-safe
- Server-rendered so links to specific issues from emails or Slack work

Server-render the issue and its associated data, hydrate the same component used in the drawer. Single component, two surfaces.

### 6.7 Copy

- Page title: "Issues"
- Overview card labels: "Open", "High priority", "New this week", "Resolved this month"
- Empty list copy: "No issues match these filters."
- Empty notes: "No notes yet."
- New note placeholder: "Add a note for the team"
- Send note button: "Send"
- Flag tooltip: "Flag for attention"
- Unflag tooltip: "Remove flag"
- Copy link: "Copy link to issue"
- Lightbox: no chrome, just the photo, an X close button
- Resolved status: "Resolved"
- Open status: "Open"
- Reopened status: "Reopened"
- Loading state: "Loading issues..."
- Load more: "Load more"

No em dashes. No emoji. No AI-flavoured copy. Calm and direct, same as previous sprints.

---

## 7. What is explicitly out of scope this sprint

- Calendar view of handover dates and snagger visits (future sprint)
- Fixer resolution workflow with photo proof (future sprint)
- PDF snag-list ingestion and parsing (future sprint)
- Real-time updates (V1 refreshes on view change only)
- Contractor scorecards and pattern detection (Sprints 5 and 6)
- Real AI reasoning prompt (Sprint 1b, separate track)
- Bulk operations (multi-select, bulk-flag, bulk-export)
- Saved filter views
- Email/Slack notifications
- Export to CSV or PDF
- Mobile-optimised separate layout (the same layout works on mobile, but is not phone-first like the snag capture form)
- Status mutation from the dashboard (snaggers and site managers continue to use /snag/[id])

---

## 8. Acceptance criteria

The sprint is done when all of the following pass on Vercel preview:

1. Sprints 1 and 2 flows are unchanged. No regression.
2. With FEATURE_DEVELOPER_DASHBOARD=true, an admin can visit /developer/issues and see the four overview cards reflecting actual database counts.
3. The list shows all open issues across both surfaces, with the severity bar coloured per the AI assessment severity label.
4. Filters work: filtering by source, severity, status, and development each reduce the visible list correctly.
5. Clicking an issue opens the detail drawer with photos, AI assessment, notes section, and event timeline.
6. The flag button toggles developer_flagged and inserts a flagged or unflagged event.
7. Adding a note inserts an issue_notes row and a note_added event, then the new note appears in the drawer.
8. The standalone detail page at /developer/issues/[id] renders the same content as the drawer and is URL-shareable.
9. An external snagger attempting to access /developer/issues gets 404.
10. With FEATURE_DEVELOPER_DASHBOARD=false, the dashboard route and all /api/issues/* routes return 404, and the sidebar nav does not show the Issues link.
11. The standalone detail page works correctly for issues with no AI assessment yet (placeholder rows from Sprints 1 and 2 with null severity).
12. Status changes made from /snag/[id] (by a snagger or site manager) are reflected on the dashboard after refresh.
13. Vercel build is green before the PR is marked complete.
14. No em dashes anywhere.

---

## 9. Claude Code session plan

Three sessions, independent branches, commit-and-stop.

### Session 1, Schema

Branch: assistant-v2/dashboard-schema

Prompt:

Implement section 4 of docs/specs/assistant-v2-sprint-3.md.

Apply two migrations via the Supabase MCP in order:

1. DDL: create issue_notes table with the schema in section 4.1, add developer_flagged columns to issue_reports, create indexes.

2. RLS: enable RLS on issue_notes and create the service_role_bypass policy. No new RLS on issue_reports.

After each migration, verify via execute_sql:
- DDL: confirm issue_notes table exists with expected columns, and issue_reports has the new developer_flagged, developer_flagged_at, developer_flagged_by columns.
- RLS: confirm pg_policies shows service_role_bypass on issue_notes.

No application code changes in this session. Commit on a new branch called assistant-v2/dashboard-schema. The commit will be empty. Use git commit --allow-empty.

Open a PR titled: feat(assistant-v2): apply Sprint 3 schema for developer dashboard. PR body references section 4 of the spec.

Squash-merge once the PR is open. Tell me the PR URL and the new HEAD commit on main.

### Session 2, Server routes

Branch: assistant-v2/dashboard-server

Prompt:

Implement section 5 of docs/specs/assistant-v2-sprint-3.md.

Add FEATURE_DEVELOPER_DASHBOARD=false to env config and feature flag helper.

All five new routes under apps/unified-portal/app/api/issues/. All routes 404 when flag is off, use snag-auth resolveSnagAuth, reject snagger_external with 403 except for notes.

Verify Vercel build is READY. Commit on assistant-v2/dashboard-server with PR titled: feat(assistant-v2): Sprint 3 server routes for developer dashboard.

Squash-merge. Tell me the PR URL and HEAD commit.

### Session 3, UI

Branch: assistant-v2/dashboard-ui

Prompt:

Implement section 6 of docs/specs/assistant-v2-sprint-3.md.

Two new UI surfaces: /developer/issues (dashboard list with drawer detail) and /developer/issues/[id] (standalone detail page, server-rendered).

Sidebar nav restructure: group Snagging Team and the new Issues under a parent Snagging section.

Reuse the lightbox component from Sprint 1.

Build the detail view as a single component rendered both inside the drawer and on the standalone page.

The drawer should sync to a query param so back-button closes the drawer rather than navigating away.

Gated on FEATURE_DEVELOPER_DASHBOARD.

Verify Vercel build is READY. Commit on assistant-v2/dashboard-ui with PR titled: feat(assistant-v2): Sprint 3 developer dashboard for snag intelligence.

If anything is ambiguous, stop and ask. The drawer URL-state-syncing and the sidebar nav restructure are the bits most likely to need clarification.

---

## 10. After Sprint 3

After this sprint lands and the dashboard is live with the flag on for testing:

Sprint 1b (real reasoning prompt and multimodal model wiring) becomes the next high-leverage move. Once Sprint 1b lands, every existing snag automatically gets a real AI assessment retroactively. The severity colours on the dashboard come alive at that point.

Sprint 4 candidates, in rough order:
- Calendar view: handover dates, snagger visit schedules, contractor visits
- Fixer resolution workflow: site manager assigns a snag list to a fixer, fixer marks them resolved with photo proof
- PDF snag-list ingestion: admin uploads a PDF from a snagger who refuses to use the app, system parses to issue_reports

These are independent. Sprint 4 should be the one that makes the strongest demo for the next conversation in your pipeline.
