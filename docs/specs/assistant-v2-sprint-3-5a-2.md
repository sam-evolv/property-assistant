# OpenHouse Assistant V2 - Sprint 3.5a.2 Tight Polish

**Path in repo:** `docs/specs/assistant-v2-sprint-3-5a-2.md`
**Status:** Ready for implementation
**Scope:** Finish the polish that Sprint 3.5a.1 only partially delivered, plus the escalation-to-top behaviour that was missed. One Claude Code session. No new database tables, no new feature flags.
**Prerequisite:** Sprint 3.5a.1 (PR #175) merged. Production at HEAD `acb47a9` or later.

---

## 1. How to read this spec

This spec is written prescriptively, not descriptively. Targets are measurable. Acceptance criteria are pass/fail.

Before opening the PR, the implementation must self-verify against the acceptance criteria in section 8. If any criterion fails, fix it before opening the PR. A criterion that says "header height is 80px or less" means measure it with browser dev tools and confirm. A criterion that says "icons removed from Profile Details fields" means open the page in dev and confirm no icons are present beside House Type, Address, or Added.

If a criterion cannot be met because the existing design system makes it impossible (e.g. the button component doesn't expose the variant required), stop and ask. Do not silently substitute.

---

## 2. What Sprint 3.5a.1 missed

Testing on the preview after Sprint 3.5a.1 merged showed:

1. **Header height was not reduced.** Still appears at ~140px instead of the target 80px.
2. **Field icons in Profile Details were not removed.** The icons next to House Type, Address, Added are still there.
3. **Access Code & Portal card was not compacted.** Still its original size.
4. **Reported Issues card does not feel like the visual centre.** Border and shadow are the same as Profile Details. The amber-pill count beside the title did land. Nothing else visibly changed.
5. **Issue row visual treatment did not change.** The amber left-edge accent is not visibly wider. Row padding looks the same. Separator lines in the expanded state are not present.
6. **Documents & Acceptance collapsible DID land.** This piece worked. Keep it.
7. **Homeowner Activity icon circles DID land.** Keep them.
8. **Escalation sort-to-top was never implemented.** Sprint 3.5a.1 added a "From homeowner" marker on the row but did not change the sort order. Escalated issues still sit wherever the default sort puts them, which is back-of-list because they're newly created with no activity yet. This was the actual user complaint and it was misinterpreted.

This sprint addresses items 1-5 and item 8. Items 6 and 7 stay as-shipped.

---

## 3. Escalation sort-to-top (the actual fix)

**The core problem:** when a homeowner-raised issue is escalated, the user has no idea where it went. The "From homeowner" amber-dot marker added in Sprint 3.5a.1 is invisible if the row is buried mid-list. The fix is sort order, not visual marker.

### 3.1 Required behaviour

On `/developer/issues` in BOTH the "By unit" view and the "Activity" view:

**Activity view (flat list):**

Sort order from top to bottom:
1. Issues with `source = 'homeowner_escalated'` AND whose latest `issue_events.event_type = 'escalated_from_homeowner'` occurred within the last 7 days, sorted by that escalation timestamp descending (most recent escalation first)
2. All other open and reopened issues, sorted by the existing default (created_at desc within their existing severity ordering)
3. Resolved issues at the bottom as today

Group 1 is "freshly escalated from homeowners". They float to the top for 7 days. After 7 days they sink back into the normal sort order, but the row still shows the "From homeowner" marker indefinitely (the marker is a permanent source-of-truth label, not a freshness signal).

**By unit view:**

A unit with at least one freshly-escalated-from-homeowner issue (same definition: source = 'homeowner_escalated' AND latest escalation event within 7 days) sorts above all other units. Within that "freshly escalated" group, sort by the most recent escalation event timestamp descending (the unit with the most recently escalated issue first).

After 7 days the unit drops back into the existing sort order.

### 3.2 Visual treatment in addition to sort

Each row with `source = 'homeowner_escalated'` (regardless of age) shows the existing "From homeowner" marker from Sprint 3.5a.1. Keep that visual treatment unchanged.

ALSO add a small "Newly escalated" amber pill on the right side of the row, next to the existing status pill, ONLY for issues whose latest escalation event is within the last 24 hours. This is a "this just happened" signal, not a permanent label.

Pill spec: amber-100 background, amber-700 text, 11px, rounded-full, "Newly escalated".

In the By unit view, the unit card header shows the same "Newly escalated" pill when any of the unit's issues qualify.

### 3.3 Implementation guidance

The existing `/api/issues/list` endpoint must be extended to:

- For each row, compute and return `latest_escalation_at: timestamptz | null` (the timestamp of the most recent `issue_events` row with `event_type = 'escalated_from_homeowner'`, or null if none)
- For each unit in the `group_by_unit` response shape, compute and return `latest_escalation_at: timestamptz | null` for the unit (max over the unit's issues)
- Sort using these new fields per section 3.1

`newly_escalated` (the 24h field added in Sprint 3.5a.1) can stay, used for the pill. The new field `latest_escalation_at` is what drives the 7-day sort.

Server-side computation, single query with a LATERAL join or a subselect against `issue_events`. No N+1.

### 3.4 Acceptance for section 3 (sort-to-top)

Verified on preview by:
- Escalating the seeded test issue (id `d8f796b8-fe52-42d6-b820-c63706cf03c2`) from Sarah Walsh's detail page
- Navigating to `/developer/issues` in Activity view: the escalated issue must appear in row 1, above the existing Test 2 and Test Snag 1 rows
- Navigating to `/developer/issues` in By unit view: Sarah Walsh's unit (4 Rathárd Lawn) must appear as the FIRST unit card, above Ardan View 002 and 008

---

## 4. Header strip (measured)

Replace the current top-of-page treatment.

### 4.1 Required outcome

Total vertical space from the top of the page content area to the top of the first card row: 80px or less. Measured with browser dev tools, computed via getBoundingClientRect on the header container element.

### 4.2 Structure (HTML/JSX)

```jsx
<div class="flex items-center justify-between mb-6 [some-height-tailwind-class]">
  <div class="flex items-center gap-3">
    <Avatar size="md" /> {/* 40px not 64px */}
    <div class="flex flex-col gap-0">
      <h1 class="text-xl font-semibold leading-tight">[name]</h1>
      <p class="text-sm text-neutral-500 leading-tight">[development_name]</p>
    </div>
  </div>
  <div>
    <StatusPill /> {/* existing component */}
  </div>
</div>
```

Avatar: 40px diameter. Not 48px, not 64px. Name: `text-xl font-semibold`. Not `text-2xl`. Development name: `text-sm text-neutral-500`. Gap between name lines: zero (use leading-tight on both). Outer container vertical padding: zero. Margin-bottom: 24px (`mb-6`).

### 4.3 What must NOT remain

The current "Back to Homeowners" link sitting above the name. It must be moved into the page header chrome (above the strip, separate small element) or removed entirely. The strip itself has no breadcrumb inside it.

### 4.4 Acceptance for section 4

Verified by:

* Open browser dev tools on Sarah Walsh's detail page
* Inspect the header container element
* `getBoundingClientRect().height` returns 80 or less
* Avatar element measures 40px on each side
* Name element uses `text-xl` class, not `text-2xl`

---

## 5. Profile Details card (measured)

### 5.1 Required outcome

The Profile Details card displays House Type, Address, and Added with no icons beside the labels. The card height is 200px or less (measured at standard viewport, no expansion).

### 5.2 Structure

```jsx
<Card>
  <CardHeader>
    <h2 className="text-base font-semibold">Profile Details</h2>
    <button className="text-sm text-brand-600 hover:underline">Edit</button>
  </CardHeader>
  <dl className="divide-y divide-neutral-100">
    <div className="flex justify-between py-2">
      <dt className="text-sm text-neutral-500">House Type</dt>
      <dd className="text-sm font-medium">{house_type}</dd>
    </div>
    <div className="flex justify-between py-2">
      <dt className="text-sm text-neutral-500">Address</dt>
      <dd className="text-sm font-medium text-right">{address}</dd>
    </div>
    <div className="flex justify-between py-2">
      <dt className="text-sm text-neutral-500">Added</dt>
      <dd className="text-sm font-medium">{added_date}</dd>
    </div>
  </dl>
</Card>
```

Key points:

* NO icons next to House Type, Address, or Added. Remove them.
* Title size: `text-base` not `text-xl`.
* Edit is an inline link, not a button with border.
* Field rows use a definition list (dl/dt/dd) with thin dividers.
* Field row vertical padding: `py-2`, NOT `py-4`.

### 5.3 Acceptance for section 5

Verified by:

* Inspect the card element
* `getBoundingClientRect().height` returns 200 or less
* No `<svg>` or `<Icon>` elements beside the House Type, Address, or Added labels
* The Edit element is an `<a>` or `<button>` with no border-style class

---

## 6. Access Code & Portal card (measured)

### 6.1 Required outcome

Card height: 280px or less (measured at standard viewport, no expansion).

### 6.2 Specific compactions

* Access code monospace pill: reduce font size to `text-base` (currently appears to be `text-xl` or larger). Reduce vertical padding to `py-2`. Maintain copy button on the right but at `size-sm`.
* Pre-Handover badge: keep as-is but ensure it's a single line.
* Portal URL input: reduce to `text-sm`, single line.
* Download QR button and Open Portal button: use `size="sm"` variant. Side-by-side, equal width. Not the larger size they have today.

### 6.3 Acceptance for section 6

Verified by:

* Inspect the card element
* `getBoundingClientRect().height` returns 280 or less
* Access code monospace element has font-size of 16px or less (computed style)
* Both action buttons at the bottom have a height of 32px or 36px (the small variant)

---

## 7. Reported Issues card (visual centre)

### 7.1 Required outcome

The Reported Issues card visually reads as the highest-priority surface on the page. A user looking at the page for the first time should look at this card before any other card.

### 7.2 Specific differentiation

Compared to the other cards on the page, the Reported Issues card must:

* Have a heavier border. Specific implementation: use `border-2` (2px) where other cards use `border` (1px), OR use `shadow-md` where other cards use `shadow-sm` or none. Pick one based on the existing design system. The other cards stay at 1px / no shadow.
* Have a larger title. Specific implementation: `text-lg font-semibold` for this card's title; other cards use `text-base font-semibold`.
* Use a subtle brand accent on the card border: `border-brand-200` instead of `border-neutral-200` (if border approach) or `shadow-brand-200/20` (if shadow approach). The brand colour is the page's anchor.

### 7.3 Issue row visual treatment

For every row in the card:

* Vertical padding: `py-5` (20px). Not `py-3` or `py-4`.
* Border on the left edge for `homeowner_new` rows: `border-l-4 border-amber-500`. 4px wide. Rounded matches the row's outer rounding.

For the expanded state of a tapped row:

* Horizontal dividers between sections (resident message to description to AI assessment to action buttons). Use `divide-y divide-neutral-100` on a parent or explicit `border-t border-neutral-100 pt-4 mt-4` between sections.
* Vertical spacing between sections: 16px above and below each divider.

### 7.4 Empty state

When no issues exist:

* Centered. The card has flex justify-center items-center for the content area.
* Icon: lucide `Inbox`, 32px, inside a 64px circle with `bg-brand-50` and `text-brand-600`.
* Primary text below: `text-base font-medium text-neutral-700` reading "No issues raised by this homeowner yet."
* Secondary text below that: `text-sm text-neutral-500` reading "Issues raised through the assistant chat or escalated by site team will appear here."
* Total empty-state card height: 240px target.

### 7.5 Acceptance for section 7

Verified by:

* Open Sarah Walsh's detail page. The Reported Issues card has visibly heavier or differently-styled border/shadow compared to Profile Details and Access Code cards beside it.
* The card title is visibly larger than the Profile Details title.
* Inspect the issue row. The amber left edge is `border-l-4` (4px) confirmed in dev tools.
* Inspect the row's computed padding. `py-5` (20px top and bottom).
* Tap to expand. Dividers visible between resident message, description, AI assessment, and action buttons.
* Open a homeowner with no issues (any homeowner who hasn't been seeded). The empty state shows an icon in a circle, primary text, and secondary text, vertically centered.

---

## 8. Acceptance criteria (full list)

The sprint is done when ALL of the following pass on Vercel preview. Each criterion is pass/fail. Before opening the PR, verify each one.

Header strip:

1. Header container element `getBoundingClientRect().height` <= 80
2. Avatar is 40px square
3. Name uses text-xl class (not text-2xl)
4. "Back to Homeowners" breadcrumb is NOT inside the header strip

Profile Details:

5. Card height <= 200
6. No SVG/icon elements beside House Type, Address, or Added labels
7. Card title uses text-base (not text-xl)
8. Edit is an inline link (no border)

Access Code & Portal:

9. Card height <= 280
10. Access code monospace text computed font-size <= 16px
11. Download QR and Open Portal buttons are size-sm (height 32-36px)

Reported Issues:

12. Card has visibly different border weight OR shadow vs Profile Details on the same page
13. Card title is visibly larger than Profile Details title
14. Issue row vertical padding is py-5 (20px computed)
15. homeowner_new rows have border-l-4 amber-500 (4px wide left edge)
16. Expanded row has visible divider lines between sections
17. Empty state shows icon in brand-50 circle plus two text lines, vertically centered

Escalation sort-to-top:

18. After escalating the seeded issue d8f796b8, navigate to `/developer/issues` Activity view. The escalated issue is at position 1 (top of list).
19. In By unit view, Sarah Walsh's unit (4 Rathárd Lawn) is the first unit card, above existing Ardan View 002 and 008.
20. The escalated row shows a "Newly escalated" amber pill in addition to the existing "From homeowner" amber-dot marker.
21. The unit card in By unit view shows the "Newly escalated" pill in its header.

No regression:

22. The Documents & Acceptance collapsible still works as in 3.5a.1
23. Homeowner Activity card icon circles still present as in 3.5a.1
24. Three resolution actions (resolve/escalate/warranty) still work
25. Recent Conversations card stays removed (privacy fix)
26. Vercel build green before PR is squash-merged

Hygiene:

27. No em dashes anywhere

---

## 9. Self-verification before opening PR

Before opening the PR, run through criteria 1-26 above on the local dev server. For criteria that require measurement (1, 5, 9, 14), use browser dev tools and confirm specific px values. For criteria that require comparison (12, 13), open Sarah Walsh's detail page and look at the three right-column cards side by side.

If any criterion fails: fix it. Do not open the PR with known failures.

If a criterion cannot be met (e.g. the design system doesn't expose a way to achieve it): stop, do not open the PR, and report which criterion failed and why.

---

## 10. Out of scope

* No changes to the homeowner-side assistant chat
* No new database tables or columns
* No new feature flags
* No changes to other developer pages (Compliance, Smart Archive, etc)
* No changes to the homeowners LIST page
* The `newly_escalated` field added in 3.5a.1 stays
* The "From homeowner" marker added in 3.5a.1 stays
* The Documents & Acceptance collapsible from 3.5a.1 stays
* The Homeowner Activity icon circles from 3.5a.1 stay

---

## 11. Branch and PR

Branch: `assistant-v2/sprint-3-5a-2-tight-polish`

PR title: `feat(assistant-v2): Sprint 3.5a.2 tight polish with measured criteria`

PR body must include a checklist of all 27 acceptance criteria from section 8 with each one ticked off with a brief note of how it was verified.
