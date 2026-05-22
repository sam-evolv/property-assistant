OpenHouse Assistant V2 - Sprint 3.5a Build Spec
Path in repo: `docs/specs/assistant-v2-sprint-3-5a.md` Status: Ready for implementation Scope: Homeowner pages redesign with reported issues integration. Privacy fix: remove Recent Conversations card. New status and source values for homeowner-raised issues. Three resolution actions. Sidebar notification badge. Aftercare email notification on new homeowner-raised issues. Prerequisite: Sprints 1, 2, 3, and 3.1 merged. issue_reports, assistant_media, purchaser_agreements, units, and developments all exist with data flowing.
1. Why this scope
Two things drive this sprint.
First, a privacy gap. The current `/developer/homeowners/[id]` page surfaces a Recent Conversations card showing verbatim text of homeowner-assistant chats. Under GDPR and basic consent principles, the lawful basis for the developer's admin team to read individual residents' chat history is unclear. A homeowner asking "what supermarkets are near me" is benign; the same surface could equally display sensitive personal queries. This sprint removes that surface from the dashboard. The chat data stays in the database (it is needed for future AI training and for Sprint 3.5b's anonymised aggregation) but it stops being viewable by admin users.
Second, an operational gap. Homeowner-raised issues from Sprint 1 currently have nowhere to land on the developer side. A photo uploaded via the assistant chat creates an issue_reports row that nobody sees unless they scroll the issues dashboard and notice the homeowner source badge. There is no notification, no clear surface, no workflow to act on it. This sprint puts those issues at the centre of the Homeowner relationship pages where they belong.
The redesign is restrained. The existing visual language of the page is good. We keep the brand and the card patterns, restructure where issues live, remove what should not be there, and refine the visual hierarchy so the page reads as a professional operational surface rather than a partly-finished prototype.
This sprint deliberately does NOT include anonymised topic aggregation. That is Sprint 3.5b, a discrete piece of infrastructure work better done in isolation.
2. Who uses this
Three roles see the homeowner pages, all developer-side:
Developer admin and developer staff: read everything in their tenant. Add notes on homeowner-raised issues. Trigger resolution actions (reply-and-resolve, escalate, mark-for-warranty). Configure the aftercare email address.
Internal site team and site managers: same as developer admin for the homeowner pages. They will be the primary daily user.
External snaggers: do not see the homeowner pages. They continue to use /snag and /snag/[id] only.
Role check happens server-side. snagger_external accessing any /developer/homeowners route returns 404.
3. Feature flag

```
FEATURE_HOMEOWNER_ISSUES=false

```

Default off in production. Enable for Bridge Property Group and Solas Renewables demo tenant during testing.
When off:

* The Reported Issues card on the homeowner detail page does not render.
* The sidebar notification badge does not render.
* The list view pending indicator does not render.
* The settings page for aftercare email returns 404.
* The /api/homeowners/* routes added by this sprint return 404.
* The email notification on new homeowner-raised issues does not fire.
* The Recent Conversations card removal still happens regardless of flag state, because that is a privacy fix that should always be live.
This flag is separate from FEATURE_DEVELOPER_DASHBOARD and FEATURE_BUILDER_SNAG_APP. All three can be on or off independently.
4. Database schema
Four small changes.
4.1 Migration 1 of 4 - new status value

```
alter table issue_reports
  drop constraint if exists issue_reports_status_check;

alter table issue_reports
  add constraint issue_reports_status_check
  check (status in ('open', 'resolved', 'reopened', 'homeowner_new'));

```

Status values become open, resolved, reopened, homeowner_new. The homeowner_new state is the initial state for homeowner-source issues. It distinguishes them from snagger-side items which still start as open.
4.2 Migration 2 of 4 - new source value

```
alter table issue_reports
  drop constraint if exists issue_reports_source_check;

alter table issue_reports
  add constraint issue_reports_source_check
  check (source in ('homeowner_assistant', 'site_team_snag', 'snagger_external', 'homeowner_escalated'));

```

When a homeowner-raised issue gets promoted to a real snag by the site admin clicking "Escalate to snag list", source moves to homeowner_escalated and status moves to open. The trail back to the homeowner is preserved.
4.3 Migration 3 of 4 - tenant_settings table

```
create table if not exists tenant_settings (
  tenant_id uuid primary key,
  aftercare_email text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table tenant_settings enable row level security;

create policy "service_role_bypass"
  on tenant_settings for all
  using (true)
  with check (true);

```

One row per tenant. The aftercare_email is the inbox that receives notifications when a new homeowner-raised issue arrives. Per-development settings can come later if needed.
4.4 Migration 4 of 4 - new column and backfill

```
alter table issue_reports
  add column if not exists resolution_type text;

create index if not exists issue_reports_status_idx
  on issue_reports (status)
  where status = 'homeowner_new';

```

Then backfill the existing two homeowner-source rows:

```
update issue_reports
set status = 'homeowner_new'
where source = 'homeowner_assistant' and status = 'open';

```

resolution_type is set when an issue is resolved via the mark-for-warranty action (value warranty_referral) or reply-and-resolve (value direct_reply). Snagger-side resolutions can populate this later if needed.
The partial index speeds up the sidebar badge count query.
5. Server routes
Six new routes under apps/unified-portal/app/api/homeowners/, plus an update to the existing homeowner-assistant ingestion path.
5.1 Update to /api/assistant/chat/multimodal
Existing route. When this route creates an issue_reports row from a homeowner photo upload, set status = 'homeowner_new' instead of the current default of 'open'.
No new logic, just changing the initial status. The default in the DB stays as 'open' so snagger-side ingestion is unaffected.
5.2 GET /api/homeowners/issues-count
Returns the count of homeowner_new issues for the caller's tenant. Used by the sidebar badge.
Behaviour:

1. Verify caller via resolveSnagAuth. Reject snagger_external with 403.
2. Count issue_reports rows where tenant_id matches caller's tenant, status = 'homeowner_new'.
3. Return { count: number }.
Lightweight, called on every dashboard page load.
5.3 GET /api/homeowners/[id]/issues
Returns all issues for a given homeowner (purchaser_agreement record).
Behaviour:

1. Verify caller. Reject snagger_external with 403.
2. Look up the purchaser_agreement by id. Verify caller can access the unit's tenant via assertCanAccessTenant.
3. Return issues where unit_id matches the purchaser_agreement's unit_id, ordered by status priority (homeowner_new first, then open, then reopened, then resolved) and then created_at desc.
4. Each issue includes the standard list row shape, plus the AI assessment if present, and a small media preview (first photo signed URL with one-hour expiry).
This is the data feed for the Reported Issues card on the homeowner detail page.
5.4 POST /api/homeowners/issues/[issue_id]/resolve
Reply-and-resolve action.
Accepts:

```
{ "reply_body": "string, required, max 2000 chars" }

```

Behaviour:

1. Verify caller has admin or site_team role. Reject snagger_external with 403.
2. Verify the issue's source is homeowner_assistant (this action only applies to unescalated homeowner issues).
3. Insert an issue_notes row with the reply body, author_user_id = caller, author_role = caller.role.
4. Update the issue: status = 'resolved', resolution_type = 'direct_reply', resolved_at = now().
5. Insert an issue_events row: event_type = 'resolved_by_reply', actor = caller, metadata = { resolution_type, note_id }.
6. Return the updated issue.
The reply text is captured as a note. Sending it back to the homeowner is out of scope for V1 (that needs the Sprint 1b chat loop). The note is the record of how it was resolved.
5.5 POST /api/homeowners/issues/[issue_id]/escalate
Escalate-to-snag-list action.
Accepts:

```
{ "note": "string, optional, max 2000 chars" }

```

Behaviour:

1. Verify caller has admin or site_team role. Reject snagger_external with 403.
2. Verify the issue's source is homeowner_assistant.
3. If note provided, insert an issue_notes row with it.
4. Update the issue: source = 'homeowner_escalated', status = 'open'.
5. Insert an issue_events row: event_type = 'escalated_from_homeowner', actor = caller, metadata = { note_id }.
6. Return the updated issue.
The issue now appears in the /developer/issues dashboard as a regular open snag. The source badge there will show "Homeowner" (the dashboard treats homeowner_escalated and homeowner_assistant as the same display badge but separate filterable sources).
5.6 POST /api/homeowners/issues/[issue_id]/warranty
Mark-for-warranty action.
Accepts:

```
{ "note": "string, required, max 2000 chars" }

```

Behaviour:

1. Verify caller. Reject snagger_external with 403.
2. Verify the issue's source is homeowner_assistant.
3. Insert an issue_notes row with the warranty referral note.
4. Update the issue: status = 'resolved', resolution_type = 'warranty_referral', resolved_at = now().
5. Insert an issue_events row: event_type = 'marked_for_warranty', actor = caller, metadata = { note_id }.
6. Return the updated issue.
A note is required for warranty referrals because they need documentation. The issue closes on the dashboard but is filterable by resolution_type = warranty_referral if the developer wants to see them later.
5.7 GET and POST /api/settings/notifications
Tenant settings for the aftercare email address.
GET behaviour:

1. Verify caller is admin. Reject other roles with 403.
2. Return the tenant_settings row for caller's tenant. If none exists, return { tenant_id, aftercare_email: null }.
POST behaviour:

1. Verify caller is admin.
2. Accept { aftercare_email: string | null }. Validate as a basic email if non-null.
3. Upsert the tenant_settings row.
4. Return the updated row.
5.8 Email notification on new homeowner-raised issue
This is a hook that fires when /api/assistant/chat/multimodal creates an issue with source = 'homeowner_assistant'. Not a new route.
Behaviour:

1. After the issue is created, read tenant_settings.aftercare_email for the unit's tenant.
2. If set, queue an email via the existing email infrastructure (or via a fire-and-forget fetch to a new internal route /api/notifications/homeowner-issue if there is no existing email path).
3. Email content includes:
   * Subject: "New issue raised by [homeowner name] at [unit display name]"
   * Body: homeowner name, unit, development, room (if set), the title/description, the AI assessment summary (or placeholder if none), one inline thumbnail or a link to the photo, and a link to the homeowner detail page in the dashboard.
4. Wrap in waitUntil per the established pattern so the email send does not block the response.
If no aftercare email is configured for the tenant, the notification is skipped silently (no error logged, since this is a deliberate config choice).
6. UI
The sprint changes four UI surfaces: the homeowner detail page, the homeowner list page card, the developer sidebar, and a new small settings page.
6.1 Homeowner detail page redesign
Path: `/developer/homeowners/[id]`
Goal: keep the existing visual language and brand. Restructure so reported issues are the centre of attention. Remove the Recent Conversations card.
New layout (top to bottom):
Header strip (full width, replaces the current top-of-page treatment):

* Avatar circle on the left with initial
* Name as large heading
* Development name beneath
* Documents Acknowledged status pill on the right (existing)
* Same brand colours and weight as today, but more compact than the current header
Profile Details card (left column, top, narrower than today):

* House type, address, added date (existing fields)
* Profile Details is still a card but it is now reference info, not the visual centre
* Keep the existing Edit button
Reported Issues card (right column, takes most of the right side, OR full width if the design system supports it):

* Card title: "Reported Issues"
* If zero issues: empty state copy "No issues raised by this homeowner yet."
* If items exist:
   * homeowner_new items at the top, with an amber accent on the left edge of each row
   * Each row shows: photo thumbnail (40-48px), title, room if set, relative time, status pill
   * Tap a row to expand inline with the full photo and AI assessment, plus the three action buttons
   * Resolved items below, more compact, no thumbnail or smaller thumbnail, no actions, just a small "Resolved [date]" pill
* A small inline count at the top: "3 awaiting review" if any homeowner_new exist; otherwise just "Reported Issues"
Resolution actions inside the expanded row:
When a homeowner_new item is expanded, three action buttons appear at the bottom of the expanded area:

* Reply and resolve (primary button, brand-coloured)
* Escalate to snag list (secondary button)
* Mark for warranty (tertiary button)
Tapping Reply and resolve opens a small modal or inline composer:

* Heading: "Reply to [homeowner name]"
* Text: "Your reply will be captured as the resolution note. The homeowner will be notified separately."
   * (In V1 the homeowner is NOT notified. The copy sets expectation for what V1 actually does: capture the reply as the resolution. When Sprint 1b adds the messaging loop, this copy updates.)
* Textarea, 2000 char limit, character count visible
* Send button (disabled until non-empty)
* Cancel button
Tapping Escalate to snag list opens a confirmation modal:

* Heading: "Escalate to snag list?"
* Body: "This issue will move into the operational snag workflow. The homeowner will still be linked. A site team member can resolve it from there."
* Optional note input
* Escalate button (primary)
* Cancel button
Tapping Mark for warranty opens a modal:

* Heading: "Mark for warranty"
* Body: "Record a note about how this should be handled by warranty. The issue will close on the dashboard but remain searchable."
* Required note input
* Mark button (disabled until non-empty)
* Cancel button
Homeowner Activity card (right column, below or beside Reported Issues, smaller):

* Card title: "Homeowner Activity"
* Three small stat blocks horizontally: Total messages, Engagement level, Last active
* Engagement level shown as a small pill: High (brand-green), Medium (neutral), Low (neutral)
* Total messages shown as a count
* Last active shown as relative time
* No conversation text. No question previews. No AI response previews. Just the three aggregate stats.
Access Code & Portal card (bottom of left column, unchanged):

* Keep the existing card. Access code, portal URL, handover status. No changes.
Removed entirely:

* The current Recent Conversations card. Gone from the page.
6.2 Homeowner list page card
Path: `/developer/homeowners`
Each homeowner card on this page gets a small new line beneath the address line, only when the homeowner has at least one homeowner_new issue:

```
[avatar] Daragh Walsh
         BS08
         3 Ardan View
         1 issue awaiting review               ← new, amber dot prefix

```

Visual treatment: small amber dot, then text in amber-700 or similar. One line. No icon beyond the dot. Hides entirely when count is zero.
This makes the list scannable for "who needs attention" without requiring a separate filter or view.
The existing card structure stays otherwise unchanged. The All / Acknowledged / Pending tab controls on the list page also stay (they are about document status, not issue status).
6.3 Developer sidebar - notification badge
In `apps/unified-portal/app/developer/layout-sidebar.tsx`, next to the "Homeowners" link in the Management section:
Add a small badge component on the right side of the link, similar to an Apple notification dot. Renders only when count > 0. Pulls count from GET /api/homeowners/issues-count.
Visual:

* Small filled pill or circle
* Amber-500 background, white text
* Count number inside (1, 2, 3 ... 9, then 9+ for higher)
* Right-aligned in the link row
The component should be a thin client component that fetches the count on mount and re-fetches periodically (every 60 seconds is fine for V1). No real-time push; the page would have already been opened by the time real-time would matter.
6.4 Settings page for aftercare email
Path: `/developer/settings/notifications`
New page. Single-card content:

* Page heading: "Notifications"
* Subheading: "Where should new homeowner-raised issues be sent?"
* One field: "Aftercare email address" with placeholder "e.g. aftercare@example.com"
* Save button
* Helper text below the field: "When a homeowner uploads a photo or raises an issue through the assistant, we will send an email to this address with the photo, the homeowner's details, and a link to the dashboard. Leave blank to disable email notifications."
On save: POST to /api/settings/notifications, show a small inline success ("Saved.") for 2 seconds.
Sidebar nav: add a "Settings" section at the bottom of the sidebar (above the user profile area) with one child link "Notifications" pointing here. The settings section is gated on user being admin, so it only appears for admin role users.
The settings section is structured for future growth (more settings categories will appear here in future sprints).
6.5 Copy
All new copy on the homeowner pages and settings:

* Reported Issues card title: "Reported Issues"
* Empty state: "No issues raised by this homeowner yet."
* Count prefix: "3 awaiting review" (using actual number)
* Resolved indicator: "Resolved" + date
* Reply-and-resolve button: "Reply and resolve"
* Escalate button: "Escalate to snag list"
* Warranty button: "Mark for warranty"
* Reply modal heading: "Reply to [name]"
* Reply modal helper: "Your reply will be captured as the resolution note. The homeowner will be notified separately."
* Reply send button: "Send and resolve"
* Escalate modal heading: "Escalate to snag list?"
* Escalate modal body: "This issue will move into the operational snag workflow. The homeowner will still be linked. A site team member can resolve it from there."
* Escalate confirm button: "Escalate"
* Warranty modal heading: "Mark for warranty"
* Warranty modal body: "Record a note about how this should be handled by warranty. The issue will close on the dashboard but remain searchable."
* Warranty confirm button: "Mark for warranty"
* Homeowner Activity card title: "Homeowner Activity"
* List card pending indicator: "1 issue awaiting review" (or "N issues awaiting review")
* Settings page heading: "Notifications"
* Settings subheading: "Where should new homeowner-raised issues be sent?"
* Settings field label: "Aftercare email address"
* Settings helper: "When a homeowner uploads a photo or raises an issue through the assistant, we will send an email to this address with the photo, the homeowner's details, and a link to the dashboard. Leave blank to disable email notifications."
* Settings save button: "Save"
* Settings success toast: "Saved."
No em dashes. No emoji. Calm, professional, peer-to-peer Irish tone.
7. What is explicitly out of scope

* Anonymised topic aggregation (Sprint 3.5b)
* Sending the reply back to the homeowner (Sprint 1b)
* Calendar view (Sprint 4)
* Per-development aftercare email addresses (V2 of settings if needed)
* Per-user view preferences
* Multi-recipient or distribution-list aftercare addresses
* SMS or push notifications
* Bulk operations (multi-select, bulk-resolve, bulk-escalate)
* Export / reporting on resolution rates
* The full Homeowners list page redesign beyond the small pending indicator
* The full visual redesign of the existing list view tabs (All / Acknowledged / Pending)
* Real AI reasoning prompt (Sprint 1b, separate track)
* Changes to the homeowner-facing assistant chat surface
8. Acceptance criteria
The sprint is done when all of the following pass on Vercel preview:

1. Sprints 1, 2, 3, and 3.1 flows are unchanged. No regression on the homeowner chat, snagger /snag form, snagger /snag/[id] view, the issues dashboard, or the unit grouped view.
2. The Recent Conversations card no longer renders on the homeowner detail page. This is true regardless of feature flag state.
3. With FEATURE_HOMEOWNER_ISSUES=true, the Reported Issues card renders on the homeowner detail page below or alongside the redesigned Homeowner Activity card.
4. A homeowner uploading a photo via the assistant chat creates an issue_reports row with status = 'homeowner_new' and source = 'homeowner_assistant'.
5. The sidebar badge next to Homeowners shows the correct count of homeowner_new items across the tenant, and refreshes within 60 seconds.
6. The list view card shows a "N issues awaiting review" line beneath the address for any homeowner with at least one homeowner_new issue.
7. Tapping Reply and resolve captures the reply text as an issue_notes row and moves the issue to status = 'resolved', resolution_type = 'direct_reply'.
8. Tapping Escalate to snag list moves the issue to source = 'homeowner_escalated', status = 'open'. The escalated item appears in the /developer/issues dashboard and unit grouped view as a regular open snag.
9. Tapping Mark for warranty captures the required note and moves the issue to status = 'resolved', resolution_type = 'warranty_referral'.
10. The settings page at /developer/settings/notifications accepts and persists an aftercare email address.
11. When the aftercare email is set and a new homeowner-raised issue is created, an email is sent to that address with the homeowner name, unit, photo, and a link to the dashboard.
12. When the aftercare email is unset, no email is sent and no error is raised.
13. A snagger_external attempting to access any /developer/homeowners route or /developer/settings/notifications returns 404.
14. With FEATURE_HOMEOWNER_ISSUES=false, the Reported Issues card, the sidebar badge, the list card indicator, and the settings page are all hidden. The Recent Conversations card stays removed.
15. The two existing homeowner-source rows from earlier sprints have been backfilled to status = 'homeowner_new'.
16. Vercel build is green before the PR is marked complete.
17. No em dashes anywhere.
9. Claude Code session plan
Three sessions, independent branches, commit-and-stop.
Session 1, Schema and backfill
Branch: `assistant-v2/sprint-3-5a-schema`
Prompt:

```
Implement section 4 of docs/specs/assistant-v2-sprint-3-5a.md.

Apply four migrations via the Supabase MCP in order:

1. DDL update: drop and recreate the status check constraint on
   issue_reports to allow the new 'homeowner_new' value.

2. DDL update: drop and recreate the source check constraint on
   issue_reports to allow the new 'homeowner_escalated' value.

3. DDL: create tenant_settings table with the schema in section 4.3,
   enable RLS, add service_role_bypass policy.

4. DDL + DML: add resolution_type text column to issue_reports,
   create the partial index on status='homeowner_new', then backfill
   the existing two homeowner-source rows from open to homeowner_new.

After each apply_migration, verify via execute_sql:
- Constraints exist with the expected check definitions
- tenant_settings table and RLS policy exist
- resolution_type column exists and the partial index exists
- The two backfilled rows now have status='homeowner_new'

No application code changes in this session. Commit on a new branch
called assistant-v2/sprint-3-5a-schema. Empty commit pattern from
prior sprints. Use git commit --allow-empty with this message:

  feat(assistant-v2): apply Sprint 3.5a schema for homeowner issues

  Applies migrations from section 4 of
  docs/specs/assistant-v2-sprint-3-5a.md via Supabase MCP:

  - Updates issue_reports status check to allow homeowner_new
  - Updates issue_reports source check to allow homeowner_escalated
  - Creates tenant_settings table with aftercare_email and
    service_role_bypass RLS
  - Adds resolution_type column to issue_reports
  - Creates partial index for the homeowner_new status badge query
  - Backfills the two existing homeowner-source issue rows

Open a PR titled:

  feat(assistant-v2): apply Sprint 3.5a schema for homeowner issues

Squash-merge once the PR is open. Tell me the PR URL and the new
HEAD commit on main.

No em dashes anywhere.

If any migration fails, stop immediately and report the exact error.

```

Session 2, Server routes and email hook
Branch: `assistant-v2/sprint-3-5a-server`
Prompt:

```
Implement section 5 of docs/specs/assistant-v2-sprint-3-5a.md.

The Sprint 3.5a schema is applied. Tables and constraints are in
place. Two existing homeowner-source rows are backfilled.

Your task is the server side. No UI work.

1. Add FEATURE_HOMEOWNER_ISSUES=false to:
   - apps/unified-portal/.env.example
   - .env.production.example
   - apps/unified-portal/lib/feature-flags.ts: export
     isHomeownerIssuesEnabled() covering server and
     NEXT_PUBLIC_FEATURE_HOMEOWNER_ISSUES.

2. Update the existing /api/assistant/chat/multimodal route. When
   it creates an issue_reports row from a homeowner photo upload,
   set status = 'homeowner_new' instead of relying on the default
   of 'open'. This is the only change to that route. Do not touch
   any other logic in it.

3. Implement six new routes under apps/unified-portal/app/api/homeowners/:
   - GET /issues-count (section 5.2)
   - GET /[id]/issues (section 5.3)
   - POST /issues/[issue_id]/resolve (section 5.4, reply-and-resolve)
   - POST /issues/[issue_id]/escalate (section 5.5)
   - POST /issues/[issue_id]/warranty (section 5.6)
   And one route under /api/settings/:
   - GET and POST /notifications (section 5.7)

4. All routes:
   - Return 404 immediately when FEATURE_HOMEOWNER_ISSUES is false.
     Exception: settings/notifications can return 404 only when both
     FEATURE_HOMEOWNER_ISSUES is false AND the route's GET would
     otherwise serve the page (the settings page also gates on the
     flag for UI rendering). For simplicity, gate /api/settings/
     routes on the flag too.
   - Use the existing snag-auth resolveSnagAuth helper for
     authentication.
   - Reject snagger_external with 403.
   - For routes that mutate (resolve, escalate, warranty), require
     admin or site_team role. Reject other roles with 403.
   - For the settings POST route, require admin role.
   - Use the Supabase service-role client for all database writes.
   - Derive tenant_id from the verified site_team_members row via
     the auth helper. Never trust client-supplied tenant_id.

5. The /issues-count route should use the partial index
   (issue_reports_status_idx) for fast count. Filter by
   status='homeowner_new' and tenant_id.

6. The /[id]/issues route joins issue_reports to the
   purchaser_agreement's unit_id. Order by status priority
   (homeowner_new first, then open, then reopened, then resolved)
   then created_at desc. Include first media signed URL with
   one-hour expiry.

7. The resolve, escalate, and warranty routes each:
   - Verify the issue's source is 'homeowner_assistant' (these
     actions only apply to unescalated homeowner issues). Reject
     others with 400.
   - Insert the appropriate issue_notes row.
   - Update issue_reports status / source / resolution_type per
     section 5.
   - Insert an issue_events row recording the action.
   - Return the updated issue.

8. Email notification (section 5.8):
   - After successful insertion of a homeowner_assistant issue in
     /api/assistant/chat/multimodal, fire a notification.
   - Read tenant_settings.aftercare_email for the unit's tenant.
     If null, skip silently.
   - Create a new internal route POST
     /api/notifications/homeowner-issue that takes the issue_id and
     sends the email. Authenticate via the same INTERNAL_ENRICHMENT_KEY
     pattern used for the snag enrichment route.
   - Use waitUntil to fire the notification without blocking the
     response. Same pattern as the Sprint 2 enrichment wiring.
   - For the actual email send, check what infrastructure exists in
     the repo. If there is an existing email send helper (look in
     lib/email/ or lib/notifications/), use it. If there is no
     existing email infrastructure, log a TODO in the route with
     a clear comment that this needs a real email send wired up,
     and proceed (the email content can be logged rather than sent
     so we can verify the data shape is right).

9. Do not modify any existing Sprint 1, 2, 3, 3.1 routes other than
   /api/assistant/chat/multimodal (one-line status change). Do not
   modify the dashboard /api/issues routes. Escalated items will
   surface there automatically because their source becomes
   'homeowner_escalated' and status becomes 'open'.

10. Verify Vercel build is READY using the Vercel MCP. If
    rate-limited, fall back to the GitHub commit status from the
    Vercel app.

11. Commit on assistant-v2/sprint-3-5a-server with PR titled:

    feat(assistant-v2): Sprint 3.5a server routes for homeowner issues

    PR body references section 5, lists each new route, mentions the
    one-line change to /api/assistant/chat/multimodal, describes the
    email notification approach (and whether real email infra was
    found), confirms no other existing routes were modified, and
    confirms Vercel build is green.

12. Squash-merge once green. Tell me the PR URL and new HEAD commit.

No em dashes anywhere.

If anything is ambiguous (especially around the email infrastructure
discovery), stop and ask.

```

Session 3, UI
Branch: `assistant-v2/sprint-3-5a-ui`
Prompt:

```
Implement section 6 of docs/specs/assistant-v2-sprint-3-5a.md.

The Sprint 3.5a schema and server routes are merged. Auth helpers,
new statuses, and the email hook are all in place.

Your task is the UI. Three surfaces change:

A. /developer/homeowners/[id] - the detail page redesign
B. /developer/homeowners - small pending indicator on cards
C. /developer/layout-sidebar.tsx - notification badge
D. /developer/settings/notifications - new settings page

The privacy fix happens here:

E. Remove the Recent Conversations card from the homeowner detail
   page. This removal happens REGARDLESS of FEATURE_HOMEOWNER_ISSUES
   state. It is unconditional.

Specifically:

1. /developer/homeowners/[id] redesign (section 6.1):
   - Restructure into a compact header strip at the top (avatar,
     name, development, status pill).
   - Profile Details becomes a smaller card on the left, still
     present.
   - New Reported Issues card as the main attention surface. Renders
     only when FEATURE_HOMEOWNER_ISSUES is true.
   - New Homeowner Activity card replacing Chat Activity & Engagement.
     Three small stat blocks: Total messages, Engagement level, Last
     active. No conversation text. Renders always (it's the
     replacement for Recent Conversations).
   - Access Code & Portal card stays at the bottom of the left column.
   - Recent Conversations card is removed entirely.

2. Reported Issues card behaviour:
   - Fetches from GET /api/homeowners/[id]/issues on mount.
   - homeowner_new items at the top with amber accent. Resolved
     items more compact below.
   - Each row shows photo thumbnail (first media), title, room if
     set, relative time, status pill.
   - Tap a row to expand inline (do not open a separate drawer or
     navigate). Expanded view shows full photo, AI assessment if
     present, and the three action buttons.
   - Three action buttons: Reply and resolve, Escalate to snag
     list, Mark for warranty. Use the brand palette for primary
     action.
   - Each action opens a small modal as specified in section 6.1.
   - On successful action, the card refetches its data so the
     resolved item moves to the resolved section.

3. /developer/homeowners list card pending indicator (section 6.2):
   - Each homeowner card already exists. Add a small extra line
     below the address only when the homeowner has at least one
     homeowner_new issue.
   - Small amber dot prefix, then "N issues awaiting review" in
     amber-700.
   - The card needs the count per-homeowner. Two ways:
     a) Extend the existing homeowners list endpoint to include the
        count per row. This is server-side, server-rendered.
     b) Fetch counts client-side after page load.
   - Prefer (a). Look at the existing /api/developer/homeowners or
     equivalent route and add a homeowner_new_issue_count subquery
     to it. If the existing list route is not easily extensible,
     fall back to (b).

4. Sidebar notification badge (section 6.3):
   - Thin client component in apps/unified-portal/app/developer/
     layout-sidebar.tsx (or a child file).
   - Fetches GET /api/homeowners/issues-count on mount.
   - Re-fetches every 60 seconds.
   - Renders only when count > 0 and FEATURE_HOMEOWNER_ISSUES is
     true.
   - Visual: amber-500 background, white text, small pill or
     circle, right-aligned in the Homeowners link row.

5. Settings page (section 6.4):
   - New route at /developer/settings/notifications.
   - Server component that gates on FEATURE_HOMEOWNER_ISSUES.
     Returns 404 when off.
   - Verifies caller is admin via resolveSnagAuth. Returns 404 if
     not admin.
   - Single-card form with one field: aftercare email.
   - Save button calls POST /api/settings/notifications.
   - Helper text as specified in section 6.4.
   - On successful save, show inline "Saved." for 2 seconds.

6. Sidebar Settings section:
   - Add a new "Settings" section at the bottom of the developer
     sidebar with one child link "Notifications" pointing to
     /developer/settings/notifications.
   - Only renders for admin role users (server-side check on
     layout).
   - Gated on FEATURE_HOMEOWNER_ISSUES (hide if flag is off).

7. Recent Conversations card removal:
   - This is the privacy fix. Find the Recent Conversations card on
     the homeowner detail page and remove it from the rendering
     entirely. The component itself can be deleted or just no longer
     imported. This change is NOT gated on any feature flag.

8. Reuse existing design system tokens. Brand palette is registered.
   Lucide React icons only. No em dashes anywhere in code, copy,
   commit messages, or PR text.

9. Copy verbatim from section 6.5.

10. Verify Vercel build is READY using the Vercel MCP. If
    rate-limited, fall back to GitHub commit status from Vercel app.

11. Commit on assistant-v2/sprint-3-5a-ui with PR titled:

    feat(assistant-v2): Sprint 3.5a homeowner pages redesign with reported issues

    PR body references section 6, lists each UI change, explicitly
    calls out the Recent Conversations card removal as the privacy
    fix and notes it is unconditional, lists the components added
    or modified, and confirms Vercel build is green.

12. Squash-merge once green. Tell me the PR URL and new HEAD commit.

If anything is ambiguous, stop and ask. The detail page layout
restructure (especially how the new cards fit in the existing
grid), the list card pending indicator data source (server-side vs
client-side), and the sidebar settings section gating are the bits
most likely to need clarification.

No em dashes anywhere.

```

10. After Sprint 3.5a
Sprint 3.5b is next: anonymised topic aggregation. A new homeowner_topic_summaries table, a daily batch job to categorise messages and update summaries, and a topics card on the Homeowners list page showing development-level patterns. Two to three sessions. Topic categories from the conversation: Local area & amenities, Building & documentation, Move-in logistics, Maintenance & how-to, Heating & energy, Issues & concerns, Other.
Then Sprint 4 (calendar with snagger visit scheduling). Then Sprint 1b (real AI reasoning prompt with iterative prompt work). Then Sprint 5 (snagger visits and resolution). Then Sprint 6 (PDF ingestion).
When Sprint 1b lands, the email notification copy in this sprint becomes meaningful: the AI assessment in the email body will be a real assessment rather than a placeholder, the homeowner will receive a real reply when a site admin uses Reply and resolve, and the topic aggregation in 3.5b will be informed by a smarter categorisation prompt.
