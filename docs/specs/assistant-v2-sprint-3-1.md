# OpenHouse Assistant V2 - Sprint 3.1 Build Spec

**Path in repo:** `docs/specs/assistant-v2-sprint-3-1.md`
**Status:** Ready for implementation
**Scope:** View toggle on the developer issues dashboard. "By unit" (default) and "Activity" views. Same data, same drawer, same routes. Smarter grouping.
**Prerequisite:** Sprint 3 merged. /developer/issues exists and is functional. Feature flag FEATURE_DEVELOPER_DASHBOARD controls visibility.

---

## 1. Why this scope

Sprint 3 shipped the developer dashboard as a flat list of issues. Testing it with real data immediately surfaced the wrong mental model: a developer thinking about their build site does not think "I have 47 open issues", they think "Unit 8 has 4 open, Unit 12 has 1, Unit 3 has none." The list is right for "what's new this week"; it is wrong for "what's the state of my development."

This sprint adds a view toggle. Default landing view becomes "By unit", issues grouped into unit cards with severity-coded counts and recent activity. The flat list moves behind an "Activity" toggle and is reframed as a feed of recent events across all units.

No new schema. No new routes. No new ingestion paths. Pure UI grouping work on top of the data already flowing.

This sprint deliberately does NOT include homeowner-raised issue handling, the Homeowners tab redesign, the aftercare email notification, or any change to the issue source / status model. Those land in Sprint 3.5 as a discrete piece of work focused on the homeowner relationship.

---

## 2. What changes

### 2.1 The view toggle

At the top of /developer/issues, below the page heading and above the overview cards, a two-option toggle:

[ By unit ]   [ Activity ]

Segmented control. Pill-shaped, brand-colour fill on the selected option. Tap switches view. URL syncs via a ?view=unit or ?view=activity query param. Default is unit. Per-user persistence comes later (Sprint 3.5 or later), V1 always defaults to unit on a fresh page load.

The four overview cards (Open, High priority, New this week, Resolved this month) stay above the views regardless of which view is selected. They are aggregate counts and belong to both views.

The filter bar (status, severity, source, scheme, flagged, search) also stays visible regardless of view. Filters apply to both views. A user filtering by source = "Site team" and switching from Activity to Unit view sees only site-team-sourced issues grouped by unit.

### 2.2 By unit view

A grid of unit cards. Each card represents a unit that has at least one issue matching the current filters. Units with zero matching issues do not render.

#### Card content

- Header line: unit display_name (e.g. "House 8") as the title, severity-coded counts on the right.
- Subtitle: development name and unit number (e.g. "002 . Ardan View").
- Issue rows: up to 3 most recent issues for this unit. Title (one line, truncate) and relative time.
- Footer: "Show all N" link if more than 3 issues exist for the unit.

Tap an issue row, opens the same drawer that Sprint 3 built. URL sync to ?view=unit&issue=<id> so back button closes the drawer and keeps the view selection.

Tap "Show all", expands the card inline to show all issues for that unit. No new route, just a state toggle on the card.

#### Severity-coded count chips

The right side of the card header shows up to two chips:

Open chip: shows the total count of open + reopened issues for this unit. Background neutral-100, text neutral-700. Dot colour by worst severity in the open issues:
- red-600 if any urgent
- red-500 if any high
- amber-500 if any medium
- neutral-500 otherwise

Urgent / High chip (only shown when count > 0): shows count of urgent + high severity open issues. Background red-50, text red-700.

These two chips together communicate the unit's status at a glance. A unit card with 3 open and 1 urgent tells the developer immediately: this unit has urgent attention needed.

#### Card ordering

Units sort in this priority order:

1. Units with any urgent open issues first
2. Then units with any high-priority open issues
3. Then by open issue count descending
4. Then alphabetical by unit display_name

This ordering puts attention where it is needed without forcing the developer to filter. The first card on the page is always the unit that most needs eyes on it.

#### Empty state

When the current filter combination produces zero units with issues:

No units have issues matching these filters.

Centered, neutral-600 text. Same calm tone as Sprint 3's empty states.

#### Mobile layout

Single column. Each card is full-width. Same content, same chips, same expansion behaviour. The drawer becomes full-screen as it does in Sprint 3.

### 2.3 Activity view

The existing Sprint 3 flat list, reframed. Same rows, same drawer behaviour, same filter and search behaviour. The only change is the framing, this view is now positioned as "recent activity across all units" rather than as the default operational view.

No code change required for the list itself. Just the toggle making it accessible.

### 2.4 Drawer behaviour

Unchanged. Same component, same URL sync, same content. Whether opened from a unit card row or an activity feed row, it renders identically.

---

## 3. Database schema

No changes. Sprint 3.1 is pure UI work on existing data.

---

## 4. Server routes

No new routes. Two existing routes get small additions:

### 4.1 GET /api/issues/list

Add an optional query param group_by_unit (boolean, default false).

When group_by_unit=true:

Server returns the same row shape as before, but the response is structured as units containing issues rather than a flat list of issues.

Response shape:
- units: array of objects, each containing unit_id, unit_display_name, development_id, development_name, open_count, urgent_high_count, worst_severity, and an issues array with the top 3 most recent issues in the same row shape as the flat list.
- total_units: number.

Units are sorted by the ordering rule in section 2.2. Each unit's issues array contains the top 3 most recent issues for that unit, sorted descending by created_at. To get more, the client makes a second call with unit_id and limit=50.

All existing filters (status, severity, source, scheme, q for search) still apply when group_by_unit=true. They filter the issues that count toward each unit, and units with zero matching issues are excluded.

The limit and offset params behave at the unit level when group_by_unit=true, pagination is across units, not across issues. Default limit 50 units.

When group_by_unit=false or omitted, behaviour is exactly as today.

### 4.2 GET /api/issues/list with unit_id filter

Add unit_id as an optional query param to the existing flat list call. When present, the response is the flat list filtered to that unit only.

This is what the "Show all N" footer on a unit card calls, it switches the card to show all issues for that unit, fetched via this filter.

No other route changes. The overview counts, the issue detail, the flag, and the notes routes are all unchanged.

---

## 5. UI components

New components under apps/unified-portal/components/issues/:

- IssueViewToggle.tsx, the segmented control at the top
- IssueUnitGrid.tsx, the grid of unit cards
- IssueUnitCard.tsx, single unit card
- IssueUnitCardHeader.tsx, the header line with title and chips
- IssueUnitCountChip.tsx, the small count chips with severity-coded dot

Existing components reused unchanged:

- IssueOverviewCards.tsx, still at the top, unchanged
- IssueFilterBar.tsx, still below the toggle, unchanged
- IssueListRow.tsx, used inside the unit card's expanded state, unchanged
- IssueDetailDrawer.tsx, opens from both views, unchanged
- IssueLightbox.tsx, unchanged

The main page component IssuesDashboardClient.tsx gets updated to handle the view toggle state and to render either IssueUnitGrid or the existing flat list depending on the current view.

### 5.1 Copy

- View toggle labels: "By unit" and "Activity"
- Show all link: "Show all N" where N is the total issue count for that unit (open + resolved + everything)
- Empty unit grid: "No units have issues matching these filters."
- Card subtitle separator: " . " (period with surrounding spaces, matching existing Sprint 3 row subtitle pattern)

No em dashes. No emoji.

---

## 6. What is explicitly out of scope

- Any change to homeowner-raised issue handling (Sprint 3.5)
- The Homeowners tab redesign (Sprint 3.5)
- Aftercare email notifications (Sprint 3.5)
- New status states or workflow changes (Sprint 3.5 and beyond)
- Calendar view (Sprint 4)
- Snagger visit scheduling (Sprint 5)
- Resolution workflows (Sprint 5)
- PDF ingestion (Sprint 6)
- Real AI reasoning prompt (Sprint 1b, separate track)
- Per-user view preference persistence
- Unit-level analytics (snag rates over time, contractor attribution)
- A unit detail page (the "Show all N" footer expands inline; no new route)

---

## 7. Acceptance criteria

The sprint is done when all of the following pass on Vercel preview:

1. Sprints 1, 2, and 3 flows are unchanged. No regression on the homeowner chat, snagger /snag form, snagger /snag/[id] view, or the Sprint 3 drawer behaviour.
2. /developer/issues defaults to the "By unit" view on a fresh page load.
3. The view toggle visually distinguishes the active option and updates the URL query param on switch.
4. Unit cards display in the severity-priority order described in section 2.2.
5. Each unit card shows up to 3 most recent issues with the correct count chips.
6. Tapping an issue row in a unit card opens the same drawer as the Activity view.
7. The drawer URL contains both ?view=unit and ?issue=<id> so back-button closes the drawer without losing the view selection.
8. "Show all N" expands the card inline to show every issue for that unit.
9. Filter changes update both views. Switching views does not clear filters.
10. Search updates both views. Switching views does not clear the search query.
11. When the filter combination produces zero matching units, the empty state copy renders.
12. On mobile, the unit grid renders as a single column and the drawer becomes full-screen.
13. Cross-tenant access attempts return 403 from the API routes (unchanged from Sprint 3).
14. With FEATURE_DEVELOPER_DASHBOARD=false, /developer/issues returns 404 and the API routes return 404 (unchanged from Sprint 3).
15. Vercel build is green before the PR is marked complete.
16. No em dashes anywhere.

---

## 8. Claude Code session plan

Two sessions, independent branches, commit-and-stop.

### Session 1, Server

Branch: assistant-v2/sprint-3-1-server

Prompt:

Implement section 4 of docs/specs/assistant-v2-sprint-3-1.md.

The Sprint 3 server routes are already merged (PR #161). This session extends GET /api/issues/list with two new query params:

- group_by_unit (boolean, optional, default false): when true, returns the unit-grouped response shape described in section 4.1.
- unit_id (uuid, optional): when present, returns the flat list filtered to that unit only.

When group_by_unit is true:
- Apply all existing filters (status, severity, source, scheme, q, flagged) to the issues that count toward each unit.
- Exclude units with zero matching issues.
- Sort units by the priority order in section 2.2 of the spec: units with urgent open issues first, then high-priority, then by open issue count descending, then alphabetical.
- Include open_count, urgent_high_count, worst_severity, and the top 3 most recent issues for each unit.
- Pagination (limit, offset) operates at the unit level. Default limit 50.

When unit_id is present (with group_by_unit false or omitted):
- Filter the flat list to that unit only.
- All other filters still apply.

The existing behaviour with both params absent stays unchanged.

Do not modify any other route. Do not modify the schema. Do not introduce any new tables.

Verify Vercel build is READY using the Vercel MCP. Commit on branch assistant-v2/sprint-3-1-server with PR titled:

  feat(assistant-v2): unit grouping in issues list route for Sprint 3.1

Squash-merge once green. Tell me the PR URL and new HEAD commit.

No em dashes anywhere.

### Session 2, UI

Branch: assistant-v2/sprint-3-1-ui

Prompt:

Implement section 5 of docs/specs/assistant-v2-sprint-3-1.md.

The Sprint 3.1 server changes are merged. /api/issues/list now accepts group_by_unit and unit_id query params.

Add the view toggle and unit grid to /developer/issues.

1. New components under apps/unified-portal/components/issues/:
   - IssueViewToggle.tsx (segmented control)
   - IssueUnitGrid.tsx (responsive grid of unit cards)
   - IssueUnitCard.tsx (single card with header, top 3 issues, expandable to all)
   - IssueUnitCardHeader.tsx (title, subtitle, count chips)
   - IssueUnitCountChip.tsx (severity-coded chip)

2. Update IssuesDashboardClient.tsx to:
   - Read ?view= query param (default unit).
   - Render IssueUnitGrid when view=unit, the existing list when view=activity.
   - Sync view to URL via router.push when the toggle changes.
   - Preserve filters, search, and the drawer's ?issue= param across view changes.

3. Unit card behaviour:
   - Tap an issue row opens the existing IssueDetailDrawer with ?view=unit&issue=<id> in the URL.
   - Tap "Show all N" expands the card inline to render every issue for that unit via a follow-up fetch with unit_id.

4. Severity-coded count chips per section 2.2 of the spec.
   - Open chip: count of open + reopened, dot coloured by worst severity in the open issues.
   - Urgent / High chip: only when count > 0, red-50 background, red-700 text.

5. Unit ordering by severity priority then count then alphabetical.

6. Use the design system tokens (brand palette is registered in Tailwind as of PR #164). Lucide React icons only.

7. Copy from section 5.1: "By unit", "Activity", "Show all N", "No units have issues matching these filters.". No em dashes.

8. Mobile: single column unit grid, full-screen drawer behaviour unchanged from Sprint 3.

9. Reuse IssueOverviewCards, IssueFilterBar, IssueListRow, IssueDetailDrawer, and IssueLightbox unchanged.

10. Default view on first load is "By unit". Do not implement per-user view persistence.

Verify Vercel build is READY using the Vercel MCP. Commit on branch assistant-v2/sprint-3-1-ui with PR titled:

  feat(assistant-v2): unit grouped view for issues dashboard

Squash-merge once green. Tell me the PR URL and new HEAD commit.

If anything is ambiguous, stop and ask. The unit grouping fetch and the toggle URL sync are the most likely to need clarification.

No em dashes anywhere.

---

## 9. After Sprint 3.1

Sprint 3.5 is the next move: the Homeowners tab redesign with the Reported Issues integration, the aftercare email notification, and the homeowner-raised issue resolution workflow (reply-and-resolve, escalate-to-snag, mark-for-warranty). Once that lands, the system handles homeowner relationships properly and the Sprint 4 calendar work has a clean foundation to build on.

Sprint 4 is the calendar. Sprint 5 is snagger visits and resolution. Sprint 6 is PDF ingestion. Sprint 1b (real AI reasoning prompt) slots in somewhere between 3.5 and 4, by then the prompt has multiple surfaces to support and the work justifies its own session.
