# OpenHouse Assistant V2 - Sprint 3.5a.1 Polish and Restructure

**Path in repo:** `docs/specs/assistant-v2-sprint-3-5a-1.md`
**Status:** Ready for implementation
**Scope:** Polish, page restructure, and escalation feedback. One Claude Code session. No new database tables, no new server routes, no new feature flags.
**Prerequisite:** Sprint 3.5a (PRs #170, #171, #172, #173) merged. Production HEAD `efa1174a` or later.

---

## 1. Why this scope

Three problems with the Sprint 3.5a output, identified during testing:

First, **escalated items don't surface prominently enough.** When a homeowner-raised issue is escalated to the snag list, it correctly moves to `source = 'homeowner_escalated'` and `status = 'open'`, but the dashboard treats it like any other open snag. There's no signal that this issue just came from a homeowner who is waiting for a response. The user has to know which unit to search for, which defeats the purpose of escalation.

Second, **the page restructure described in Sprint 3.5a didn't really happen.** The detail page got new cards but the structural change was interpreted as "replace the Recent Conversations card with new content" rather than "restructure the page so issues are the visual centre." The page still feels like the existing template with cards swapped, not a page redesigned around the new primary use case.

Third, **the general look is poor.** New cards have the same density and weight as existing ones. The Reported Issues card with one row takes lots of vertical space. The expanded state feels cramped. The action buttons lack visual hierarchy. Empty states are text-only. The page reads as bolted-together rather than designed.

This sprint addresses all three. One Claude Code session, surgical changes, no new infrastructure.

---

## 2. Out of scope (explicit)

- No new database tables or columns
- No new API routes
- No new feature flags
- No changes to the resolve/escalate/warranty API contracts
- No changes to the homeowner-side assistant chat
- No changes to the Issues dashboard's overall layout, filters, or unit-grouped view structure (only the small additions described in section 5 below)
- No changes to other developer pages (Compliance, Smart Archive, Data Hub, Communications, etc)
- No redesign of the homeowners LIST page beyond what already shipped in Sprint 3.5a

---

## 3. Page restructure: /developer/homeowners/[id]

The current layout has a standard two-column grid: Profile Details + Access Code in the left column, Reported Issues + Homeowner Activity + Community Noticeboard Terms + Must-Read Document Acknowledgement in the right column. The page is very long. The new cards from Sprint 3.5a blend in with the existing ones because they have the same visual weight.

### 3.1 Compact header strip

Replace the current top-of-page treatment with a genuinely compact strip. Target: 72 to 96px of vertical space total, not the current ~140px.

Structure:

- Left: 48px avatar circle with initial (smaller than today)
- Middle: name as h1 with development name as subtitle directly beneath. Single column, tight line height.
- Right: Documents Acknowledged pill (unchanged styling, just smaller)

No vertical padding above the avatar beyond what the page container provides. No bottom border (let the cards below provide the visual edge). Tight horizontal padding consistent with the rest of the developer pages.

### 3.2 Two-column layout with new proportions

Left column: 33% width on desktop, full width on mobile.
Right column: 67% width on desktop, full width on mobile.

The shift is meaningful: today the columns are roughly equal. The new ratio puts the page's centre of attention on the right.

### 3.3 Left column contents

Top to bottom:

1. **Profile Details card.** Smaller than today. House Type, Address, Added date stacked tightly. No icons next to each field (currently each has a small icon, remove them). Edit button as a small inline link in the card header, not a button. Target card height: ~200px instead of the current ~280px.

2. **Access Code & Portal card.** Keep the existing card structure but compact it. Access code shown smaller (the current monospace pill is too big). Pre-Handover badge stays. Portal URL with copy button stays. Download QR and Open Portal buttons get smaller too. Target card height: ~280px instead of the current ~360px.

3. **Documents & Acceptance** (NEW, collapsed by default). A single card with a chevron header that toggles open. Closed state shows just the header line: "Documents & Acceptance" with a small acknowledgement status pill on the right (e.g. "Acknowledged" green pill, or "Pending" amber pill). Open state reveals the two existing cards (Community Noticeboard Terms and Must-Read Document Acknowledgement) stacked inside it.

   The two existing cards become subsections of this collapsible card. Their internal content stays the same but their card chrome (border, padding, title) is reduced since they're nested. Border becomes a divider line between them. Padding becomes vertical only.

   When closed (the default), the collapsible takes about 56px of vertical space. When open, the existing content fills the same space it does today.

### 3.4 Right column contents

Top to bottom:

1. **Reported Issues card.** This is the page's visual centre. Make it look like one.

   - Card has slightly heavier border (1.5px instead of 1px) or a very subtle drop shadow to lift it visually from the surrounding cards.
   - Card title in larger weight than other cards on the page. Use the same h2 treatment that the page used for "Reported Issues" but with the "N awaiting review" inline count rendered as a separate small amber pill on the right side of the title row, NOT as appended parentheses text.
   - When there are zero issues: replace the current text-only empty state with a proper one. Centered icon (lucide-react Inbox or PackageOpen at 32px in brand-50 background circle), then the empty state text below it ("No issues raised by this homeowner yet."), then a small line of secondary text: "Issues raised through the assistant chat or escalated by site team will appear here." Card height for the empty state: ~240px.
   - When there are issues: the rows themselves have more breathing room. Row vertical padding increases from current ~12px to ~20px. The amber left-edge accent on `homeowner_new` rows becomes more prominent (4px wide instead of 2px).
   - Each row: 48px photo thumbnail on the left (or 48px placeholder with the Image icon when no media), title in semibold, room and relative time on a second line in neutral-500, status pill on the far right.
   - Expanded row: more whitespace between the resident message, the description, the AI assessment block, and the action buttons. Separator lines between sections within the expanded row, not just whitespace.

2. **Homeowner Activity card.** Visual upgrade. Currently three stat blocks in a row with labels and values. Improve to:
   - Each stat block has an icon in a small brand-50 circle to the left of the value
   - Total messages: MessageSquare icon
   - Engagement level: Activity icon
   - Last active: Clock icon
   - Values still big and prominent. Labels in neutral-600 below the value. The current layout is correct in principle, it just needs the icons to give it visual weight.

### 3.5 Action button hierarchy

In the expanded issue row, the three buttons currently look similar. Fix:

- **Reply and resolve** is the primary action. Full brand colour (the gold fill the dashboard uses for primary buttons elsewhere), white text. This is what 80% of homeowner uploads should get.
- **Escalate to snag list** is secondary. Outlined button (border + background-color: transparent), brand text, no fill.
- **Mark for warranty** is tertiary. Ghost button (no border, no fill), neutral text. Used least often.

This matches the principle that visual weight should correlate with frequency of use.

---

## 4. Polish details

Specific small fixes across the page:

### 4.1 Card consistency

All cards on the page should use the same border treatment, padding, and corner radius. Today there's small variation. Standardise to whatever pattern the developer dashboard uses elsewhere (Issues dashboard cards are the reference).

### 4.2 Card titles

All card titles should use the same h2 treatment, same size, same icon size (16px lucide), same icon-to-text gap, same colour. Today the icons next to titles vary in size and colour subtly.

### 4.3 Whitespace

- 24px gap between cards in each column (vs current 16px in places)
- 32px gap between the header strip and the first row of cards
- Page bottom padding: 48px before the footer area

### 4.4 The Reported Issues card specifically

- The "1 awaiting review" inline count is its own small pill, amber-100 background with amber-700 text, sitting beside the card title with a 12px gap. Not parentheses text.
- The amber left-edge accent on `homeowner_new` rows: 4px wide, full row height, rounded top-left and bottom-left corners matching the row corner radius.
- Status pills in rows: smaller than they currently are. Use the same pill styling as the Issues dashboard's status column.
- Photo thumbnail: 48px square, rounded corners, neutral-100 background when empty with a centered Image icon at 20px.

### 4.5 The Homeowner Activity card specifically

- Icon circles: 32px diameter, brand-50 background, brand-700 icon at 16px
- Value text: 24px semibold
- Label text: 13px neutral-600
- Horizontal layout on desktop (icon-value-label per block, three blocks across), stacks to vertical on mobile

### 4.6 The collapsed Documents & Acceptance card

- Closed state: chevron-right icon on the left, "Documents & Acceptance" title, status pill on the right ("Acknowledged" green or "Pending" amber based on the existing acknowledgement state), entire row clickable
- Open state: chevron rotates 90 degrees, title row stays, content expands below with a top divider
- Animation: 200ms ease transition on the chevron rotation and the content expand

---

## 5. Escalation feedback

Two changes, both small.

### 5.1 Escalation success toast with link

When the escalate POST succeeds (in the existing EscalateModal component), the success toast should:

- Show as: "Escalated to snag list. Now visible in Issues dashboard."
- Include an inline link "View in Issues dashboard" that opens the dashboard with the just-escalated issue's drawer pre-opened (i.e. `/developer/issues?issue=<issue_id>`)
- Toast duration: 8 seconds (longer than the default 3-4 because the user might want to click the link)

The current implementation just closes the modal and refetches the homeowner page. The toast exists already in the codebase; this is just changing the text and adding a link.

### 5.2 Newly escalated marker on Issues dashboard rows

When an issue has `source = 'homeowner_escalated'` AND was escalated within the last 24 hours (calculated from the most recent `issue_events.event_type = 'escalated_from_homeowner'`), show a small "Newly escalated from homeowner" marker on the row. Derive the timestamp from the events table since the sprint adds no new columns.

Implementation: extend the existing issues list endpoint response to include a `newly_escalated: boolean` field on each row, computed server-side from the events table. Or, simpler: compute it client-side from the issue's existing event history if the dashboard already loads events. Pick whichever is fewer touchpoints.

Visual treatment of the marker on the dashboard row: amber dot followed by "From homeowner" in amber-700 text, small, sits in the row's secondary line beneath the title. Hides automatically after 24h.

This needs no schema change because the trail is already in `issue_events`.

---

## 6. Acceptance criteria

The sprint is done when all of the following pass on Vercel preview:

1. The homeowner detail page header is visually compact (~80px high), not the current ~140px.
2. The page uses a 33/67 two-column layout on desktop, not 50/50.
3. The Reported Issues card is visually the centre of the page (heavier border or subtle shadow, larger title, more breathing room in rows).
4. The Reported Issues empty state shows an icon-led design, not just text.
5. Profile Details and Access Code cards are smaller and more compact than today.
6. Community Noticeboard Terms and Must-Read Document Acknowledgement are nested inside a "Documents & Acceptance" collapsible card on the left column, collapsed by default.
7. The Homeowner Activity card has icons in each stat block.
8. The three action buttons in the expanded issue row have clear visual hierarchy: Reply and resolve is filled-primary, Escalate is outlined-secondary, Mark for warranty is ghost-tertiary.
9. After successful escalation, the toast says "Escalated to snag list. Now visible in Issues dashboard." with a working link to the dashboard with the issue's drawer pre-opened.
10. Issues with `source = 'homeowner_escalated'` show a "From homeowner" amber-dot marker on the Issues dashboard for 24 hours after escalation.
11. After 24 hours, the marker no longer renders for that issue.
12. All existing Sprint 3.5a functionality still works (sidebar badge, list card indicator, three resolution actions, settings page).
13. The Recent Conversations card stays removed (privacy fix is unconditional).
14. Production with `FEATURE_HOMEOWNER_ISSUES=false` still hides everything the flag is supposed to hide, even with the new visual changes.
15. Vercel build is green before the PR is marked complete.
16. No em dashes anywhere.

---

## 7. Implementation plan

Single Claude Code session. One branch, one PR.

Branch: `assistant-v2/sprint-3-5a-1-polish`

The session prompt will be passed in chat when the spec is merged.

---

## 8. After Sprint 3.5a.1

Sprint 3.5b: anonymised topic aggregation. New `homeowner_topic_summaries` table, daily batch categoriser, Topics card on the homeowners list page surfacing development-level patterns. 2-3 sessions.

Then Sprint 4 (calendar with snagger visits). Then Sprint 1b (real reasoning prompt). Then Sprint 5 (snagger workflow). Then Sprint 6 (PDF ingestion).
