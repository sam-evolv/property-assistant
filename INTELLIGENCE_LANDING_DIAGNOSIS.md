# Intelligence Landing Diagnosis (Session 7)

1. **Landing renders in a single file.** `apps/unified-portal/app/agent/intelligence/page.tsx`
   is a 1,400-line component that owns both the landing state (empty
   messages array) and the conversation state. The "Ask anything about
   your pipeline or tasks" hero, the drafts banner
   (`intelligence-drafts-greeting`), the WRITE_PILLS 2×3 grid (line 790),
   and the PROMPT_PILLS 2×2 grid (line 827) all live inside the
   `!hasMessages` branch starting at line 661. The VoiceInputBar is the
   pinned footer. There is no separate landing component and no carousel.
   Desktop uses `app/agent/dashboard/intelligence/page.tsx` — a different
   file, untouched.

2. **Async data at first paint.** Four hooks populate the landing after
   the first render: `useAgent()` (agent profile + alerts +
   developmentIds, server-bound), `useDraftsCount()` (polls
   `/api/agent/intelligence/drafts` — initial state is `0`, resolves over
   network), `useVoiceCapture()` (local refs only, no network), and
   `useApprovalDrawer()` (local state). `useSearchParams()` delivers the
   `?prompt=` prefill synchronously.

3. **The shifts.** `pendingDraftsCount` starts at `0`, so the
   conditional drafts banner (line 736) is absent on first paint, then
   pops into the flex column once the fetch returns a non-zero count.
   Because the landing uses `justifyContent: center` on a flex column and
   every sibling has natural height, the hero title, both pill grids,
   and the hero image all shift upward when the banner appears. The
   PROMPT_PILLS branch picks between SCHEME_PILLS and INDEPENDENT_PILLS
   based on `agent?.agentType` — undefined until `useAgent()` resolves
   — so for one tick the component renders scheme pills even for
   independent agents, then re-renders. That re-render doesn't change
   layout size but does flash content.

4. **Action-grid handlers.** WRITE_PILLS (lines 35–42) are voice-capture
   entry points. Each one routes through `handleWriteChip(intent)` at
   line 638, which stashes the intent in `voiceIntentRef.current` and
   calls `voice.start()` to open the mic. None of them prefill the
   input bar or navigate. The value of WRITE_PILLS for the model is
   only that the intent is stamped onto the voice transcript payload
   — if those same intents are available as natural-language chips in
   the new carousel and the user just says/types the chip text, the
   backend's routing handles it the same way.

5. **No existing chip carousel.** The codebase has pill grids (non-rotating
   flex layouts in this same file and in VoiceConfirmationCard.tsx) and
   follow-up chip rows on AI responses (`AIResponseCard` at the end of
   page.tsx), but no rotating carousel pattern. `CapabilityChipsCarousel`
   needs to be built from scratch. Keep the bundle lean — no Framer
   Motion dependency; a CSS transition on transform + opacity is
   sufficient for the slide effect.

## Fix plan applied in this commit

- New `lib/agent-intelligence/capability-chips.ts` exports the 21 chip
  library. Shuffled on mount inside the carousel so first-impression
  chips vary session-to-session.
- New `app/agent/_components/CapabilityChipsCarousel.tsx`: 4 chips
  visible, rotates every 6s, pauses on input focus + pointer hover,
  respects `prefers-reduced-motion` (fade-swap instead of slide). Tapping
  a chip calls `onChipTap(text)` passed from the page — that handler
  prefills the input and focuses it, without auto-submitting.
- Landing rebuild in `app/agent/intelligence/page.tsx`:
  * WRITE_PILLS grid deleted (`handleWriteChip` left wired to the voice
    intent flow, but the button surface is gone — voice workflows still
    pick up the intent when the user starts a voice capture via the mic
    button, and the chip library now seeds "Log a rental viewing for
    tomorrow" as natural language).
  * PROMPT_PILLS grid replaced with the carousel.
  * Hero copy is "What can I help with, <first name>?" above the quiet
    helper line.
  * Drafts banner now reserves its height with a fixed-height skeleton
    until `useDraftsCount` resolves. `useDraftsCount` now returns
    `ready: boolean` so downstream can distinguish "still loading" from
    "resolved to zero".
- Desktop dashboard is untouched — the changes are confined to
  `app/agent/intelligence/page.tsx` and new component files.
