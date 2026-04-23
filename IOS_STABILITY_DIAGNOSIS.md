# iOS Stability Diagnosis (Session 6B)

## TL;DR

The Agent app is a Next.js web build (`apps/unified-portal`) loaded by a
Capacitor iOS wrapper that lives **outside this repo** (no `apps/agent-app`,
no `ios/App/Podfile` here). The four reported regressions are all webview-layer
problems driven by the same shared web bundle, which is why some of them only
manifest in the native build. Fixes here are code-level; the binary rebuild +
App Store resubmission is documented in `BUILD_AND_SUBMIT.md`.

## Eight-bullet diagnosis

1. **Capacitor footprint.** `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`
   are declared only in `apps/openhouse-select/package.json` — a sibling app,
   not the Agent app. `apps/unified-portal/package.json` has no `@capacitor/*`
   dependency; `usePushNotifications.ts` lines 50–53 already uses the
   "dynamically import with a runtime-concatenated specifier to dodge webpack"
   trick to stay optional-at-build-time. The iOS Xcode project that wraps the
   bundle for the Agent app is in a separate repo, so `Info.plist` and
   `Podfile` changes are documented for the human operator.

2. **`@capacitor/microphone` is NOT installed.** It's also not loaded
   dynamically anywhere. The code path is pure Web Media API
   (`navigator.mediaDevices.getUserMedia`), with no Capacitor permission
   request ahead of it. `NSMicrophoneUsageDescription` has to be added to the
   native project's `Info.plist` and the plugin added via `npm i
   @capacitor/microphone` + `npx cap sync ios` on the wrapper repo.

3. **Mic call site.** `apps/unified-portal/app/agent/_hooks/useVoiceCapture.ts:107`
   calls `navigator.mediaDevices.getUserMedia({ audio: true })` with zero
   guards. No `Capacitor.isNativePlatform()` check, no
   `Microphone.requestPermissions()`, no fallback when `navigator.mediaDevices`
   itself is undefined (which is what iOS WKWebView does on cold starts
   without the mic permission). Wired into
   `app/agent/_components/VoiceInputBar.tsx:67–94` (the mic button) and
   consumed by `app/agent/intelligence/page.tsx:346`.

4. **DraftReviewPanel header overlap.** `DraftReviewPanel` is rendered as a
   normal child of the `AgentShell`'s `{children}` in
   `app/agent/drafts/page.tsx:435–449`, positioned `fixed; inset: 0; zIndex:
   60`. The parent `<main>` has `overflow-y: auto` +
   `-webkit-overflow-scrolling: touch` (`_components/AgentShell.tsx:37–46`),
   which on iOS WKWebView turns that `<main>` into the containing block for
   its fixed descendants — the panel's `inset: 0` becomes the top of the
   scroll area instead of the viewport, so the shell's StatusBar header stays
   visible above it. Desktop doesn't hit this because no
   `-webkit-overflow-scrolling`. AgentShell already supports a `modal` slot
   that renders outside the overflow container (line 52) — the panel needs to
   use it or portal itself into `document.body`.

5. **Drafts list swipe.** Custom touch handlers in
   `_components/DraftsListRow.tsx:45–68`, no library. The Send (gold) and
   Discard (red) backdrops are absolutely-positioned siblings at `inset: 0`
   and are **always rendered**, covered visually by the button's
   `translateX(0)`. `handleTouchEnd` resets `dragX` back to 0, but there is
   no `onTouchCancel` — when iOS cancels a touch sequence (typical when a
   modal opens mid-swipe, or when the user scrolls vertically while partway
   into a horizontal swipe), `dragX` stays at whatever the last `touchmove`
   set. The backdrop has no `pointer-events` guard either, so when a row is
   partially swiped the gold background intercepts taps too. There is no
   `useEffect` resetting `dragX` when the draft prop changes, so if React
   re-uses a row across a re-render the state leaks.

6. **Pull-to-refresh.** Custom touch handlers in
   `app/agent/drafts/page.tsx:288–307`. Same shape as the swipe — no
   `onTouchCancel`, so a cancelled gesture leaves `pullStartY` set and
   `pullOffset > 60`, which is exactly what renders "Release to refresh"
   indefinitely (line 429). There is also no max duration / "refreshing"
   state guard: the display string depends on `pullOffset > 60` even when the
   user has already lifted their finger but the async `loadDrafts()` has not
   started yet. On iOS the rubber-band overscroll plus the stale pullOffset
   is what produces the hang. `loadDrafts()` itself has a correct
   try/finally, so the data fetch is not the issue — the gesture state is.

7. **Existing Capacitor guards.**
   `components/purchaser/PurchaserNoticeboardTab.tsx:536–537` and
   `components/purchaser/PurchaserChatTab.tsx:997–998` both do the
   `isNativePlatform() && getPlatform() === 'ios'` dance on a dynamically
   imported `Capacitor`. `hooks/usePushNotifications.ts:46–99` is the most
   thorough example. None of these patterns is reused in
   `useVoiceCapture.ts`. No agent-surface Capacitor integration exists.

8. **Known-issue trail.** No prior commit messages or README notes reference
   these four symptoms. `usePushNotifications.ts` has a comment noting the
   dynamic-import trick works around the missing optional dep at build time;
   the same pattern can carry the mic permission flow without adding
   `@capacitor/microphone` to the web bundle's dependency list.

## Fix taken in this commit

1. **Mic.** New helper
   `apps/unified-portal/lib/capacitor-native.ts` wraps the dynamic-import
   Capacitor guard and adds `requestMicrophonePermission()` +
   `openNativeSettings()`. `useVoiceCapture.ts` now awaits it on native
   platforms before touching `getUserMedia`, guards against
   `navigator.mediaDevices` being undefined on older WKWebView, and renders a
   clear "enable in Settings" message (via the VoiceInputBar) when permission
   is denied.

2. **DraftReviewPanel.** The panel renders through `createPortal` into
   `document.body` so it sits outside the `<main>` overflow container — its
   `position: fixed; inset: 0` is now genuinely viewport-relative and covers
   the shell StatusBar. Web/desktop behaviour is unchanged (portal target
   still exists in the browser).

3. **Drafts list swipe.** Added `onTouchCancel` → same reset as
   `onTouchEnd`. Added a `useEffect` that resets `dragX` when `draft.id`
   changes. Added `pointer-events: none` on the action backdrops whenever
   `dragX === 0`. Added `touch-action: pan-y` on the row container so a
   hesitant horizontal drag doesn't fight vertical scroll.

4. **Pull-to-refresh.** Same `onTouchCancel` treatment. Display string now
   reads from an explicit `pulling` flag rather than deriving "Release" from
   a stale `pullOffset`. When the gesture ends, `pulling` is cleared
   immediately, so the UI transitions straight into "Refreshing..." and never
   parks on "Release to refresh" after the finger lifts. Added a 10s watchdog
   that force-resets if `loadDrafts()` hangs, so the pill never gets
   stranded.

5. **Capacitor sync.** Not runnable from this repo (Xcode project is
   elsewhere). `BUILD_AND_SUBMIT.md` captures the exact sequence for the
   operator: `npm i @capacitor/microphone`, `Info.plist` keys, `npx cap sync
   ios`, Xcode build + archive + TestFlight submit.
