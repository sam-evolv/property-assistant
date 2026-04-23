# Session 8 Diagnosis — five regressions surfaced on the installed iOS PWA-Capacitor app

## Bug 1 — "Microphone is not available in this browser"

**File / line.** `apps/unified-portal/app/agent/_hooks/useVoiceCapture.ts:144`
surfaces `MIC_UNAVAILABLE_MESSAGE` when `navigator.mediaDevices` is falsy
OR when `getUserMedia` isn't a function. The hook runs that pre-flight
check before even attempting the call.

**Why it's failing.** In the PWA-Capacitor shell that loads
`portal.openhouseai.ie`, `@capacitor/microphone` is not installed, so
`lib/capacitor-native.ts:64 → requestMicrophonePermission()` returns
`{ status: 'unavailable' }`. The hook then falls through to the browser
path — correct so far — and hits the `navigator.mediaDevices` guard.
On this particular iOS configuration, either `navigator.mediaDevices` is
undefined at that moment (WebView privacy default) or the property
exists as a non-function. Either way the guard trips early and the user
never gets a chance to prompt for permission. The pre-flight check is
too eager: on iOS WKWebView `getUserMedia` has been observed to succeed
even when the pre-flight property read looks suspicious, because the
first call itself is what activates the permission subsystem.

**Fix approach.** Drop the pre-flight check. Use optional chaining to
resolve `getUserMedia`; if it's present, call it and let the browser
throw `NotAllowedError` / `NotFoundError` / `TypeError` on failure. Map
each thrown error name to a distinct user-facing message — denied
(Settings hint), hardware-missing, or truly-unavailable. Only surface
"not available" when the function reference is actually missing.

## Bug 2 — Bottom-nav taps open Mobile Safari after mic interaction

**File / line.** `apps/unified-portal/app/agent/_components/BottomNav.tsx:97–126`
uses Next.js `<Link>` with plain hrefs (`/agent/home`,
`/agent/pipeline`, `/agent/applicants`, `/agent/viewings`). The Links
are correct. `window.open` and `target="_blank"` do not appear in
BottomNav or its ancestors.

**Why it's failing.** Trigger is specifically "after interacting with
the mic". The path we believe breaks the WebView: `voice.start()` →
`requestMicrophonePermission()` → dynamic import of
`@capacitor/microphone` → bare-specifier import fails in the browser →
the WebView's module loader emits a request for
`https://portal.openhouseai.ie/@capacitor/microphone` → 404. On some
iOS Capacitor shell configurations, a 404 on a `capacitor://`-prefixed
or absolute-specifier import is treated as a decide-policy-for-url
navigation attempt, and the iOS delegate's fallback is to hand the URL
off to Mobile Safari. Subsequent taps within the same WebView session
inherit the broken decide-policy state — any relative-href `<Link>`
click is routed through the same delegate, which has now been conditioned
to treat navigations as external. The mic flow doesn't directly add any
`target="_blank"` — it corrupts the WebView's nav policy via the failed
bare-specifier import.

**Fix approach.** Stop emitting bare-specifier dynamic imports that can
look like network URLs. Guard the mic plugin import behind a
`isCapacitorNative()` check that ALSO confirms the global
`(window as any).Capacitor?.Plugins?.Microphone` is already present.
If the plugin isn't on `Capacitor.Plugins`, skip the `import()` entirely
— the browser path will be used. Belt-and-braces: BottomNav now binds
an explicit `onClick` handler that calls `router.push(href)` with
`preventDefault`, so even if the WebView's decide-policy is in a broken
state, we never actually follow a link, we programmatically navigate
via Next.js.

## Bug 3 — Six chips visible instead of four

**File / line.** `apps/unified-portal/app/agent/_components/CapabilityChipsCarousel.tsx:115–147`
renders into a flex container with `flexWrap: 'wrap'` and four chip
children. Each chip has `animation: oh-chip-slide-in 320ms` on EVERY
render — not just on mount.

**Why it's failing.** Two issues. (a) Every chip re-runs the slide-in
keyframe on every re-render (animation restarts as a fresh inline style
string each time), so the outgoing chip is still painting its slide-in
when the incoming chip begins its own, yielding a multi-frame overlap
where >4 chips are visible. (b) When the offset tick lands on a cycle
boundary, two adjacent `visible[i]` entries may receive keys that
collide with chips rendered in the prior frame that React hasn't yet
removed from the DOM — CSS animation transforms make the "lingering"
old chip appear alongside the new one. On a narrow iPhone viewport
`flex-wrap` spreads these over two rows, and the user counts 6.

**Fix approach.** Render a fixed 2×2 grid so exactly 4 cells exist at
all times — `display: grid; grid-template-columns: repeat(2, 1fr);
grid-template-rows: repeat(2, auto)`. `overflow: hidden` on the grid so
any stray transformed chip can't escape the cell. Move the keyframe
animation off the chip element and onto a `key`-wrapped inner `<span>`
that only animates once per mount. Drop `flex-wrap` entirely.

## Bug 4 — OPENHOUSE logo treatment changed by Session 7

**File / line.** `apps/unified-portal/app/agent/intelligence/page.tsx`.
Session 7 (commit `8036656`, merged as `f70af6d`) removed the
`<Image src="/oh-logo.png" width={168} height={168} … />` hero logo and
the gold-gradient "OpenHouse Intelligence" label from the landing
between the old position of the image and the hero title. Current state
has "What can I help with, {firstName}?" at the top with no logo.

**Why it's failing.** Intentional Session 7 change (the "quiet hero"
spec said to drop them). The user wants the pre-7 logo treatment back.

**Fix approach.** Reinstate the `<Image src="/oh-logo.png">` and the
gold-gradient "OpenHouse Intelligence" label above the "What can I help
with" question, at their prior sizing. Keep every other Session 7
element (hero copy, helper line, drafts banner with reserved height,
chip carousel) intact.

## Bug 5 — `draft_buyer_followups` picks wrong units and duplicates joint purchasers

**File / line.** `apps/unified-portal/lib/agent-intelligence/tools/agentic-skills.ts:1164`
(`draftBuyerFollowups`) has three separate problems:

1. **No purpose parameter.** The body template is locked to "Could you
   let me know where things stand on your end?" (line 1256) regardless
   of whether the agent asked for a chase, a welcome message, an
   introduction, or a price-review. The subject is fixed to
   "Following up — Unit X".
2. **No count-vs-explicit-units check.** The skill accepts any
   `targets[]` the model passes. When the agent says "3 Ardan view" and
   the model invents 3 targets (picking the most chat-salient units),
   the skill happily drafts for them.
3. **Treats one unit with joint purchasers as one target.** `units`
   table has `purchaser_name` as a single text field that may contain
   `"Laura Hayes and Dylan Rogers"`. The skill's template calls
   `firstName(recipientName)` which splits on whitespace and picks the
   first token ("Laura"), greeting only half the household. Separately,
   if the model sends TWO targets for the same unit (one for each
   purchaser), the skill produces two separate drafts instead of one
   joint-addressed email. Both happen in the wild: the reported case
   produced two drafts for Unit 19's joint buyers.

**Fix approach.**
- Add `purpose?: 'chase' | 'congratulate_handover' | 'introduce' | 'update' | 'custom'`
  and `custom_instruction?: string`. Swap the subject/body template per
  purpose. `congratulate_handover` → "Welcome to your new home — Unit X,
  [Scheme]" + warm congratulations copy, no "where do you stand" tail.
  `custom` uses `custom_instruction` as the body lead.
- Parse the resolved unit's `purchaser_name` into separate names
  (splitting on " and " / " & "), greet with "Hi Laura and Dylan,"
  addressed to both — one draft per unit, never per name.
- Deduplicate incoming targets by resolved `unit.id` so the model
  sending two targets for the same unit still produces one draft.
- System prompt update: when the user specifies a count ("draft email
  to 3 X") without naming units AND the prior chat turn did not
  produce an explicit list, Intelligence must ASK for clarification
  with 3-5 candidate units, not invent a selection. When the user
  says "those N" after a preceding tool-produced list, use that list
  directly.

Tests: single purchaser → 1 draft, joint ("A and B") → 1 draft greeting
both names, 3 distinct units with one joint → 3 drafts.
